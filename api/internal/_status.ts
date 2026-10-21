import { z } from "zod/v4";
import { SupabaseBookingDb } from "../db.js";
import { normalizePhoneDest, sendViaEvolution, type BookingEnv } from "../_booking.js";
import { bearerFrom, unauthorized, verifyStaff } from "./_verify.js";

// ─────────────────────────────────────────────────────────────
// POST /api/internal/status  { bookingId, status }
// Cambia el estado de una reserva (lo ve el cliente en /estado).
// En los estados clave notifica por WhatsApp al cliente:
//   en_camino_recojo → "la movilidad va en camino"
//   listo            → "tu mascota está lista"
//   en_camino_entrega→ "la movilidad lo lleva a casa"
// Requiere sesión del staff (JWT de Supabase Auth).
// ─────────────────────────────────────────────────────────────

const BODY_SCHEMA = z.object({
  bookingId: z.string().uuid(),
  status: z.enum([
    "pendiente",
    "en_camino_recojo",
    "recibido",
    "en_bano",
    "en_secado",
    "en_corte",
    "listo",
    "en_camino_entrega",
    "entregado",
    "cancelado",
  ]),
});

export const maxDuration = 30;

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

const NOTIFIABLE: Record<string, (nombre: string, branchLabel: string) => string> = {
  en_camino_recojo: (nombre) =>
    `🚐 *¡En camino!*\n\nLa movilidad de Veterinaria Ariel va hacia tu domicilio para recoger a *${nombre}*.\n\n¡Nos vemos en un momento! 🐶`,
  listo: (nombre, branchLabel) =>
    `✅ *¡${nombre} está${nombre.includes(", ") ? "n" : ""} listo${nombre.includes(", ") ? "s" : ""}!*\n\nYa puedes pasar por *${branchLabel}* o esperar la movilidad de entrega. 🐾`,
  en_camino_entrega: (nombre) =>
    `🚐 *¡De regreso a casa!*\n\nLa movilidad va camino a llevarte a *${nombre}*. ¡Gracias por tu confianza! 🐶✨`,
};

function petNames(pets: Array<{ name: string }>): string {
  const names = pets.map((p) => p.name);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
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
  const { bookingId, status } = parsed.data;

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

    const previous = booking.status;
    if (previous === status) {
      res.status(200).json({ ok: true, status, notified: false });
      return;
    }

    // Solo el ganador del cambio atómico registra el timeline y notifica:
    // dos PCs clickeando a la vez no generan doble WhatsApp.
    const changed = await db.transitionStatus(bookingId, previous, status, staff.email);
    if (!changed) {
      res.status(200).json({ ok: true, status, notified: false, stale: true });
      return;
    }

    // WhatsApp al cliente: solo estados notificables y si hay teléfono válido.
    let notified = false;
    const template = NOTIFIABLE[status];
    if (template) {
      const env = process.env as BookingEnv;
      const dest = normalizePhoneDest(booking.ownerPhone);
      const evolutionReady = !!(
        env.EVOLUTION_API_URL &&
        env.EVOLUTION_API_KEY &&
        env.EVOLUTION_INSTANCE
      );
      if (dest && (evolutionReady || env.EVOLUTION_DRY_RUN === "true")) {
        const text = template(petNames(booking.pets), booking.branchLabel);
        const sent = await sendViaEvolution([text], env, fetch, dest);
        notified = sent.ok;
        if (!sent.ok) console.warn(`[internal/status] aviso al cliente falló: ${sent.error}`);
      }
    }

    res.status(200).json({ ok: true, status, notified });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
