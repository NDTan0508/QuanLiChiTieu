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
