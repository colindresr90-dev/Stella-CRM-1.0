import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { sendMeetingEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { 
      event_id, 
      lead_name, 
      lead_email, 
      title
    } = await req.json();

    if (!event_id) {
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

    // 2. Delete from Google Calendar
    const calendar = google.calendar({ version: 'v3', auth: auth as any });
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    await calendar.events.delete({
      calendarId: calendarId,
      eventId: event_id
    });

    // 3. Send Email Notification (Optional)
    if (lead_email) {
      await sendMeetingEmail({
        to: lead_email,
        subject: 'Reunión cancelada',
        leadName: lead_name || 'Cliente',
        meetingTitle: title,
        date: '',
        time: '',
        type: 'canceled'
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error('Error deleting meeting:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error al eliminar reunión' 
    }, { status: 500 });
  }
}
