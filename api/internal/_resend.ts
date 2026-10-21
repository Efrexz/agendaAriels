import { SupabaseBookingDb, type BookingRecord } from "../db.js";
import {
  buildBookingMessages,
  buildShortVetMessage,
  sendClientReceipt,
  sendViaEvolution,
  type BookingEnv,
  type BookingPayload,
} from "../_booking.js";
import { bearerFrom, unauthorized, verifyStaff } from "./_verify.js";

// ─────────────────────────────────────────────────────────────
// POST /api/internal/resend { bookingId }
// Reenvía el aviso a la veterinaria + comprobante al cliente para
// reservas cuyo WhatsApp inicial no se entregó (whatsapp_delivered
// = false). Solo staff; anti-doble click por ventana de 60s.
// ─────────────────────────────────────────────────────────────

// branchPhone no se guarda en BD: se reconstruye de la sede (misma fuente
// que src/data/branches.ts).
const BRANCH_PHONES: Record<string, string> = {
  san_martin: "+51 986 985 047",
  los_olivos: "+51 932 719 342",
  san_miguel: "+51 954 599 221",
};

const DEDUPE_WINDOW_MS = 60_000;
const recentResends = new Map<string, number>();

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

function recordToPayload(r: BookingRecord): BookingPayload {
  const dateObj = new Date(`${r.serviceDate}T12:00:00Z`);
  const dateLabel = new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dateObj);
  return {
    bookingCode: r.bookingCode,
    submittedAt: r.createdAt,
    branch: r.branch,
    branchLabel: r.branchLabel,
    branchPhone: BRANCH_PHONES[r.branch] ?? "-",
    pets: r.pets,
    date: r.serviceDate,
    dateLabel,
    timeRange: r.timeSlot === "9-11" ? "9-11" : "11-14",
    timeRangeLabel: r.timeSlot === "9-11" ? "9:00 – 11:00" : "11:00 – 14:00",
    ownerName: r.ownerName,
    ownerDni: r.ownerDni,
    ownerPhone: r.ownerPhone,
    ownerAddress: r.ownerAddress,
    ownerLat: r.ownerLat,
    ownerLng: r.ownerLng,
    mapsUrl: r.mapsUrl,
    hasHistory: r.hasHistory,
    registeredPetName: r.registeredPetName,
    registeredPhone: r.registeredPhone,
    petBirthDate: r.petBirthDate,
    petSpecies: r.petSpecies,
    petBreed: r.petBreed,
    petCastrated: r.petCastrated,
    mobilityPhoneDifferent: r.mobilityPhoneDifferent,
    mobilityPhone: r.mobilityPhone,
    ownerEmail: r.ownerEmail,
  };
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

  const bookingId = String(
    (req.body as { bookingId?: unknown } | undefined)?.bookingId ?? "",
  );
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) {
    res.status(400).json({ ok: false, error: "Datos inválidos." });
    return;
  }

  const cutoff = Date.now() - DEDUPE_WINDOW_MS;
  for (const [id, at] of recentResends) {
    if (at < cutoff) recentResends.delete(id);
  }
  if (Date.now() - (recentResends.get(bookingId) ?? 0) < DEDUPE_WINDOW_MS) {
    res.status(429).json({ ok: false, error: "Recién se envió un reenvío. Espera un minuto." });
    return;
  }

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
    if (booking.whatsappDelivered) {
      res.status(200).json({ ok: true, resent: false, reason: "El aviso de esta reserva ya se entregó." });
      return;
    }

    const env = process.env as BookingEnv;
    const evolutionReady = !!(
      env.EVOLUTION_API_URL &&
      env.EVOLUTION_API_KEY &&
      env.EVOLUTION_INSTANCE &&
      env.WHATSAPP_DESTINO
    );
    if (!evolutionReady && env.EVOLUTION_DRY_RUN !== "true") {
      res.status(200).json({ ok: true, resent: false, reason: "Evolution no configurada en este entorno." });
      return;
    }

    recentResends.set(bookingId, Date.now());

    const payload = recordToPayload(booking);
    const panelUrl = env.INTERNAL_PANEL_URL || undefined;
    const shortMode = env.VET_MESSAGE_MODE === "short";
    const clinicMessages = shortMode
      ? [buildShortVetMessage(payload, panelUrl)]
      : buildBookingMessages(payload);

    const sent = await sendViaEvolution(clinicMessages, env, fetch);
    if (!sent.ok) {
      res.status(502).json({ ok: false, error: `El reenvío falló: ${sent.error}` });
      return;
    }

    try {
      await db.setWhatsappDelivered(booking.id, true);
    } catch {
      /* best effort: la entrega ya ocurrió */
    }

    // Comprobante al cliente: best effort (no rompe el reenvío a la veterinaria).
    const proto = typeof req.headers["x-forwarded-proto"] === "string"
      ? String(req.headers["x-forwarded-proto"]).split(",")[0].trim()
      : "https";
    const host = req.headers["x-forwarded-host"] ?? req.headers["host"];
    const origin = typeof host === "string" && host.length > 0 ? `${proto}://${host}` : undefined;
    const trackingUrl = env.TRACKING_ENABLED === "true" && origin ? `${origin}/estado` : undefined;
    const receipt = await sendClientReceipt(payload, env, fetch, trackingUrl);
    if (receipt.outcome === "failed") console.warn(`[internal/resend] ${receipt.reason}`);

    res.status(200).json({ ok: true, resent: true });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
