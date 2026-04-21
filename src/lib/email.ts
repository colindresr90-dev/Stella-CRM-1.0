import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailParams {
  to: string;
  subject: string;
  leadName: string;
  meetingTitle: string;
  date: string;
  time: string;
  meetingLink?: string;
  type: 'created' | 'updated' | 'canceled';
}

export async function sendMeetingEmail(params: EmailParams) {
  const { to, subject, leadName, meetingTitle, date, time, meetingLink, type } = params;

  // Use the public banner - in a real app this should be a full URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stella-crm.vercel.app';
  const bannerUrl = `${appUrl}/Taskmasters-Banner.png`;

  let message = '';
  let titleHeader = '';
  let showDetails = true;

  if (type === 'created') {
    titleHeader = 'Confirmación de reunión';
    message = 'Tu reunión ha sido agendada correctamente. Aquí están los detalles:';
  } else if (type === 'updated') {
    titleHeader = 'Actualización de reunión';
    message = 'Tu reunión ha sido actualizada. Por favor, revisa los nuevos detalles:';
  } else if (type === 'canceled') {
    titleHeader = 'Reunión cancelada';
    message = 'Lamentamos informarte que tu reunión ha sido cancelada.';
    showDetails = false;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden; }
        .banner { width: 100%; height: auto; display: block; }
        .content { padding: 40px; }
        .header { color: #1a1a1a; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
        .message { font-size: 16px; margin-bottom: 30px; color: #555; }
        .details-card { background-color: #f9f9fb; border-radius: 12px; padding: 25px; border: 1px solid #f0f0f4; margin-bottom: 30px; }
        .detail-item { margin-bottom: 15px; display: flex; align-items: center; }
        .detail-label { font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin-bottom: 4px; }
        .detail-value { font-size: 16px; color: #1a1a1a; font-weight: 600; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #aaa; background-color: #fafafa; }
        .note-card { 
          background-color: #fffbeb; 
          border-left: 4px solid #f59e0b; 
          padding: 20px; 
          margin-top: 25px; 
          border-radius: 4px;
        }
        .note-text { color: #92400e; font-size: 14px; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="${bannerUrl}" alt="Taskmasters Banner" class="banner" />
        <div class="content">
          <div class="header">${titleHeader}</div>
          <p class="message">Hola <strong>${leadName}</strong>,<br>${message}</p>
          
          ${showDetails ? `
            <div class="details-card">
              <div style="margin-bottom: 20px;">
                <div class="detail-label">Reunión</div>
                <div class="detail-value">${meetingTitle}</div>
              </div>
              <div style="display: flex; gap: 40px;">
                <div style="flex: 1;">
                  <div class="detail-label">Fecha</div>
                  <div class="detail-value">${date}</div>
                </div>
                <div style="flex: 1;">
                  <div class="detail-label">Hora</div>
                  <div class="detail-value">${time}</div>
                </div>
              </div>
            </div>

            <div class="note-card">
              <div class="note-text">
                <strong>Importante:</strong> En unos minutos estarás recibiendo un correo adicional con los detalles finales y el link para unirte a la reunión.
              </div>
            </div>
          ` : ''}
          
          <p style="margin-top: 30px; font-size: 14px; color: #777;">
            Si tienes alguna duda, contáctanos respondiendo a este correo.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Taskmasters Stella CRM. Todos los derechos reservados.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Stella CRM <confirmaciones@taskmasters.site>', // Updated verified domain
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('Resend Error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error('Email caught error:', err);
    return { success: false, error: err };
  }
}
