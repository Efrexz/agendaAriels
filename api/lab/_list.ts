import { getLabDb, notConfigured, staffGuard, isLabBranch } from "./_shared.js";
import { getLimaDayKey } from "../lib-lima.js";

// GET /api/internal/lab/list  (solo staff)
//  view=active (default): órdenes en curso (recibida/en_laboratorio/resultado_listo)
//  view=today|week       : registradas en ese rango (por created_at)
//  q=                    : búsqueda (código LAB-, teléfono, mascota, historia, dueño)
//  sede=<branch>         : filtra por sede_origen O sede_responsable (cross-sede);
//                          sin sede (o sede=all) muestra todas las sedes.
// Cada orden trae su timeline y `overdue` (en laboratorio > 7 días).

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

const OVERDUE_MS = 7 * 24 * 60 * 60 * 1000;

function dayBoundsIso(dayKey: string): { fromIso: string; toIso: string } {
  // Zona horaria del sistema: America/Lima (UTC-05:00, sin DST).
  const fromIso = `${dayKey}T00:00:00-05:00`;
  const [y, m, d] = dayKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, (m ?? 1) - 1, d));
  next.setUTCDate(next.getUTCDate() + 1);
  const nextKey = next.toISOString().slice(0, 10);
  return { fromIso, toIso: `${nextKey}T00:00:00-05:00` };
}

export async function buildLabListResponse(
  opts: { view: string; q: string; sede: string | null },
  db: ReturnType<typeof getLabDb> & NonNullable<ReturnType<typeof getLabDb>>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const sede = opts.sede && isLabBranch(opts.sede) ? opts.sede : null;
  let orders;

  if (opts.q.trim().length >= 3) {
    orders = await db.searchOrders(opts.q, sede);
  } else if (opts.view === "today") {
    const { fromIso, toIso } = dayBoundsIso(getLimaDayKey());
    orders = await db.listOrdersByCreated(sede, fromIso, toIso);
  } else if (opts.view === "week") {
    const toIso = new Date().toISOString();
    const fromIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    orders = await db.listOrdersByCreated(sede, fromIso, toIso);
  } else {
    orders = await db.listActiveOrders(sede);
  }

  const nowMs = Date.now();
  const enriched = orders.map((o) => ({
    ...o,
    overdue: o.status === "en_laboratorio" && nowMs - Date.parse(o.updatedAt) > OVERDUE_MS,
  }));

  const timelines = await db.listStatusUpdatesMany(enriched.map((o) => o.id));
  return { status: 200, body: { ok: true, orders: enriched, timelines } };
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  const url = new URL(req.url ?? "/", "https://placeholder.local");
  const view = url.searchParams.get("view") ?? "active";
  const q = (url.searchParams.get("q") ?? "").trim();
  const sedeParam = url.searchParams.get("sede") ?? "";

  try {
    const db = getLabDb()!;
    const result = await buildLabListResponse({ view, q, sede: sedeParam === "all" ? null : sedeParam }, db);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(`[lab/list] ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
