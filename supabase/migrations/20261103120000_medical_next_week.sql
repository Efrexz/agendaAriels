-- M2 (opción B): Solicitudes de PRÓXIMA semana.
-- La agenda se publica cada lunes: la semana en curso se agenda con hora fija
-- (como siempre) y la PRÓXIMA semana el cliente deja solicitud con su día
-- preferido SIN hora; el counter la confirma con la agenda real y el cliente
-- recibe el WhatsApp con fecha/hora/doctor.
-- No modifica datos. Verificación previa en BD aislada antes de aplicar.
-- 1) nueva regla: fecha+hora completas, o (hora nula y estado que aún no la fija)
do $$ begin
  if exists (
    select 1 from public.medical_appointments
    where not (
      (appt_date is not null and start_minute is not null)
      or (start_minute is null and status in ('solicitud', 'pagado', 'cancelado'))
    )
  ) then raise exception 'Filas existentes no cumplen la nueva regla: revisar antes';
  end if;
end $$;

alter table public.medical_appointments drop constraint if exists appt_date_required_for_booked;
alter table public.medical_appointments add constraint appt_date_required_for_booked check (
  (appt_date is not null and start_minute is not null)
  or (start_minute is null and status in ('solicitud', 'pagado', 'cancelado'))
);

-- 2) assignment condicionada al estado OBSERVADO (pagado por defecto; solicitud
--    para las solicitudes de próxima semana). Resto del comportamiento igual.
create or replace function public.api_medical_assign(p_id uuid, p_patch jsonb, p_status text, p_actor text, p_from text default 'pagado')
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.medical_appointments set
    doctor_id = case when p_patch ? 'doctor_id' then (p_patch ->> 'doctor_id')::uuid else doctor_id end,
    appt_date = case when p_patch ? 'appt_date' then (p_patch ->> 'appt_date')::date else appt_date end,
    start_minute = case when p_patch ? 'start_minute' then (p_patch ->> 'start_minute')::integer else start_minute end,
    duration_minutes = case when p_patch ? 'duration_minutes' then (p_patch ->> 'duration_minutes')::integer else duration_minutes end,
    payment_notes = case when p_patch ? 'payment_notes' then p_patch ->> 'payment_notes' else payment_notes end,
    status = coalesce(p_status, status)
  where id = p_id and status = coalesce(p_from, status);
  if not found then return false; end if;
  if p_status is not null then
    insert into public.medical_status_updates (appointment_id, status, created_by) values (p_id, p_status, p_actor);
  end if;
  return true;
end;
$$;

revoke all on function public.api_medical_assign(uuid, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.api_medical_assign(uuid, jsonb, text, text, text) to service_role;
