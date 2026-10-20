-- M1: Módulo médico — citas, doctores, horarios editables, especialidades, config.
-- Mismos estándares de seguridad del grooming: RLS sin políticas (deny all),
-- acceso a datos solo desde funciones serverless con service_role.

create extension if not exists pgcrypto;

-- ── Especialidades (catálogo con costo y sedes que atienden) ──
create table if not exists public.medical_specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  cost numeric(8, 2) not null default 0,
  branches text[] not null default '{san_martin,los_olivos,san_miguel}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint branches_valid check (
    branches <@ '{san_martin,los_olivos,san_miguel}'::text[]
    and array_length(branches, 1) >= 1
  )
);

-- ── Doctores (general: sin especialidad; especialistas: con ella) ──
create table if not exists public.medical_doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  branch text not null check (branch in ('san_martin', 'los_olivos', 'san_miguel')),
  kind text not null default 'general' check (kind in ('general', 'especialista')),
  specialty_id uuid references public.medical_specialties (id) on delete set null,
  email text not null default '-',
  phone text not null default '-',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medical_doctors_branch_idx
  on public.medical_doctors (branch, kind, active);

-- ── Horario semanal por doctor (editado por counter desde el panel) ──
-- weekday: 0=domingo … 6=sábado. Minutos desde medianoche (Lima).
create table if not exists public.medical_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.medical_doctors (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_minute int not null check (start_minute between 0 and 1439),
  end_minute int not null check (end_minute between 1 and 1440),
  constraint schedule_order check (end_minute > start_minute),
  constraint schedule_unique_per_doctor unique (doctor_id, weekday, start_minute)
);

create index if not exists medical_schedules_doctor_idx on public.medical_schedules (doctor_id, weekday);

-- ── Ausencias/vacaciones por doctor (día completo o bloque) ──
create table if not exists public.medical_time_off (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.medical_doctors (id) on delete cascade,
  off_date date not null,
  start_minute int,
  end_minute int,
  reason text not null default '',
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  constraint time_off_range check (
    (start_minute is null and end_minute is null)
    or (start_minute is not null and end_minute is not null and end_minute > start_minute)
  ),
  constraint time_off_unique unique (doctor_id, off_date, start_minute)
);

-- ── Citas médicas ──
create table if not exists public.medical_appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_code text not null unique,
  branch text not null check (branch in ('san_martin', 'los_olivos', 'san_miguel')),
  service_type text not null check (service_type in ('general', 'rayos', 'eco', 'especializada')),
  specialty_id uuid references public.medical_specialties (id) on delete set null,
  doctor_id uuid references public.medical_doctors (id) on delete set null,
  appt_date date,                    -- null solo si especializada aún sin asignar
  start_minute int,                  -- null solo si especializada aún sin asignar
  duration_minutes int not null default 60,
  needs_order boolean not null default false check (needs_order in (false, true) ), -- rayos/eco
  has_order boolean,                 -- respuesta del cliente (null si no aplica)
  status text not null check (status in (
    'solicitud', 'pagado', 'asignada', 'confirmada',
    'en_consulta', 'atendida', 'no_llego', 'cancelado')),
  -- Paciente / dueño (solo lo necesario para gestionar la cita; sin historias clínicas)
  pet_name text not null,
  pet_type text not null default '-',
  pet_notes text not null default '-',
  owner_name text not null,
  owner_phone text not null,
  owner_email text not null default '-',
  payment_notes text not null default '-',
  created_by_client boolean not null default true,
  created_by text not null default '-',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- especializada y asignada SIEMPRE con fecha+hora; general/rayos/eco siempre con ellas;
  -- rayos/eco exigen orden médica sí (needs_order=true) para agendas directas
  constraint appt_date_required_for_booked check (
    (status in ('solicitud') or (appt_date is not null and start_minute is not null))
  ),
  constraint appt_order_rule check (
    service_type not in ('rayos', 'eco')
    or needs_order
  )
);

create index if not exists med_appt_date_branch_idx on public.medical_appointments (appt_date, branch);
create index if not exists med_appt_status_idx on public.medical_appointments (status);
create index if not exists med_appt_phone_idx on public.medical_appointments (owner_phone);
create index if not exists med_appt_doctor_date_idx on public.medical_appointments (doctor_id, appt_date);

-- ── Historial de estados de citas ──
create table if not exists public.medical_status_updates (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.medical_appointments (id) on delete cascade,
  status text not null,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists med_status_appt_idx
  on public.medical_status_updates (appointment_id, created_at);

-- ── Config editable desde el panel (duración cita, info de pago, etc.) ──
create table if not exists public.app_config (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- ── Triggers: updated_at ─────────────────────────────────────
drop trigger if exists med_specialties_updated_at on public.medical_specialties;
create trigger med_specialties_updated_at before update on public.medical_specialties
  for each row execute function public.set_updated_at();

drop trigger if exists med_doctors_updated_at on public.medical_doctors;
create trigger med_doctors_updated_at before update on public.medical_doctors
  for each row execute function public.set_updated_at();

drop trigger if exists med_appt_updated_at on public.medical_appointments;
create trigger med_appt_updated_at before update on public.medical_appointments
  for each row execute function public.set_updated_at();

drop trigger if exists med_config_updated_at on public.app_config;
create trigger med_config_updated_at before update on public.app_config
  for each row execute function public.set_updated_at();

-- ── RLS: denegar todo por defecto ────────────────────────────
alter table public.medical_specialties enable row level security;
alter table public.medical_doctors enable row level security;
alter table public.medical_schedules enable row level security;
alter table public.medical_time_off enable row level security;
alter table public.medical_appointments enable row level security;
alter table public.medical_status_updates enable row level security;
alter table public.app_config enable row level security;
