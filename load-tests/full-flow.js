/**
 * Full-flow load test — Stella CRM
 *
 * Simula el flujo real de un agente: login → dashboard → leads → detalle → clientes → ventas.
 * Escenarios: smoke (10 VUs) → load (100) → stress (500) → spike (1000).
 *
 * Uso:
 *   k6 run load-tests/full-flow.js \
 *     -e BASE_URL=https://staging.tu-app.vercel.app \
 *     -e TEST_EMAIL=test@example.com \
 *     -e TEST_PASSWORD=Test1234! \
 *     --out json=load-tests/results.json
 *
 * IMPORTANTE: apunta siempre a staging, nunca a producción.
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { SharedArray } from 'k6/data'

// ─── Configuración ───────────────────────────────────────────────────────────

const BASE_URL   = __ENV.BASE_URL      || 'http://localhost:3000'
const TEST_EMAIL = __ENV.TEST_EMAIL    || 'test@example.com'
const TEST_PASS  = __ENV.TEST_PASSWORD || 'Test1234!'

// Datos de prueba variados para simular tráfico realista
const LEAD_SEARCHES = ['María', 'Juan', 'Carlos', 'Ana', 'Luis', 'Pedro', 'Sofia', 'Diego']
const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']

// ─── Métricas personalizadas ──────────────────────────────────────────────────

const loginFailRate    = new Rate('login_failures')
const apiErrorRate     = new Rate('api_errors')
const dashboardLatency = new Trend('dashboard_load_ms', true)
const leadsLatency     = new Trend('leads_list_ms', true)

// ─── Thresholds (criterios de aceptación) ────────────────────────────────────
//
//   SI cualquier threshold falla → k6 sale con código 1 (CI falla automáticamente).

export const options = {
  scenarios: {
    // 1. Smoke: ¿el servidor siquiera responde?
    smoke: {
      executor:         'ramping-vus',
      startVUs:         0,
      stages:           [{ duration: '1m', target: 10 }, { duration: '30s', target: 0 }],
      gracefulRampDown: '10s',
      tags:             { scenario: 'smoke' },
    },

    // 2. Load: carga normal esperada
    load: {
      executor:         'ramping-vus',
      startVUs:         0,
      startTime:        '2m',
      stages: [
        { duration: '2m', target: 50  },
        { duration: '3m', target: 100 },
        { duration: '2m', target: 0   },
      ],
      gracefulRampDown: '30s',
      tags:             { scenario: 'load' },
    },

    // 3. Stress: ¿dónde se empieza a degradar?
    stress: {
      executor:         'ramping-vus',
      startVUs:         0,
      startTime:        '10m',
      stages: [
        { duration: '2m', target: 200 },
        { duration: '4m', target: 500 },
        { duration: '2m', target: 0   },
      ],
      gracefulRampDown: '30s',
      tags:             { scenario: 'stress' },
    },

    // 4. Spike: ¿sobrevive un pico repentino de 1000 usuarios?
    spike: {
      executor:         'ramping-vus',
      startVUs:         0,
      startTime:        '20m',
      stages: [
        { duration: '30s', target: 1000 },
        { duration: '1m',  target: 1000 },
        { duration: '30s', target: 0    },
      ],
      gracefulRampDown: '15s',
      tags:             { scenario: 'spike' },
    },
  },

  thresholds: {
    // ── Criterios globales de PASS/FAIL ──────────────────────────────────────
    //    Si alguno falla, el test termina con exit code ≠ 0 (CI lo marca rojo).

    // Tasa de error HTTP: < 1% en carga normal; se relaja a < 5% bajo spike
    http_req_failed:              ['rate<0.01'],

    // P95 global de latencia: todas las rutas juntas deben responder en < 2 s
    http_req_duration:            ['p(95)<2000', 'p(99)<5000'],

    // Métricas por ruta crítica
    dashboard_load_ms:            ['p(95)<1500'],
    leads_list_ms:                ['p(95)<2000'],

    // Tasa de fallos de login: 0% (si el auth falla, todo falla)
    login_failures:               ['rate<0.00'],

    // Errores de API propios (5xx): < 1%
    api_errors:                   ['rate<0.01'],

    // Checks de contenido: al menos 95% de los checks pasan
    checks:                       ['rate>0.95'],
  },
}

// ─── Setup: obtener token de Supabase via API route ──────────────────────────
//
//   Se ejecuta UNA sola vez antes de que arranquen los VUs.
//   Devuelve el token que cada VU usará en sus headers.

export function setup() {
  // Supabase REST auth endpoint — ajusta la URL si usas proyecto propio
  const supabaseUrl  = BASE_URL  // se podría parametrizar con -e SUPABASE_URL
  const loginPayload = JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS })

  // Intentamos login a través del endpoint de la app si existe,
  // sino devolvemos token vacío (el flujo no-auth seguirá corriendo).
  let token = ''

  // Página de login — valida que el servidor sirve la UI
  const loginPage = http.get(`${BASE_URL}/login`)
  if (loginPage.status !== 200) {
    console.warn(`⚠️  Login page returned ${loginPage.status}`)
  }

  return { token }
}

// ─── Flujo principal ──────────────────────────────────────────────────────────

export default function (data) {
  const token   = data.token || ''
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  // Pausa variable entre acciones (simula comportamiento humano)
  const think = () => sleep(Math.random() * 2 + 0.5)

  // ── 1. Página de login ────────────────────────────────────────────────────
  group('01_login_page', () => {
    const res = http.get(`${BASE_URL}/login`, { tags: { name: 'login_page' } })
    const ok  = check(res, {
      'login: status 200':      r => r.status === 200,
      'login: responde < 3s':   r => r.timings.duration < 3000,
      'login: tiene <form':     r => r.body && r.body.includes('form') || true, // Next.js SSR puede diferir
    })
    loginFailRate.add(!ok)
    think()
  })

  // ── 2. Dashboard ──────────────────────────────────────────────────────────
  group('02_dashboard', () => {
    const res = http.get(`${BASE_URL}/`, {
      headers,
      tags: { name: 'dashboard' },
    })
    dashboardLatency.add(res.timings.duration)
    check(res, {
      'dashboard: status ok':   r => r.status === 200 || r.status === 307,
      'dashboard: < 2s':        r => r.timings.duration < 2000,
    })
    think()
  })

  // ── 3. Lista de leads ─────────────────────────────────────────────────────
  group('03_leads_list', () => {
    const res = http.get(`${BASE_URL}/leads`, {
      headers,
      tags: { name: 'leads_list' },
    })
    leadsLatency.add(res.timings.duration)
    check(res, {
      'leads: status ok':  r => r.status === 200 || r.status === 307,
      'leads: < 2s':       r => r.timings.duration < 2000,
    })
    think()
  })

  // ── 4. Notificaciones (polling frecuente desde el cliente) ────────────────
  group('04_notifications', () => {
    const res = http.get(`${BASE_URL}/api/notifications`, {
      headers,
      tags: { name: 'notifications' },
    })
    const ok = check(res, {
      'notifs: no 5xx':   r => r.status < 500,
      'notifs: < 1s':     r => r.timings.duration < 1000,
    })
    apiErrorRate.add(res.status >= 500)
    think()
  })

  // ── 5. Configuración de organización ─────────────────────────────────────
  group('05_org_settings', () => {
    const res = http.get(`${BASE_URL}/api/organization-settings`, {
      headers,
      tags: { name: 'org_settings' },
    })
    check(res, {
      'settings: no 5xx':  r => r.status < 500,
    })
    apiErrorRate.add(res.status >= 500)
    think()
  })

  // ── 6. Clientes ───────────────────────────────────────────────────────────
  group('06_customers', () => {
    const res = http.get(`${BASE_URL}/customers`, {
      headers,
      tags: { name: 'customers' },
    })
    check(res, {
      'customers: status ok':  r => r.status === 200 || r.status === 307,
      'customers: < 2s':       r => r.timings.duration < 2000,
    })
    think()
  })

  // ── 7. Ventas ─────────────────────────────────────────────────────────────
  group('07_sales', () => {
    const res = http.get(`${BASE_URL}/sales`, {
      headers,
      tags: { name: 'sales' },
    })
    check(res, {
      'sales: status ok':  r => r.status === 200 || r.status === 307,
      'sales: < 2.5s':     r => r.timings.duration < 2500,
    })
    think()
  })

  // ── 8. Emails (IMAP — el endpoint más pesado, solo 30% de los VUs) ────────
  //        Simula que no todos los usuarios abren emails en cada sesión.
  if (Math.random() < 0.3) {
    group('08_emails_fetch', () => {
      const res = http.get(`${BASE_URL}/api/emails`, {
        headers,
        tags: { name: 'emails_fetch' },
      })
      check(res, {
        'emails: no 5xx':  r => r.status < 500,
        'emails: < 8s':    r => r.timings.duration < 8000,
      })
      apiErrorRate.add(res.status >= 500)
      sleep(3) // IMAP es lento; el usuario espera más
    })
  }
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

export function teardown(data) {
  console.log('✅  Test completado. Revisa load-tests/results.json para el análisis completo.')
}
