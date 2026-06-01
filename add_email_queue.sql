-- Run this in Supabase SQL Editor
create table if not exists email_queue (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid references auth.users(id),
  lead_id      uuid,
  "to"         text not null,
  subject      text not null,
  html_text    text not null,
  cc           text,
  bcc          text,
  attachments  jsonb,
  status       text not null default 'pending'
                 check (status in ('pending','processing','sent','failed')),
  attempts     int  not null default 0,
  max_attempts int  not null default 3,
  error        text,
  message_id   text,
  created_at   timestamptz not null default now(),
  retry_after  timestamptz,
  processed_at timestamptz
);

-- Add retry_after if the table was already created without it
alter table email_queue add column if not exists retry_after timestamptz;

-- Fast claim query: only index pending rows
create index if not exists email_queue_pending_idx
  on email_queue (created_at)
  where status = 'pending';

-- RLS: users can only see their own queued emails
alter table email_queue enable row level security;

create policy "Users see own jobs"
  on email_queue for select
  using (created_by = auth.uid());

-- Service role bypasses RLS (used by the worker)
