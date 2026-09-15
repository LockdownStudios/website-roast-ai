-- Durable queue for long-running Website Roast AI scans.
-- Apply in the Roast AI Supabase SQL editor before enabling ROAST_ASYNC_JOBS.

create table if not exists public.roast_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 2 check (max_attempts between 1 and 5),
  report_id uuid references public.roast_reports(id) on delete set null,
  error_message text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists roast_scan_jobs_pending_idx
  on public.roast_scan_jobs (status, created_at)
  where status in ('queued', 'running');

create index if not exists roast_scan_jobs_user_created_idx
  on public.roast_scan_jobs (user_id, created_at desc);

create or replace function public.claim_next_roast_scan_job()
returns public.roast_scan_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.roast_scan_jobs;
begin
  update public.roast_scan_jobs
  set status = 'queued', locked_at = null, updated_at = now()
  where status = 'running'
    and locked_at < now() - interval '15 minutes';

  with candidate as (
    select id
    from public.roast_scan_jobs
    where status = 'queued' and attempts < max_attempts
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.roast_scan_jobs jobs
  set status = 'running', attempts = jobs.attempts + 1, locked_at = now(), updated_at = now()
  from candidate
  where jobs.id = candidate.id
  returning jobs.* into claimed;

  return claimed;
end;
$$;

alter table public.roast_scan_jobs enable row level security;
-- Application access uses the service role. Do not expose anonymous job reads.
