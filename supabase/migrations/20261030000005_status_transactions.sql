-- Cambio de estado + historial en la misma transacción PostgreSQL.
-- Solo service_role puede invocar estas funciones; la API verifica al personal.
-- Aplicar y verificar ANTES de desplegar el código que usa estas funciones.
-- No modifica filas existentes ni completa historiales previos.

create or replace function public.api_grooming_transition(p_id uuid, p_from text, p_to text, p_actor text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.bookings set status = p_to where id = p_id and status = p_from;
  if not found then return false; end if;
  insert into public.status_updates (booking_id, status, created_by) values (p_id, p_to, p_actor);
  return true;
end;
$$;

create or replace function public.api_lab_transition(p_id uuid, p_from text, p_to text, p_actor text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.lab_orders set status = p_to where id = p_id and status = p_from;
  if not found then return false; end if;
  insert into public.lab_status_updates (order_id, status, created_by) values (p_id, p_to, p_actor);
  return true;
end;
$$;

create or replace function public.api_medical_transition(p_id uuid, p_from text, p_to text, p_actor text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.medical_appointments set status = p_to where id = p_id and status = p_from;
  if not found then return false; end if;
  insert into public.medical_status_updates (appointment_id, status, created_by) values (p_id, p_to, p_actor);
  return true;
end;
$$;

create or replace function public.api_medical_assign(p_id uuid, p_patch jsonb, p_status text, p_actor text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.medical_appointments set
    doctor_id = case when p_patch ? 'doctor_id' then (p_patch ->> 'doctor_id')::uuid else doctor_id end,
    appt_date = case when p_patch ? 'appt_date' then (p_patch ->> 'appt_date')::date else appt_date end,
    start_minute = case when p_patch ? 'start_minute' then (p_patch ->> 'start_minute')::integer else start_minute end,
    duration_minutes = case when p_patch ? 'duration_minutes' then (p_patch ->> 'duration_minutes')::integer else duration_minutes end,
    payment_notes = case when p_patch ? 'payment_notes' then p_patch ->> 'payment_notes' else payment_notes end,
    status = coalesce(p_status, status)
  where id = p_id and status = 'pagado';
  if not found then return false; end if;
  if p_status is not null then
    insert into public.medical_status_updates (appointment_id, status, created_by) values (p_id, p_status, p_actor);
  end if;
  return true;
end;
$$;

revoke all on function public.api_grooming_transition(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.api_lab_transition(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.api_medical_transition(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.api_medical_assign(uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.api_grooming_transition(uuid, text, text, text) to service_role;
grant execute on function public.api_lab_transition(uuid, text, text, text) to service_role;
grant execute on function public.api_medical_transition(uuid, text, text, text) to service_role;
grant execute on function public.api_medical_assign(uuid, jsonb, text, text) to service_role;
