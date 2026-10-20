import { getLimaDayKey } from "../lib-lima.js";
import { getMedicalDb, notConfigured, staffGuard } from "./_shared.js";
// GET /api/medical/day?date=<yyyy-mm-dd>[&branch=<id>]
// Citas del día para el panel (solo staff). Amplitud de datos del staff:
// incluye todo (es interno). Sin date devuelve "por asignar" (especializadas).

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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  const url = new URL(req.url ?? "/", "https://placeholder.local");
  const branchParam = url.searchParams.get("branch");
  const branch = branchParam && branchParam !== "all" ? branchParam : null;
  const date = url.searchParams.get("date");

  try {
    const db = getMedicalDb()!;

    if (!date || !DATE_RE.test(date)) {
      // Vista "Por asignar": especializadas en solicitud/pagado
      const pendings = await db.listUnassignedAppts(branch);
      const updates = await db.listApptStatusUpdatesMany(pendings.map((a) => a.id));
      res.status(200).json({
        ok: true,
        mode: "pendientes",
        appointments: pendings.map((a) => ({ ...a, timeline: updates[a.id] ?? [] })),
      });
      return;
    }

    const appts = await db.listApptsByDate(branch, date);
    const updates = await db.listApptStatusUpdatesMany(appts.map((a) => a.id));
    res.status(200).json({
      ok: true,
      mode: "dia",
      date,
      today: getLimaDayKey(),
      appointments: appts.map((a) => ({ ...a, timeline: updates[a.id] ?? [] })),
    });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
