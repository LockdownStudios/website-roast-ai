-- Roast AI Supabase project. Separate from the legacy queue; no report rewrites.
create table if not exists public.roast_jobs_v2 (
 id uuid primary key default gen_random_uuid(), owner_id text not null,
 channel text not null check(channel in ('office','public')), url text not null,
 profile text not null check(profile in ('outreach','full')),
 status text not null default 'queued' check(status in ('queued','running','complete','partial','failed')),
 stages jsonb not null default '{}', checkpoint jsonb not null default '{}', result jsonb,
 lease_token uuid, lease_until timestamptz, ai_started boolean not null default false,
 cancel_requested boolean not null default false, attempts integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.roast_jobs_v2 add column if not exists priority integer not null default 0 check(priority between 0 and 10);
alter table public.roast_jobs_v2 enable row level security;
revoke all on public.roast_jobs_v2 from public, anon, authenticated;
grant select,insert,update on public.roast_jobs_v2 to service_role;
create unique index if not exists roast_jobs_v2_active on public.roast_jobs_v2(owner_id,channel,url,profile) where status in ('queued','running');
create index if not exists roast_jobs_v2_pending on public.roast_jobs_v2(status,created_at);
create or replace function public.claim_roast_job_v2() returns setof public.roast_jobs_v2
language plpgsql security definer set search_path=public as $$
begin
 update roast_jobs_v2 set status=case when result is null then 'failed' else 'partial' end,updated_at=now(),
 stages=jsonb_set(stages,'{report}',jsonb_build_object('status','unavailable','message','Cancelled before processing; no AI request was made.','at',now()))
 where status='queued' and cancel_requested;
 -- Never repeat a potentially billed AI stage after worker loss.
 update roast_jobs_v2 set status=case when result is null then 'failed' else 'partial' end,
 updated_at=now(),lease_token=null,lease_until=null,
 stages=jsonb_set(coalesce((select jsonb_object_agg(key,case when value->>'status' in ('running','queued') then jsonb_build_object('status','unavailable','message','Worker interrupted; this stage was not confirmed complete.','at',now()) else value end) from jsonb_each(stages)),'{}'::jsonb),'{report}',jsonb_build_object('status','unavailable','message','Worker interrupted; saved checkpoints retained. No automatic paid retry.','at',now()))
 where status='running' and lease_until<now() and (ai_started or attempts>=2);
 update roast_jobs_v2 set status='queued',lease_token=null,lease_until=null,updated_at=now()
 where status='running' and lease_until<now() and not ai_started and attempts<2;
 return query with candidate as (
 select id from roast_jobs_v2 where status='queued' and not cancel_requested order by priority desc,created_at,id for update skip locked limit 1
 ) update roast_jobs_v2 j set status='running',attempts=j.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
 from candidate c where j.id=c.id returning j.*;
end; $$;
revoke all on function public.claim_roast_job_v2() from public,anon,authenticated;
grant execute on function public.claim_roast_job_v2() to service_role;
create table if not exists public.roast_workers_v2(id uuid primary key, heartbeat_at timestamptz not null default now());
alter table public.roast_workers_v2 enable row level security;
revoke all on public.roast_workers_v2 from public,anon,authenticated;
grant select,insert,update on public.roast_workers_v2 to service_role;

-- Large raw diagnostics are private artifacts, never copied into polling responses.
create table if not exists public.roast_artifacts_v2 (
 job_id uuid not null references public.roast_jobs_v2(id) on delete cascade,
 device text not null check(device in ('mobile','desktop')),
 payload jsonb not null, created_at timestamptz not null default now(),
 primary key(job_id,device)
);
alter table public.roast_artifacts_v2 enable row level security;
revoke all on public.roast_artifacts_v2 from public,anon,authenticated;
grant select,insert,update,delete on public.roast_artifacts_v2 to service_role;
create index if not exists roast_artifacts_v2_created on public.roast_artifacts_v2(created_at);
create or replace function public.prune_roast_artifacts_v2() returns void
language plpgsql security definer set search_path=public as $$
begin
 delete from roast_artifacts_v2 where created_at<now()-interval '30 days';
 update roast_jobs_v2 set checkpoint=checkpoint-'scraped'-'visual'-'preview'
 where status in ('complete','partial','failed') and updated_at<now()-interval '30 days'
 and (checkpoint ? 'scraped' or checkpoint ? 'visual' or checkpoint ? 'preview');
 delete from roast_workers_v2 where heartbeat_at<now()-interval '1 day';
end; $$;
revoke all on function public.prune_roast_artifacts_v2() from public,anon,authenticated;
grant execute on function public.prune_roast_artifacts_v2() to service_role;
