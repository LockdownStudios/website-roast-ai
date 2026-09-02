-- Website Roast AI payment audit trail
-- Run this in the Roast AI Supabase SQL editor before relying on payment analytics.

create table if not exists public.payment_transactions (
  reference text primary key,
  report_id uuid not null references public.roast_reports(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  email text null,
  amount_kobo integer not null check (amount_kobo > 0),
  currency text not null default 'ZAR',
  status text not null check (
    status in (
      'initialized',
      'success',
      'failed',
      'webhook_success',
      'webhook_ignored'
    )
  ),
  provider_status text null,
  provider_message text null,
  authorization_url text null,
  metadata jsonb null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_transactions_report_id_idx
  on public.payment_transactions (report_id, created_at desc);

create index if not exists payment_transactions_status_idx
  on public.payment_transactions (status, created_at desc);

create index if not exists payment_transactions_created_at_idx
  on public.payment_transactions (created_at desc);
