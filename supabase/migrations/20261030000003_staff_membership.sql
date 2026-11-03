-- Solo estructura. No crea cuentas ni concede acceso automáticamente.
-- El backend nuevo deniega todo el panel mientras no existan miembros activos.
create table if not exists public.staff_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.staff_users enable row level security;
revoke all on public.staff_users from public, anon, authenticated;
grant select on public.staff_users to authenticated;
grant all on public.staff_users to service_role;

drop policy if exists "staff read own membership" on public.staff_users;
create policy "staff read own membership" on public.staff_users
  for select to authenticated using (user_id = (select auth.uid()));
