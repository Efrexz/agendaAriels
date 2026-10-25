import { z } from "zod/v4";
import { SupabaseBookingDb } from "../db.js";
import { bearerFrom, unauthorized, verifyStaff } from "./_verify.js";

// ─────────────────────────────────────────────────────────────
// GET /api/internal/history?from=YYYY-MM-DD&to=YYYY-MM-DD[&branch=x]
// Historial del panel (solo lectura): reservas del rango INCLUYENDO
// canceladas. Rango máximo 31 días (evita scans grandes en BD free).
// ─────────────────────────────────────────────────────────────

const DATE_SCHEMA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const BRANCH_SCHEMA = z.enum(["san_martin", "los_olivos", "san_miguel"]).nullable();

export const maxDuration = 15;

interface Req {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  const staff = await verifyStaff(bearerFrom(req.headers));
  if (!staff) {
    unauthorized(res);
    return;
  }

  const url = new URL(req.url ?? "/", "https://placeholder.local");
  const from = DATE_SCHEMA.safeParse(url.searchParams.get("from") ?? "");
  const to = DATE_SCHEMA.safeParse(url.searchParams.get("to") ?? "");
  if (!from.success || !to.success || from.data > to.data) {
    res.status(400).json({ ok: false, error: "Rango de fechas inválido." });
    return;
  }
  if (new Date(to.data).getTime() - new Date(from.data).getTime() > 31 * 24 * 3600 * 1000) {
    res.status(400).json({ ok: false, error: "El rango máximo es de un mes." });
    return;
  }
  const rawBranch = url.searchParams.get("branch");
  const branch = rawBranch && rawBranch !== "all" ? BRANCH_SCHEMA.safeParse(rawBranch) : { success: true, data: null };
  if (!branch.success) {
    res.status(400).json({ ok: false, error: "Sede inválida." });
    return;
  }

  const db = SupabaseBookingDb.fromEnv(process.env);
  if (!db) {
    res.status(500).json({ ok: false, error: "Servicio no disponible." });
    return;
  }

  try {
    const bookings = await db.listBookingsRange(branch.data, from.data, to.data);
    const timelines = await db.listUpdatesForBookings(bookings.map((b) => b.id));
    res.status(200).json({
      ok: true,
      bookings: bookings.map((b) => ({
        id: b.id,
        bookingCode: b.bookingCode,
        branch: b.branch,
        branchLabel: b.branchLabel,
        serviceDate: b.serviceDate,
        timeSlot: b.timeSlot,
        ownerName: b.ownerName,
        ownerPhone: b.ownerPhone,
        status: b.status,
        whatsappDelivered: b.whatsappDelivered,
        pets: b.pets,
        createdAt: b.createdAt,
        timeline: timelines[b.id] ?? [],
      })),
    });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
