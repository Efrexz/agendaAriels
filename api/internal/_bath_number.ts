import { z } from "zod/v4";
import { SupabaseBookingDb } from "../db.js";
import { bearerFrom, unauthorized, verifyStaff } from "./_verify.js";

// POST /api/internal/bath-number { bookingId, petIndex, number }
// Número de baño (turno del cuaderno del spa) POR MASCOTA: el counter lo
// asigna manualmente cuando la mascota llega y lo anota en el cuaderno.
// Solo guarda el número de referencia para que el cliente lo vea en /estado
// desde la distancia. NO toca estados ni envía WhatsApp. staff-only; valida
// que la mascota exista y que el número sea un entero razonable; null/vacío
// lo quita. Cuándo/cómo queda registrado en el propio jsonb ({n, by, at}).

const BODY_SCHEMA = z.object({
  bookingId: z.string().uuid(),
  petIndex: z.number().int().min(0).max(9),
  // null = quitar el número de esa mascota (el counter se equivocó de turnos).
  number: z.number().int().min(1).max(9999).nullable(),
});

export const maxDuration = 10;

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  const staff = await verifyStaff(bearerFrom(req.headers));
  if (!staff) {
    unauthorized(res);
    return;
  }

  const parsed = BODY_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Número de baño inválido (entero 1–9999 o vacío)." });
    return;
  }
  const { bookingId, petIndex, number } = parsed.data;

  const db = SupabaseBookingDb.fromEnv(process.env);
  if (!db) {
    res.status(500).json({ ok: false, error: "Servicio no disponible." });
    return;
  }

  try {
    const booking = await db.findById(bookingId);
    if (!booking) {
      res.status(404).json({ ok: false, error: "Reserva no encontrada." });
      return;
    }
    const petCount = (booking.pets as unknown[] | null)?.length ?? 0;
    if (petIndex >= petCount) {
      res.status(400).json({ ok: false, error: "La reserva no tiene esa mascota." });
      return;
    }
    // Sin reglas de negocio: el counter asigna a mano desde el cuaderno del
    // spa (doble-click es idempotente — escribir el mismo número dos veces
    // deja el mismo resultado).
    await db.setBathNumber(
      bookingId,
      petIndex,
      number === null ? null : { n: number, by: staff.email, at: new Date().toISOString() },
      booking.bathNumbers,
    );
    res.status(200).json({ ok: true });
  } catch {
    // PGRST204 = columna bath_numbers inexistente (migración no aplicada aún).
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
