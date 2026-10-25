import { getLimaDayKey } from "../lib-lima.js";
import { getMedicalDb, notConfigured, staffGuard } from "./_shared.js";
// GET /api/medical/history?from=YYYY-MM-DD&to=YYYY-MM-DD[&branch=<id>]
// Historial del panel (solo lectura) por rango, INCLUYENDO canceladas.
// Rango máximo 31 días (protección de la BD free).

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
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to || new Date(to).getTime() - new Date(from).getTime() > 31 * 24 * 3600 * 1000) {
    res.status(400).json({ ok: false, error: "Rango de fechas inválido (máximo un mes)." });
    return;
  }
  const branchParam = url.searchParams.get("branch");
  const branch = branchParam && branchParam !== "all" ? branchParam : null;

  try {
    const db = getMedicalDb()!;
    const appts = await db.listApptsRange(branch, from, to, true);
    const updates = await db.listApptStatusUpdatesMany(appts.map((a) => a.id));
    res.status(200).json({
      ok: true,
      today: getLimaDayKey(),
      appointments: appts.map((a) => ({ ...a, timeline: updates[a.id] ?? [] })),
    });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
