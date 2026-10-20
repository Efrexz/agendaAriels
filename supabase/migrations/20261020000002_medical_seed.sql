-- M1: Datos FICTICIOS de partida (reemplazar cuando el usuario pase los reales).
-- Todo es editable desde el panel: doctores, horarios, precios y config.

-- ── Especialidades (precios ejemplo aportados por el usuario) ──
insert into public.medical_specialties (name, cost, branches) values
  ('Cardiología',   350, '{san_miguel}'),
  ('Odontología',   250, '{san_martin,los_olivos,san_miguel}'),
  ('Nutrición',     140, '{san_martin,los_olivos,san_miguel}'),
  ('Traumatología', 180, '{san_martin,los_olivos,san_miguel}'),
  ('Neurología',    150, '{san_miguel}')
on conflict (name) do nothing;

-- ── Doctores ficticios: 3 generales (uno por sede) + 5 especialistas ──
insert into public.medical_doctors (full_name, branch, kind, specialty_id, email, phone)
select 'Dr. Ejemplo Vega',    'san_martin', 'general', null, '-', '-' where not exists (select 1 from public.medical_doctors);
insert into public.medical_doctors (full_name, branch, kind, specialty_id, email, phone)
select 'Dr. Ejemplo Quispe',  'los_olivos', 'general', null, '-', '-' where not exists (select 1 from public.medical_doctors);
insert into public.medical_doctors (full_name, branch, kind, specialty_id, email, phone)
select 'Dr. Ejemplo Ramos',   'san_miguel', 'general', null, '-', '-' where not exists (select 1 from public.medical_doctors);

insert into public.medical_doctors (full_name, branch, kind, specialty_id, email, phone)
select s.full_name, s.branch, s.kind, sp.id, '-', '-'
from (values
  ('Dra. Ejemplo Torres',  'san_miguel', 'especialista', 'Cardiología'),
  ('Dra. Ejemplo Flores',  'san_martin', 'especialista', 'Odontología'),
  ('Dra. Ejemplo Soto',    'los_olivos', 'especialista', 'Nutrición'),
  ('Dr. Ejemplo Cárdenas', 'los_olivos', 'especialista', 'Traumatología'),
  ('Dr. Ejemplo Salazar',  'san_miguel', 'especialista', 'Neurología')
) as s(full_name, branch, kind, specialty_name)
join public.medical_specialties sp on sp.name = s.specialty_name
where not exists (select 1 from public.medical_doctors where kind = 'especialista');

-- ── Horarios ficticios ──
-- Generales: Lun–Sáb, mañana 9-13 y tarde 15-19
insert into public.medical_schedules (doctor_id, weekday, start_minute, end_minute)
select d.id, wd.w, 540, 780
from public.medical_doctors d,
     (values (1),(2),(3),(4),(5),(6)) as wd(w)
where d.kind = 'general'
  and not exists (select 1 from public.medical_schedules);

insert into public.medical_schedules (doctor_id, weekday, start_minute, end_minute)
select d.id, wd.w, 900, 1140
from public.medical_doctors d,
     (values (1),(2),(3),(4),(5),(6)) as wd(w)
where d.kind = 'general'
  and not exists (select 1 from public.medical_schedules where start_minute = 540);

-- Especialistas: Lun–Vie, 9-13
insert into public.medical_schedules (doctor_id, weekday, start_minute, end_minute)
select d.id, wd.w, 540, 780
from public.medical_doctors d,
     (values (1),(2),(3),(4),(5)) as wd(w)
where d.kind = 'especialista'
  and not exists (
    select 1 from public.medical_schedules ms
    join public.medical_doctors md on md.id = ms.doctor_id
    where md.kind = 'especialista'
  );

-- ── Config inicial ──
insert into public.app_config (key, value) values
  ('appt_duration_minutes', '60'),
  ('payment_info',
   'Yape/Plin: +51 900 000 000 (NÚMERO DE EJEMPLO - actualizar en Configuración del panel).' || chr(10) ||
   'Transferencia BCP: 000-0000000000-00 (NÚMERO DE EJEMPLO).')
on conflict (key) do nothing;
