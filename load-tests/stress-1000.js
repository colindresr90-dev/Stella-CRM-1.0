/**
 * Stress test — rampa hasta 1000 VUs
 * Objetivo: encontrar el punto de quiebre. Espera errores 503 / timeouts.
 * Uso: k6 run load-tests/stress-1000.js -e BASE_URL=https://tu-app.vercel.app -e TOKEN=<jwt>
 *
 * ADVERTENCIA: corre esto contra un entorno de staging, no producción.
 * Vercel Free/Pro puede throttle o suspender funciones serverless bajo esta carga.
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

export const options = {
  stages: [
    { duration: '2m', target: 100  },
    { duration: '3m', target: 300  },
    { duration: '3m', target: 600  },
    { duration: '3m', target: 1000 },
    { duration: '2m', target: 0    },
  ],
  thresholds: {
    http_req_failed:   ['rate<0.10'],    // falla si > 10% errores
    http_req_duration: ['p(95)<5000'],   // p95 < 5s bajo estrés máximo
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const TOKEN    = __ENV.TOKEN    || ''

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
}

// Endpoints ligeros — no IMAP bajo stress máximo
const endpoints = [
  '/api/notifications',
  '/api/organization-settings',
]

export default function () {
  const url = endpoints[Math.floor(Math.random() * endpoints.length)]
  const res = http.get(`${BASE_URL}${url}`, { headers })
  check(res, { 'status < 500': r => r.status < 500 })
  sleep(0.5)
}
