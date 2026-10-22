-- LAB 2: catálogos persistentes de tipos de examen y laboratorios externos.
-- Global único (todas las sedes comparten: los labs hacen los mismos exámenes).
-- El counter agrega nuevos (exam o lab) desde el modal → quedan para todos.
-- Seed: laboratorios reales (usuario 2026-10-22) + presets de examen.

create table if not exists public.lab_exam_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lab_labs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists lab_exam_types_active_idx on public.lab_exam_types (active, name);
create index if not exists lab_labs_active_idx on public.lab_labs (active, name);

-- Seeds idempotentes (no duplicar en re-aplicación)
insert into public.lab_labs (name)
select v.name from unnest(array['VetSupport', 'AR Bioanálisis', 'SF Laboratorio', 'Hemovet', 'CediVet']) as v(name)
where not exists (select 1 from public.lab_labs where name = v.name);

insert into public.lab_exam_types (name)
select v.name from unnest(array[
  'Perfil prequirúrgico', 'Hematología', 'Perfil hepático', 'Perfil renal',
  'Citología', 'Urocultivo', 'Heces', 'Cortisol'
]) as v(name)
where not exists (select 1 from public.lab_exam_types where name = v.name);

select (select count(*) from public.lab_labs) as labs, (select count(*) from public.lab_exam_types) as exams;
