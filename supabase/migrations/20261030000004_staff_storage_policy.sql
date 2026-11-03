-- Aplicar DESPUÉS de registrar y verificar las cuentas activas del personal.
-- Auditar primero TODAS las políticas INSERT de storage.objects: otras reglas
-- permisivas podrían permitir una subida aun cuando esta política la deniegue.
do $$
begin
  if not exists (select 1 from public.staff_users where active = true) then
    raise exception 'Registrar al menos una cuenta de personal activa antes de cambiar la política de Storage';
  end if;
end $$;

drop policy if exists "staff upload lab results" on storage.objects;
create policy "staff upload lab results" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lab-results'
    and exists (
      select 1 from public.staff_users s
      where s.user_id = (select auth.uid()) and s.active = true
    )
  );
