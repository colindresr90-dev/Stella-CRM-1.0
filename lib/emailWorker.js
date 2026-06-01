/**
 * Email background worker.
 * Runs inside the same Node.js process as server.js.
 * Polls email_queue every POLL_INTERVAL_MS for pending jobs.
 * No Redis, no extra infrastructure — Supabase is the queue store.
 */

'use strict'

const { createClient } = require('@supabase/supabase-js')
const nodemailer = require('nodemailer')
const { ImapFlow } = require('imapflow')

const POLL_INTERVAL_MS = 5_000   // check for new jobs every 5 seconds
const MAX_ATTEMPTS = 3

// Exponential backoff delays between retries: 30s, 5min, 15min
const RETRY_DELAYS_MS = [30_000, 5 * 60_000, 15 * 60_000]

function makeDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

/**
 * Claim one pending job that is ready to run (past its retry_after time).
 * Returns the job row or null if nothing is pending.
 */
async function claimNextJob(db) {
  // Find oldest eligible job
  const { data: job, error } = await db
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .or('retry_after.is.null,retry_after.lte.' + new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !job) return null

  // Atomic claim: only proceed if still pending
  const { data: claimed } = await db
    .from('email_queue')
    .update({ status: 'processing', attempts: job.attempts + 1 })
    .eq('id', job.id)
    .eq('status', 'pending')
    .select('id')

  if (!claimed || claimed.length === 0) return null // another worker got it first
  return { ...job, attempts: job.attempts + 1 }
}

/** Build and send via SMTP. Returns the messageId. */
async function sendViaSMTP(job, emailPassword) {
  const attachments = []
  let processedHtml = job.html_text || ''
  let imgIdx = 1

  // Convert inline base64 images to CID attachments
  processedHtml = processedHtml.replace(
    /src=["']data:image\/([a-zA-Z+.-]+);base64,([^"']+)["']/g,
    (_, ext, b64) => {
      const cid = `inline_img_${Date.now()}_${imgIdx++}`
      attachments.push({ filename: `logo_${imgIdx - 1}.${ext}`, content: b64, encoding: 'base64', cid })
      return `src="cid:${cid}"`
    }
  )

  if (job.attachments && Array.isArray(job.attachments)) {
    attachments.push(...job.attachments)
  }

  const mailOptions = {
    from: '"Taskmasters CRM" <info@taskmasters.site>',
    to: job.to,
    subject: job.subject,
    html: processedHtml,
    ...(job.cc  ? { cc:  job.cc  } : {}),
    ...(job.bcc ? { bcc: job.bcc } : {}),
    ...(attachments.length ? { attachments } : {}),
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.titan.email',
    port: 465,
    secure: true,
    auth: { user: 'info@taskmasters.site', pass: emailPassword },
  })

  const info = await transporter.sendMail(mailOptions)

  // Await append to Sent folder so that it is guaranteed to be in IMAP before we clear cache/notify
  try {
    await appendToSentFolder(mailOptions, emailPassword)
    console.log('[worker] Appended sent email to IMAP Sent folder successfully')
  } catch (e) {
    console.error('[worker] Sent folder append failed:', e.message)
  }

  return info.messageId
}

async function appendToSentFolder(mailOptions, emailPassword) {
  const { default: MailComposer } = await import('nodemailer/lib/mail-composer/index.js').catch(() =>
    // CommonJS fallback
    require('nodemailer/lib/mail-composer')
  )
  const raw = await new MailComposer(mailOptions).compile().build()
  const client = new ImapFlow({
    host: 'imap.titan.email', port: 993, secure: true,
    auth: { user: 'info@taskmasters.site', pass: emailPassword },
    logger: false,
  })
  await client.connect()
  const lock = await client.getMailboxLock('Sent')
  try { await client.append('Sent', raw, ['\\Seen']) } finally { lock.release() }
  await client.logout()
}

