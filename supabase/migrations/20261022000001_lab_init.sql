-- LAB LABORATORIO: reemplazo digital del cuaderno de exámenes externos.
-- Patrón espejo de medical_appointments/medical_status_updates:
-- RLS deny-all (acceso solo desde api/ con service_role), timeline de
-- quién+cuándo, códigos LAB-XXXXX generados server-side.
-- Cross-sede: sede_origen (quién registra, auto) + sede_responsable
-- (dónde se entrega/atención a la que pertenece el examen).

create table if not exists public.lab_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,                       -- LAB-XXXXX
  sede_origen text not null check (sede_origen in ('san_martin', 'los_olivos', 'san_miguel')),
  sede_responsable text not null check (sede_responsable in ('san_martin', 'los_olivos', 'san_miguel')),
  lab_name text not null,                                -- laboratorio externo
  exam_type text not null,
  pet_name text not null,
  pet_type text not null default '-',
  history_code text not null default '-',                -- # historia de VetPraxis (texto)
  doctor_name text not null default '-',                 -- médico que solicita (opcional)
  owner_name text not null,
  owner_phone text not null,                             -- obligatorio: WhatsApp "resultado listo"
  paid_notes text not null default '-',                  -- monto/comprobante (opcional)
  notes text not null default '-',
  status text not null check (status in (
    'recibida', 'en_laboratorio', 'resultado_listo', 'entregada', 'cancelado')),
  created_by text not null default '-',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lab_orders_sede_origen_idx on public.lab_orders (sede_origen);
create index if not exists lab_orders_sede_resp_idx on public.lab_orders (sede_responsable);
create index if not exists lab_orders_status_idx on public.lab_orders (status);
create index if not exists lab_orders_phone_idx on public.lab_orders (owner_phone);
create index if not exists lab_orders_created_idx on public.lab_orders (created_at desc);

-- Historial de estados (quién + cuándo, como status_updates del resto del sistema)
create table if not exists public.lab_status_updates (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.lab_orders (id) on delete cascade,
  status text not null,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists lab_status_order_idx
  on public.lab_status_updates (order_id, created_at);

-- Trigger updated_at (función compartida creada en la migración inicial)
drop trigger if exists lab_orders_set_updated_at on public.lab_orders;
create trigger lab_orders_set_updated_at
  before update on public.lab_orders
  for each row execute function public.set_updated_at();
