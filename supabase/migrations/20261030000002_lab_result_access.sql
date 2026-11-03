-- Acceso privado al archivo: solo se guarda la huella del enlace, nunca el token.
-- Las órdenes existentes quedan sin enlace; el personal podrá generar uno.
alter table public.lab_orders
  add column if not exists result_access_hash text;
