import { SupabaseBookingDb } from "../db.js";
import { bearerFrom, unauthorized, verifyStaff } from "./_verify.js";

// ─────────────────────────────────────────────────────────────
// GET /api/internal/search?q=<código|teléfono|nombre>
// Búsqueda de reservas para el panel. Requiere sesión del staff.
// ─────────────────────────────────────────────────────────────

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
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 3) {
    res.status(400).json({ ok: false, error: "Escribe al menos 3 caracteres (código, teléfono o nombre)." });
    return;
  }

  const db = SupabaseBookingDb.fromEnv(process.env);
  if (!db) {
    res.status(500).json({ ok: false, error: "Servicio no disponible." });
    return;
  }

  try {
    const results = await db.searchBookings(q);
    res.status(200).json({
      ok: true,
      results: results.map((b) => ({
        id: b.id,
        bookingCode: b.bookingCode,
        branch: b.branch,
        branchLabel: b.branchLabel,
        serviceDate: b.serviceDate,
        timeSlot: b.timeSlot,
        ownerName: b.ownerName,
        ownerPhone: b.ownerPhone,
        ownerAddress: b.ownerAddress,
        mapsUrl: b.mapsUrl,
        status: b.status,
        pets: b.pets,
        createdAt: b.createdAt,
      })),
    });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
