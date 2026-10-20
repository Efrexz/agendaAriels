-- M1b: corrección del seed — inserts idempotentes POR DOCTOR (no por tabla).
-- Agrega los 2 doctores generales faltantes y completa horarios de todos
-- los generales (mañana y tarde) sin duplicar nada existente.

insert into public.medical_doctors (full_name, branch, kind, specialty_id, email, phone)
select 'Dr. Ejemplo Quispe', 'los_olivos', 'general', null, '-', '-'
where not exists (select 1 from public.medical_doctors where full_name = 'Dr. Ejemplo Quispe');

insert into public.medical_doctors (full_name, branch, kind, specialty_id, email, phone)
select 'Dr. Ejemplo Ramos', 'san_miguel', 'general', null, '-', '-'
where not exists (select 1 from public.medical_doctors where full_name = 'Dr. Ejemplo Ramos');

-- Mañana (9-13) Lun–Sáb para TODO general sin ese bloque
insert into public.medical_schedules (doctor_id, weekday, start_minute, end_minute)
select d.id, w.w, 540, 780
from public.medical_doctors d,
     (values (1),(2),(3),(4),(5),(6)) as w(w)
where d.kind = 'general'
on conflict (doctor_id, weekday, start_minute) do nothing;

-- Tarde (15-19) Lun–Sáb para TODO general sin ese bloque
insert into public.medical_schedules (doctor_id, weekday, start_minute, end_minute)
select d.id, w.w, 900, 1140
from public.medical_doctors d,
     (values (1),(2),(3),(4),(5),(6)) as w(w)
where d.kind = 'general'
on conflict (doctor_id, weekday, start_minute) do nothing;