/** Mark a job as sent and notify the user. */
async function markSent(db, job, messageId) {
  await db
    .from('email_queue')
    .update({ status: 'sent', message_id: messageId, processed_at: new Date().toISOString() })
    .eq('id', job.id)

  if (job.created_by) {
    await db.from('notifications').insert({
      user_id: job.created_by,
      title: 'Correo enviado',
      message: `Tu correo "${job.subject}" fue entregado a ${job.to}.`,
      type: 'update',
      related_id: job.lead_id ?? null,
      read: false,
    })
  }

  // Invalidate IMAP cache in Redis for this recipient
  try {
    const { Redis } = require('@upstash/redis')
    const redis = Redis.fromEnv()
    await redis.del(`imap:${job.to}`)
    console.log(`[worker] Invalidated IMAP cache in Redis for: ${job.to}`)
  } catch (redisErr) {
    console.error('[worker] Failed to invalidate IMAP cache in Redis:', redisErr.message)
  }

  // Notify clients in real-time via Socket.io
  if (global.io) {
    try {
      const emailData = {
        id: messageId || job.id.toString(),
        from: { name: "Tú", address: "info@taskmasters.site" },
        to: [{ name: "", address: job.to }],
        cc: job.cc ? job.cc.split(',').map(e => ({ name: "", address: e.trim() })) : [],
        bcc: job.bcc ? job.bcc.split(',').map(e => ({ name: "", address: e.trim() })) : [],
        subject: job.subject,
        preview: job.html_text ? job.html_text.replace(/<[^>]*>/g, '').slice(0, 100).replace(/\s+/g, ' ') + "..." : "",
        body: job.html_text,
        date: new Date().toISOString(),
        folder: 'Sent'
      }
      global.io.emit('new-email', emailData)
      console.log(`[worker] Broadcasted new-email event via Socket.io for: ${job.subject}`)
    } catch (socketErr) {
      console.error('[worker] Failed to emit Socket.io event:', socketErr.message)
    }
  }
}

/** Mark a job as failed (retryable) or dead (exhausted). */
async function markFailed(db, job, errorMsg) {
  const exhausted = job.attempts >= MAX_ATTEMPTS
  const retryDelay = RETRY_DELAYS_MS[job.attempts - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
  const retryAfter = exhausted ? null : new Date(Date.now() + retryDelay).toISOString()

  await db
    .from('email_queue')
    .update({
      status: exhausted ? 'failed' : 'pending',
      error: errorMsg,
      retry_after: retryAfter,
      processed_at: exhausted ? new Date().toISOString() : null,
    })
    .eq('id', job.id)

  if (exhausted && job.created_by) {
    await db.from('notifications').insert({
      user_id: job.created_by,
      title: 'Error al enviar correo',
      message: `No se pudo enviar "${job.subject}" a ${job.to} tras ${MAX_ATTEMPTS} intentos. ${errorMsg}`,
      type: 'update',
      related_id: job.lead_id ?? null,
      read: false,
    })
    console.error(`[worker] Job ${job.id} exhausted retries → dead. Error: ${errorMsg}`)
  } else {
    console.warn(`[worker] Job ${job.id} failed (attempt ${job.attempts}/${MAX_ATTEMPTS}), retry in ${retryDelay / 1000}s`)
  }
}

/** Process one job. Returns 'processed' | 'failed' | 'empty'. */
async function tick() {
  const db = makeDb()
  const emailPassword = process.env.EMAIL_PASSWORD
  if (!emailPassword) return 'empty'

  const job = await claimNextJob(db)
  if (!job) return 'empty'

  console.log(`[worker] Processing job ${job.id} → ${job.to} (attempt ${job.attempts}/${MAX_ATTEMPTS})`)

  try {
    const messageId = await sendViaSMTP(job, emailPassword)
    await markSent(db, job, messageId)
    console.log(`[worker] Job ${job.id} sent OK. messageId: ${messageId}`)
    return 'processed'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await markFailed(db, job, msg)
    return 'failed'
  }
}

/**
 * Start the worker loop. Call once from server.js.
 * It keeps polling forever; each iteration is independent.
 */
async function startEmailWorker() {
  console.log(`[worker] Email worker started. Polling every ${POLL_INTERVAL_MS / 1000}s.`)

  const loop = async () => {
    try {
      const result = await tick()
      // If we processed a job, check immediately for more (drain the queue)
      if (result === 'processed') {
        setImmediate(loop)
        return
      }
    } catch (err) {
      console.error('[worker] Unexpected error in tick:', err)
    }
    setTimeout(loop, POLL_INTERVAL_MS)
  }

  loop()
}

module.exports = { startEmailWorker, tick }
