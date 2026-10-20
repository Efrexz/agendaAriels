-- Sistema interno de grooming: reservas, estados y días cerrados.
-- RLS activado SIN políticas: por defecto nadie del navegador puede leer.
-- El acceso a datos solo ocurre desde funciones serverless con service_role.

create extension if not exists pgcrypto;

-- ── Reservas ─────────────────────────────────────────────────
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,
  branch text not null check (branch in ('san_martin', 'los_olivos', 'san_miguel')),
  branch_label text not null,
  service_date date not null,
  time_slot text not null check (time_slot in ('9-11', '11-14')),
  owner_name text not null,
  owner_dni text not null default '-',
  owner_phone text not null,
  owner_email text not null default '-',
  owner_address text not null,
  owner_lat numeric(9, 6),
  owner_lng numeric(9, 6),
  maps_url text,
  has_history boolean,
  registered_pet_name text not null default '-',
  registered_phone text not null default '-',
  pet_birth_date text not null default '-',
  pet_species text not null default '-',
  pet_breed text not null default '-',
  pet_castrated boolean not null default false,
  mobility_phone_different boolean not null default false,
  mobility_phone text not null default '-',
  pets jsonb not null,
  status text not null default 'pendiente' check (status in (
    'pendiente', 'en_camino_recojo', 'recibido', 'en_bano', 'en_secado',
    'en_corte', 'listo', 'en_camino_entrega', 'entregado', 'cancelado')),
  whatsapp_delivered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_date_branch_idx on public.bookings (service_date, branch);
create index if not exists bookings_phone_idx on public.bookings (owner_phone);
create index if not exists bookings_status_idx on public.bookings (status);

-- ── Historial de estados (alimenta el log del día y la página del cliente) ──
create table if not exists public.status_updates (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  status text not null,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists status_updates_booking_idx
  on public.status_updates (booking_id, created_at);

-- ── Días/franjas cerradas por el staff (calendario rojo "Ocupado") ──
create table if not exists public.day_closures (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch in ('san_martin', 'los_olivos', 'san_miguel')),
  closure_date date not null,
  time_slot text check (time_slot in ('9-11', '11-14')),
  reason text not null default '',
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

-- time_slot null = día completo; coalesce evita colisión entre null y franja
create unique index if not exists day_closures_unique_idx
  on public.day_closures (branch, closure_date, coalesce(time_slot, 'ALL'));

-- ── updated_at automático ────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ── RLS: denegar todo por defecto (sin políticas) ────────────
alter table public.bookings enable row level security;
alter table public.status_updates enable row level security;
alter table public.day_closures enable row level security;
