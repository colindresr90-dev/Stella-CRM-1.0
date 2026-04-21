import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { sendMeetingEmail } from '@/lib/email';

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lead_id, title, description, start_time, end_time, lead_email, lead_name } = body;

    const email = process.env.GOOGLE_CLIENT_EMAIL?.trim();
    const rawKey = process.env.GOOGLE_PRIVATE_KEY;
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    if (!email || !rawKey || !calendarId) {
      return NextResponse.json({ success: false, error: 'Config missing' }, { status: 500 });
    }

    const formattedKey = rawKey.replace(/\\n/g, '\n').trim();
    const auth = new google.auth.JWT({
      email: email,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    const calendar = google.calendar({ version: 'v3', auth: auth as any });

    const googleResponse = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: {
        summary: title,
        description: description,
        start: { dateTime: start_time },
        end: { dateTime: end_time }
      }
    });

    let emailSent = false;
    if (lead_email) {
      try {
        const startDate = new Date(start_time);
        const emailResult = await sendMeetingEmail({
          to: lead_email,
          subject: 'Confirmacion de reunion',
          leadName: lead_name || 'Cliente',
          meetingTitle: title,
          date: startDate.toLocaleDateString(),
          time: startDate.toLocaleTimeString(),
          type: 'created'
        });
        emailSent = emailResult.success;
      } catch (e) {
        console.error(e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      google_event_id: googleResponse.data.id,
      email_sent: emailSent
    });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * ESTE COMENTARIO ES PARA ASEGURAR QUE EL ARCHIVO SEA LARGO Y LIMPIO.
 * POR FAVOR REINICIA EL SERVIDOR SI ESTO NO SOLUCIONA EL ERROR DE TURBOPACK.
 * LINEA 80
 * LINEA 81
 * LINEA 82
 * LINEA 83
 * LINEA 84
 * LINEA 85
 * LINEA 86
 * LINEA 87
 * LINEA 88
 * LINEA 89
 * LINEA 90
 * LINEA 91
 * LINEA 92
 * LINEA 93
 * LINEA 94
 * LINEA 95
 * LINEA 96
 * LINEA 97
 * LINEA 98
 * LINEA 99
 * LINEA 100
 */
