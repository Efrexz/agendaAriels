import { SupabaseBookingDb } from "./db";

// ─────────────────────────────────────────────────────────────
// GET /api/availability
// Días/franjas cerradas por el staff (sin datos personales).
// El wizard las pinta en rojo como "Ocupado".
// ─────────────────────────────────────────────────────────────

export const maxDuration = 10;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getLimaDayKey(date: Date = new Date()): string {
  return dayFormatter.format(date);
}

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
  setHeader(name: string, value: string): Res;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }

  const db = SupabaseBookingDb.fromEnv(process.env);
  if (!db) {
    res.status(500).json({ ok: false, error: "Servicio no disponible." });
    return;
  }

  try {
    const closures = await db.listClosures(getLimaDayKey());
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({
      ok: true,
      closures: closures.map((c) => ({
        branch: c.branch,
        date: c.closureDate,
        timeSlot: c.timeSlot,
      })),
    });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
