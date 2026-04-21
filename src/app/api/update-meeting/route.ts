import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { sendMeetingEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { 
      event_id, 
      lead_name, 
      lead_email, 
      title, 
      description, 
      start_time, 
      end_time,
      meet_link
    } = await req.json();

    if (!event_id || !start_time || !end_time) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // 1. Google Auth
    const email = process.env.GOOGLE_CLIENT_EMAIL?.trim();
    const rawKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!email || !rawKey) {
      throw new Error('Google credentials missing.');
    }

    let key = rawKey.trim();
    if (key.startsWith('"') && key.endsWith('"')) key = key.substring(1, key.length - 1);
    const formattedKey = key.replace(/\\n/g, '\n').replace(/\n/g, '\n').trim();

    const auth = new google.auth.JWT({
      email: email,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    // 2. Update in Google Calendar
    const calendar = google.calendar({ version: 'v3', auth: auth as any });
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    await calendar.events.patch({
      calendarId: calendarId,
      eventId: event_id,
      requestBody: {
        summary: title,
        description: description,
        start: { dateTime: start_time },
        end: { dateTime: end_time }
      }
    });

    // 3. Send Email Notification (Optional)
    if (lead_email) {
      const startDate = new Date(start_time);
      await sendMeetingEmail({
        to: lead_email,
        subject: 'Actualización de reunión',
        leadName: lead_name || 'Cliente',
        meetingTitle: title,
        date: startDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
        time: startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        meetingLink: meet_link,
        type: 'updated'
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error('Error updating meeting:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error al actualizar reunión' 
    }, { status: 500 });
  }
}
