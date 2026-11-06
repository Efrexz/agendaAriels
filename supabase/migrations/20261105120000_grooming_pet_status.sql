-- G1 estado por mascota: registro por mascota dentro de la reserva.
-- Forma: {"<index>": {"s": "<fase>", "by": "<email staff>", "at": "<iso>"}, ...}
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pet_status jsonb;
