import { z } from "zod/v4";
import { SupabaseBookingDb } from "../db.js";
import { normalizePhoneDest, sendViaEvolution, type BookingEnv } from "../_booking.js";
import { bearerFrom, unauthorized, verifyStaff } from "./_verify.js";
import { petNames, NOTIFIABLE } from "./_status.js";

// POST /api/internal/pet-status { bookingId, petIndex, status }
// G1: avanza el estado de UNA mascota dentro de una reserva de grooming
// (bano/secado/corte/listo/entregado; vacío "" la resetea). NO cambia el
// estado general de la reserva: esa cascada sigue siendo la fuente del
// WhatsApp y del tracking. staff-only; valida que la mascota exista y que
// el salto sea de UNA fase (adelante o atrás) — candado anti doble-click.
// Cuándo/cómo queda registrado en el propio jsonb ({s, by, at}).

const PET_STATUSES = ["bano", "secado", "corte", "listo", "entregado"] as const;

const BODY_SCHEMA = z.object({
  bookingId: z.string().uuid(),
  petIndex: z.number().int().min(0).max(9),
  status: z.string().refine((v) => v === "" || (PET_STATUSES as readonly string[]).includes(v), {
    message: "Estado de mascota desconocido.",
  }),
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
    res.status(400).json({ ok: false, error: "Datos inválidos." });
    return;
  }
  const { bookingId, petIndex, status } = parsed.data;

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
    // Sin restricción de "fases consecutivas": una mascota con solo baño salta
    // correcta-mente Baño→Listo (no pasa por corte). Doble-click inofensivo:
    // escribir el mismo estado dos veces es idempotente.
    await db.setPetStatus(
      bookingId,
      petIndex,
      { s: status, by: staff.email, at: new Date().toISOString() },
      booking.petStatus,
    );

    // Derivación automática de la cascada general (promesa de la maqueta G1):
    // cuando TODAS las mascotas tienen estado, el general avanza al mínimo de
    // las fases — todas ≥ listo → "listo" con su único WhatsApp final (la
    // decisión del comité contra un aviso por mascota). NUNCA retrocede y no
    // toca estados post-entrega/cancelación (esos son del counter).
    const nextStatus = { ...(booking.petStatus ?? {}) };
    nextStatus[String(petIndex)] = { s: status, by: staff.email, at: new Date().toISOString() };
    const petStates = (booking.pets as unknown[]).map((_, i) => nextStatus[String(i)]?.s ?? "");
    let globalMoved: string | null = null;
    let notified = false;
    if (petStates.every(Boolean)) {
      const PHASE_RANK: Record<string, number> = { bano: 1, secado: 2, corte: 3, listo: 4, entregado: 4 };
      const RANK_STATUS: Record<number, string> = { 1: "en_bano", 2: "en_secado", 3: "en_corte", 4: "listo" };
      const GLOBAL_RANK: Record<string, number> = {
        pendiente: 0, en_camino_recojo: 1, recibido: 2, en_bano: 3, en_secado: 4,
        en_corte: 5, listo: 6, en_camino_entrega: 7, entregado: 8,
      };
      const minRank = Math.min(...petStates.map((s) => PHASE_RANK[s] ?? 0));
      const derived = RANK_STATUS[minRank] ?? null;
      if (
        derived &&
        (GLOBAL_RANK[derived] ?? -1) > (GLOBAL_RANK[booking.status] ?? -1) &&
        booking.status !== "cancelado" && booking.status !== "entregado"
      ) {
        await db.transitionStatus(bookingId, booking.status, derived, staff.email);
        globalMoved = derived;
        if (derived === "listo") {
          const template = NOTIFIABLE.listo;
          const env = process.env as BookingEnv;
          const dest = normalizePhoneDest(booking.ownerPhone);
          const evolutionReady = !!(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE);
          if (dest && (evolutionReady || env.EVOLUTION_DRY_RUN === "true")) {
            const text = template(petNames(booking.pets), booking.branchLabel);
            const sent = await sendViaEvolution([text], env, fetch, dest);
            notified = sent.ok;
            if (!sent.ok) console.warn(`[internal/pet-status] aviso final falló: ${sent.error}`);
          }
        }
      }
    }

    res.status(200).json({ ok: true, globalStatus: globalMoved, notified });
  } catch {
    // PGRST204 = columna pet_status inexistente (migración no aplicada aún).
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
