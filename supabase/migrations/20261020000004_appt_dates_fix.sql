-- M1c: el flujo especializada puede estar en 'pagado' SIN fecha aún
-- (el pago se verifica antes de que counter asigne doctor/fecha/hora).

alter table public.medical_appointments
  drop constraint if exists appt_date_required_for_booked;

alter table public.medical_appointments
  add constraint appt_date_required_for_booked check (
    status in ('solicitud', 'pagado')
    or (appt_date is not null and start_minute is not null)
  );
