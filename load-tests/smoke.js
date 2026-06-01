/**
 * Smoke test — 5 VUs, 1 min
 * Verifica que el servidor responde bajo carga mínima.
 * Uso: k6 run load-tests/smoke.js -e BASE_URL=https://tu-app.vercel.app
 */
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Marca 401/403 como respuestas esperadas, no como fallos de red
export function setup() {
  return {}
}

export default function () {
  const res = http.get(`${BASE_URL}/login`, {
    tags: { name: 'login_page' },
  })
  check(res, {
    'status 200': r => r.status === 200,
    'responde en < 2s': r => r.timings.duration < 2000,
  })
  sleep(2)
}
