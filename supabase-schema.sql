create table if not exists public.app_snapshots (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_snapshots enable row level security;

drop policy if exists "Read encrypted snapshots" on public.app_snapshots;
drop policy if exists "Create encrypted snapshots" on public.app_snapshots;
drop policy if exists "Update encrypted snapshots" on public.app_snapshots;

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
