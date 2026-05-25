import { NextResponse } from 'next/server';
import { sendMeetingEmail } from '@/lib/email';
import { requireAdminOrPermission } from '@/lib/apiAuth';
import { getGoogleCalendarClient } from '@/lib/googleCalendar';

export async function POST(req: Request) {
  try {
    const authResult = await requireAdminOrPermission(req);
    if (authResult.error) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }

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

    // 2. Update in Google Calendar
    const calendar = await getGoogleCalendarClient();
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

  } catch (error) {
    console.error('Error updating meeting:', error);
    const errorMsg = error instanceof Error ? error.message : 'Error al actualizar reunión';
    return NextResponse.json({ 
      success: false, 
      error: errorMsg 
    }, { status: 500 });
  }
}
