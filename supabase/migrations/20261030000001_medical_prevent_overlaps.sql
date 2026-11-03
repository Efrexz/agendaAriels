-- Evita que dos reservas simultáneas ocupen al mismo doctor. La API sigue
-- comprobando horarios y ausencias; esta restricción es la última barrera
-- atómica ante peticiones concurrentes, incluso desde distintas instancias.
--
-- Antes de aplicarla hay que revisar citas activas ya solapadas o con
-- duración inválida. Si existen, PostgreSQL rechazará la migración sin
-- borrar ni modificar esas citas: deben revisarse con la clínica primero.

create extension if not exists btree_gist with schema extensions;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medical_appointments'::regclass
      and conname = 'medical_appointments_scheduled_duration_valid'
  ) then
    alter table public.medical_appointments
      add constraint medical_appointments_scheduled_duration_valid check (
        status not in ('pagado', 'asignada', 'confirmada', 'en_consulta', 'atendida')
        or doctor_id is null or appt_date is null or start_minute is null
        or (duration_minutes > 0 and start_minute >= 0 and start_minute + duration_minutes <= 1440)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medical_appointments'::regclass
      and conname = 'medical_appointments_no_doctor_overlap'
  ) then
    alter table public.medical_appointments
      add constraint medical_appointments_no_doctor_overlap
      exclude using gist (
        doctor_id with =,
        appt_date with =,
        int4range(start_minute, start_minute + duration_minutes, '[)') with &&
      ) where (
        status in ('pagado', 'asignada', 'confirmada', 'en_consulta', 'atendida')
        and doctor_id is not null and appt_date is not null and start_minute is not null
      );
  end if;
end $$;
