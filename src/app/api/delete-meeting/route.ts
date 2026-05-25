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
      title
    } = await req.json();

    if (!event_id) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // 2. Delete from Google Calendar
    const calendar = await getGoogleCalendarClient();
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

  } catch (error) {
    console.error('Error deleting meeting:', error);
    const errorMsg = error instanceof Error ? error.message : 'Error al eliminar reunión';
    return NextResponse.json({ 
      success: false, 
      error: errorMsg 
    }, { status: 500 });
  }
}
