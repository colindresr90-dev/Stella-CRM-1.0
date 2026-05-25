import { NextResponse } from 'next/server';
import { sendMeetingEmail } from '@/lib/email';
import { requireAdminOrPermission } from '@/lib/apiAuth';
import { getGoogleCalendarClient } from '@/lib/googleCalendar';

export async function GET(req: Request) {
  const authResult = await requireAdminOrPermission(req);
  if (authResult.error) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
  }
  return NextResponse.json({ status: 'ok' });
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAdminOrPermission(req);
    if (authResult.error) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { lead_id, title, description, start_time, end_time, lead_email, lead_name } = body;

    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    if (!calendarId) {
      return NextResponse.json({ success: false, error: 'GOOGLE_CALENDAR_ID missing' }, { status: 500 });
    }

    const calendar = await getGoogleCalendarClient();

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

  } catch (err) {
    console.error(err);
    const errMsg = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
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
