-- LAB 3: resultado del examen publicado al cliente (PDF/JPG/PNG en Supabase
-- Storage privado) + expiración a 20 días (cron purga, api/lab/_purge.ts).
-- El archivo vive en el bucket privado "lab-results" (negado al anónimo):
-- el cliente solo accede con URL firmada de 10 min generada por la API.
-- Nombrado por código de orden (LAB-XXXXX.ext), NUNCA por datos del dueño.

alter table public.lab_orders
  add column if not exists result_path text,            -- ruta en bucket p.ej. "<uuid>/LAB-XXXXX.pdf"
  add column if not exists result_name text not null default '',  -- nombre original para mostrar
  add column if not exists result_published_at timestamptz;       -- inicio de la ventana de 20 días

create index if not exists lab_orders_result_pub_idx on public.lab_orders (result_published_at);

-- Bucket privado (idempotente)
insert into storage.buckets (id, name, public)
values ('lab-results', 'lab-results', false)
on conflict (id) do nothing;

-- Subida: SOLO usuarios autenticados del staff (rol 'authenticated' del JWT
-- de Supabase; el público navega con anon → denegado). Lectura/update/delete:
-- sin políticas = denegado para todos; service_role hace bypass (API del sistema).
drop policy if exists "staff upload lab results" on storage.objects;
create policy "staff upload lab results" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'lab-results');

select count(*) as buckets_ok from storage.buckets where id = 'lab-results';
