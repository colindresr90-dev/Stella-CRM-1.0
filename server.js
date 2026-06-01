const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { startEmailWorker } = require('./lib/emailWorker');

// Load Next.js environment config
const { loadEnvConfig } = require('@next/env');
const dev = process.env.NODE_ENV !== 'production';
const projectDir = process.cwd();
loadEnvConfig(projectDir, dev);

const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    // Skip Next.js request handler for Socket.io requests to prevent 404 responses
    if (pathname && pathname.startsWith('/socket.io/')) {
      return;
    }

    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Share the Socket.io instance globally so the API routes can emit events
  global.io = io;

  io.on('connection', (socket) => {
    console.log('[Socket.io] Client connected:', socket.id);

    // Relay client-emitted email-sent events to all connected clients
    socket.on('email-sent', (data) => {
      console.log('[Socket.io] Email sent by client, broadcasting event:', data.subject);
      io.emit('new-email', data);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io] Client disconnected:', socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });

  // Start background workers
  startImapListener(io);
  startEmailWorker();
});

async function startImapListener(io) {
  const emailPassword = process.env.EMAIL_PASSWORD;
  if (!emailPassword) {
    console.error('[IMAP IDLE] Error: EMAIL_PASSWORD environment variable is not defined. IMAP listener will not start.');
    return;
  }

  while (true) {
    let client = null;
    try {
      console.log('[IMAP IDLE] Connecting to Titan Email (info@taskmasters.site)...');
      client = new ImapFlow({
        host: 'imap.titan.email',
        port: 993,
        secure: true,
        auth: {
          user: 'info@taskmasters.site',
          pass: emailPassword
        },
        logger: false
      });

      await client.connect();
      console.log('[IMAP IDLE] Connected successfully.');

      // Select the mailbox and release the lock immediately to allow automatic idle without locking commands
      const lock = await client.getMailboxLock('INBOX');
      console.log('[IMAP IDLE] Inbox selected. Listening for new emails...');
      lock.release();

      client.on('exists', async (data) => {
        let fetchLock = null;
        try {
          console.log(`[IMAP IDLE] Exists event fired. Total messages: ${data.count}`);
          // Acquire a temporary lock to run the fetchOne command immediately during idle
          fetchLock = await client.getMailboxLock('INBOX');
          
          const message = await client.fetchOne(data.count.toString(), { source: true });
          if (message && message.source) {
            const parsed = await simpleParser(message.source);
            
            const emailData = {
              id: parsed.messageId || Date.now().toString(),
              from: parsed.from ? { name: parsed.from.value[0]?.name || "", address: parsed.from.value[0]?.address || "" } : { name: "", address: "" },
              to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap((t) => t.value.map((v) => ({ name: v.name || "", address: v.address || "" }))) : [],
              cc: parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).flatMap((t) => t.value.map((v) => ({ name: v.name || "", address: v.address || "" }))) : [],
              bcc: parsed.bcc ? (Array.isArray(parsed.bcc) ? parsed.bcc : [parsed.bcc]).flatMap((t) => t.value.map((v) => ({ name: v.name || "", address: v.address || "" }))) : [],
              subject: parsed.subject || "(Sin asunto)",
              preview: parsed.text ? parsed.text.slice(0, 100).replace(/\s+/g, ' ') + "..." : "",
              body: parsed.html || parsed.textAsHtml || parsed.text || "",
              date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
              folder: 'INBOX'
            };

            console.log(`[IMAP IDLE] New email fetched from ${emailData.from.address}. Subject: "${emailData.subject}"`);
            
            // Emit to all connected clients
            io.emit('new-email', emailData);
          }
        } catch (fetchErr) {
          console.error('[IMAP IDLE] Error fetching/parsing new message:', fetchErr);
        } finally {
          if (fetchLock) {
            fetchLock.release();
          }
        }
      });

      // Keep connection open by waiting for close or error event from the client
      await new Promise((resolve, reject) => {
        client.on('close', resolve);
        client.on('error', reject);
      });
      
      await client.logout();
    } catch (err) {
      console.error('[IMAP IDLE] Error or disconnection in IMAP:', err.message);
    }

    console.log('[IMAP IDLE] Disconnected. Reconnecting in 10 seconds...');
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}
