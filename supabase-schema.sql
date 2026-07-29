create table if not exists public.app_snapshots (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_snapshots enable row level security;

drop policy if exists "Read encrypted snapshots" on public.app_snapshots;
drop policy if exists "Create encrypted snapshots" on public.app_snapshots;
drop policy if exists "Update encrypted snapshots" on public.app_snapshots;
drop policy if exists "Delete encrypted snapshots" on public.app_snapshots;

create policy "Read encrypted snapshots"
on public.app_snapshots
for select
to anon
using (true);

create policy "Create encrypted snapshots"
on public.app_snapshots
for insert
to anon
with check (true);

create policy "Update encrypted snapshots"
on public.app_snapshots
for update
to anon
using (true)
with check (true);

create policy "Delete encrypted snapshots"
on public.app_snapshots
for delete
to anon
using (true);

create table if not exists public.app_admin_settings (
  id text primary key,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_admin_settings (id, password_hash)
values ('default', '83e9887aca4b4c1d7b8688d6392c5f20c77a1dc405c3d5406918c46c68da6063')
on conflict (id) do nothing;

alter table public.app_admin_settings enable row level security;

drop policy if exists "Read admin settings" on public.app_admin_settings;

create policy "Read admin settings"
on public.app_admin_settings
for select
to anon
using (true);

create table if not exists public.btc_usdt_topups (
  id text primary key,
  account_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.btc_dca_plans (
  id text primary key,
  account_id text not null,
  payload jsonb not null,
  is_active boolean not null default true,
  next_run_at timestamptz,
  status text not null default 'active',
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.btc_trades (
  id text primary key,
  account_id text not null,
  payload jsonb not null,
  plan_id text,
  executed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.btc_transfers (
  id text primary key,
  account_id text not null,
  payload jsonb not null,
  transfer_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_job_runs (
  job_name text primary key,
  last_run_at timestamptz not null default now(),
  processed integer not null default 0,
  created integer not null default 0,
  skipped integer not null default 0,
  error text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists btc_usdt_topups_account_id_idx on public.btc_usdt_topups (account_id);
create index if not exists btc_dca_plans_due_idx on public.btc_dca_plans (is_active, next_run_at);
create index if not exists btc_dca_plans_account_id_idx on public.btc_dca_plans (account_id);
create index if not exists btc_trades_account_id_idx on public.btc_trades (account_id);
create index if not exists btc_transfers_account_id_idx on public.btc_transfers (account_id);

alter table public.btc_usdt_topups enable row level security;
alter table public.btc_dca_plans enable row level security;
alter table public.btc_trades enable row level security;
alter table public.btc_transfers enable row level security;
alter table public.app_job_runs enable row level security;

drop policy if exists "Read BTC USDT topups" on public.btc_usdt_topups;
drop policy if exists "Write BTC USDT topups" on public.btc_usdt_topups;
drop policy if exists "Read BTC DCA plans" on public.btc_dca_plans;
drop policy if exists "Write BTC DCA plans" on public.btc_dca_plans;
drop policy if exists "Read BTC trades" on public.btc_trades;
drop policy if exists "Write BTC trades" on public.btc_trades;
drop policy if exists "Read BTC transfers" on public.btc_transfers;
drop policy if exists "Write BTC transfers" on public.btc_transfers;

drop policy if exists "Read app job runs" on public.app_job_runs;
drop policy if exists "Write app job runs" on public.app_job_runs;

create policy "Read BTC USDT topups" on public.btc_usdt_topups for select to anon using (true);
create policy "Write BTC USDT topups" on public.btc_usdt_topups for all to anon using (true) with check (true);
create policy "Read BTC DCA plans" on public.btc_dca_plans for select to anon using (true);
create policy "Write BTC DCA plans" on public.btc_dca_plans for all to anon using (true) with check (true);
create policy "Read BTC trades" on public.btc_trades for select to anon using (true);
create policy "Write BTC trades" on public.btc_trades for all to anon using (true) with check (true);
create policy "Read BTC transfers" on public.btc_transfers for select to anon using (true);
create policy "Write BTC transfers" on public.btc_transfers for all to anon using (true) with check (true);
create policy "Read app job runs" on public.app_job_runs for select to anon using (true);

-- Supabase Cron setup after deploying supabase/functions/btc-dca-runner:
-- 1. Enable pg_cron and pg_net in the Supabase dashboard.
-- 2. Store project_url and service_role_key in Vault.
-- 3. Schedule this job:
-- select cron.schedule(
--   'btc-dca-runner-every-minute',
--   '* * * * *',
--   $$
--   select net.http_post(
--     url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/btc-dca-runner',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
--     ),
--     body := jsonb_build_object('time', now())
--   );
--   $$
-- );
