-- Run in Roast AI Supabase, not the Office project. No customer/report data is changed.
create table if not exists public.roast_ai_runs (
  id uuid primary key,
  actor_hash text not null,
  channel text not null check (channel in ('public','office','development')),
  site_hash text not null,
  model text not null,
  reserved_units bigint not null check (reserved_units > 0),
  status text not null default 'reserved' check (status in ('reserved','completed','failed')),
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  model_calls integer not null default 0,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists roast_ai_runs_created_idx on public.roast_ai_runs(created_at);
create index if not exists roast_ai_runs_actor_created_idx on public.roast_ai_runs(actor_hash, created_at);
alter table public.roast_ai_runs enable row level security;
revoke all on public.roast_ai_runs from anon, authenticated;
grant select, insert, update on public.roast_ai_runs to service_role;

create or replace function public.reserve_roast_ai_run(
  p_id uuid, p_actor text, p_channel text, p_site text, p_model text,
  p_units bigint, p_actor_limit integer, p_global_limit integer,
  p_daily_units bigint, p_monthly_units bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
begin
  if p_units <= 0 or p_actor_limit <= 0 or p_global_limit <= 0 or p_daily_units <= 0 or p_monthly_units <= 0
    then return jsonb_build_object('allowed', false); end if;
  -- One transaction-level lock serializes reservations across all server instances.
  perform pg_advisory_xact_lock(20261015, 1);
  if exists (select 1 from public.roast_ai_runs where id = p_id) then
    return jsonb_build_object('allowed', false);
  end if;
  if (select count(*) from public.roast_ai_runs where actor_hash = p_actor and created_at >= day_start) >= p_actor_limit
    or exists (select 1 from public.roast_ai_runs where error_code = 'provider-quota' and created_at > now() - interval '1 hour')
    or (select count(*) from public.roast_ai_runs where created_at >= day_start) >= p_global_limit
    or (select coalesce(sum(reserved_units),0) from public.roast_ai_runs where created_at >= day_start) + p_units > p_daily_units
    or (select coalesce(sum(reserved_units),0) from public.roast_ai_runs where created_at >= month_start) + p_units > p_monthly_units
    or exists (select 1 from public.roast_ai_runs where actor_hash = p_actor and created_at > now() - interval '10 minutes'
      and (site_hash = p_site or status = 'reserved'))
    then return jsonb_build_object('allowed', false); end if;
  insert into public.roast_ai_runs(id,actor_hash,channel,site_hash,model,reserved_units)
    values(p_id,p_actor,p_channel,p_site,p_model,p_units);
  return jsonb_build_object('allowed', true);
end;
$$;
revoke all on function public.reserve_roast_ai_run(uuid,text,text,text,text,bigint,integer,integer,bigint,bigint) from public, anon, authenticated;
grant execute on function public.reserve_roast_ai_run(uuid,text,text,text,text,bigint,integer,integer,bigint,bigint) to service_role;
