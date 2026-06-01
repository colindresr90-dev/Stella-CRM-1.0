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
    const startDate = new Date(start_time);

    let googleResponse;
    let meetLink = null;
    let conferenceError = null;

    try {
      // 1. Try to create Google Calendar event with Google Meet data
      googleResponse = await calendar.events.insert({
        calendarId: calendarId,
        conferenceDataVersion: 1,
        requestBody: {
          summary: title,
          description: description,
          start: { dateTime: start_time },
          end: { dateTime: end_time },
          conferenceData: {
            createRequest: {
              requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              conferenceSolutionKey: {
                type: 'hangoutsMeet'
              }
            }
          }
        }
      });
      meetLink = googleResponse.data.hangoutLink || null;
    } catch (insertErr) {
      // If error is invalid conference type/settings, fallback to regular calendar insert
      const errMsg = insertErr instanceof Error ? insertErr.message : '';
      const isConferenceError = 
        errMsg.includes('conference') || 
        errMsg.includes('Invalid conference') ||
        errMsg.includes('allowedConferenceSolutionTypes');

      if (isConferenceError) {
        console.warn('Google Meet generation failed (likely due to service account/calendar limitations). Retrying without conference data...');
        conferenceError = errMsg;
        googleResponse = await calendar.events.insert({
          calendarId: calendarId,
          requestBody: {
            summary: title,
            description: description,
            start: { dateTime: start_time },
            end: { dateTime: end_time }
          }
        });
      } else {
        // Rethrow other errors (auth, validation, etc.)
        throw insertErr;
      }
    }

    // 2. Send confirmation email with the Meet link (if available)
    let emailSent = false;
    if (lead_email) {
      try {
        const emailResult = await sendMeetingEmail({
          to: lead_email,
          subject: 'Confirmación de reunión',
          leadName: lead_name || 'Cliente',
          meetingTitle: title,
          date: startDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
          time: startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          meetingLink: meetLink || undefined,
          type: 'created'
        });
        emailSent = emailResult.success;
      } catch (e) {
        console.error('Error sending email:', e);
      }
    }

    return NextResponse.json({
      success: true,
      google_event_id: googleResponse.data.id,
      meet_link: meetLink,
      meet_error: conferenceError,
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
