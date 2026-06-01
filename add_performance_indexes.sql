-- ============================================================
-- Performance indexes for Stella CRM
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- Note: CONCURRENTLY removed — not allowed inside a transaction block
-- ============================================================

-- 1. leads: ordenar lista principal por fecha (leads/page.tsx)
CREATE INDEX IF NOT EXISTS idx_leads_created_at
  ON leads (created_at DESC);

-- 2. leads: filtrar por status + ordenar por fecha (customers/page.tsx)
CREATE INDEX IF NOT EXISTS idx_leads_status_created_at
  ON leads (status, created_at DESC);

-- 3. leads: filtrar por agente + rango de fechas (AgentDashboard, customers/page.tsx)
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to_created_at
  ON leads (assigned_to, created_at DESC);

-- 4. activities: buscar + ordenar actividades de un lead (query más repetida en toda la app)
CREATE INDEX IF NOT EXISTS idx_activities_lead_id_created_at
  ON activities (lead_id, created_at DESC);

-- 5. notes: buscar + ordenar notas de un lead (leads/[id]/page.tsx)
CREATE INDEX IF NOT EXISTS idx_notes_lead_id_created_at
  ON notes (lead_id, created_at DESC);

-- 6. sales: buscar + ordenar ventas de un lead (leads/[id]/page.tsx, customers/[id])
CREATE INDEX IF NOT EXISTS idx_sales_lead_id_created_at
  ON sales (lead_id, created_at DESC);

-- 7. sales: rango mensual para página de ventas y dashboard
CREATE INDEX IF NOT EXISTS idx_sales_created_at
  ON sales (created_at DESC);

-- 8. reminders: recordatorios pendientes por lead ordenados por fecha (leads/page.tsx)
CREATE INDEX IF NOT EXISTS idx_reminders_lead_is_completed_date
  ON reminders (lead_id, is_completed, date ASC, time ASC);

-- 9. files: buscar + ordenar archivos de un lead (leads/[id]/page.tsx)
CREATE INDEX IF NOT EXISTS idx_files_lead_id_created_at
  ON files (lead_id, created_at DESC);

-- 10. meetings: buscar + ordenar reuniones de un lead (leads/[id]/page.tsx)
CREATE INDEX IF NOT EXISTS idx_meetings_lead_id_start_time
  ON meetings (lead_id, start_time ASC);

-- 11. notifications: check anti-duplicados de recordatorios (lib/notifications.ts)
CREATE INDEX IF NOT EXISTS idx_notifications_dedup
  ON notifications (user_id, type, related_id, created_at DESC);
