import { z } from "zod/v4";
import { SupabaseBookingDb, type BookingDb } from "./db.js";

// ─────────────────────────────────────────────────────────────
// GET /api/status?code=VA-XXXXX
// Página del cliente: estados en tiempo real. Expone SOLO campos
// seguros: nunca dirección, teléfonos, DNI ni fotos.
// ─────────────────────────────────────────────────────────────

const CODE_SCHEMA = z.string().regex(/^VA-[A-Z0-9]{5}$/);

export const maxDuration = 10;

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function rateLimited(key: string, now: number): boolean {
  const cutoff = now - WINDOW_MS;
  const existing = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (existing.length >= MAX_PER_WINDOW) {
    hits.set(key, existing);
    return true;
  }
  existing.push(now);
  hits.set(key, existing);
  return false;
}

interface Req {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

export async function buildStatusResponse(
  db: BookingDb,
  code: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const record = await db.findByCode(code);
  if (!record) {
    // Sin distinción entre "no existe" y error: misma respuesta.
    return { status: 404, body: { ok: false, error: "No encontramos una reserva con ese código." } };
  }
  const timeline = await db.listStatusUpdates(record.id);
  return {
    status: 200,
    body: {
      ok: true,
      booking: {
        bookingCode: record.bookingCode,
        status: record.status,
        serviceDate: record.serviceDate,
        timeSlot: record.timeSlot,
        branchLabel: record.branchLabel,
        createdAt: record.createdAt,
        pets: record.pets.map((pet) => ({ name: pet.name, type: pet.type, service: pet.service })),
        // Sin createdBy: el email del staff no va al público (el panel interno sí lo ve).
        timeline: timeline.map((t) => ({ status: t.status, createdAt: t.createdAt })),
      },
    },
  };
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }

  const ip = typeof req.headers["x-forwarded-for"] === "string"
    ? (req.headers["x-forwarded-for"] as string).split(",")[0].trim()
    : "direct";
  if (rateLimited(ip, Date.now())) {
    res.status(429).json({ ok: false, error: "Demasiadas consultas. Espera un momento." });
    return;
  }

  const url = new URL(req.url ?? "/", "https://placeholder.local");
  const rawCode = (url.searchParams.get("code") ?? "").trim().toUpperCase();
  const parsedCode = CODE_SCHEMA.safeParse(rawCode);
  if (!parsedCode.success) {
    res.status(400).json({ ok: false, error: "Código de reserva inválido." });
    return;
  }

  const db = SupabaseBookingDb.fromEnv(process.env);
  if (!db) {
    res.status(500).json({ ok: false, error: "Servicio no disponible." });
    return;
  }

  try {
    const result = await buildStatusResponse(db, parsedCode.data);
    res.status(result.status).json(result.body);
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
