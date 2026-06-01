/**
 * Load test — rampa hasta 100 VUs
 * Uso: k6 run load-tests/load-100.js -e BASE_URL=https://tu-app.vercel.app -e TOKEN=<jwt>
 *
 * TOKEN: en el browser de la app abre DevTools > Console y ejecuta:
 *   (await supabase.auth.getSession()).data.session.access_token
 */
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '1m', target: 25  },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0   },
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<4000'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const TOKEN    = __ENV.TOKEN    || ''

export default function () {
  // Sin auth: página de login
  const login = http.get(`${BASE_URL}/login`)
  check(login, { 'login 200': r => r.status === 200 })
  sleep(1)

  // Con auth: endpoints protegidos — solo si TOKEN está disponible
  if (TOKEN) {
    const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

    // Notificaciones — ruta más frecuente
    const notifs = http.get(`${BASE_URL}/api/notifications`, { headers })
    check(notifs, { 'notifications 200': r => r.status === 200 })
    sleep(1)

    // IMAP email fetch — el endpoint más pesado
    const emails = http.get(`${BASE_URL}/api/emails?email=test@example.com`, { headers })
    check(emails, { 'emails < 500': r => r.status < 500 })
    sleep(2)
  } else {
    sleep(3)
  }
}
