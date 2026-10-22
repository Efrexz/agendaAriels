import { z } from "zod/v4";
import { getLabDb, notConfigured, staffGuard } from "./_shared.js";

// GET  /api/internal/lab/catalog  → { exams: string[], labs: string[] }
// POST /api/internal/lab/catalog  { kind: "exam"|"lab", name } → agrega nombre
// nuevo (idempotente: si ya existe devuelve el existente). Solo staff.
// Catálogo global: las 3 sedes comparten la misma lista.

export const maxDuration = 15;

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

const POST_SCHEMA = z.object({
  kind: z.enum(["exam", "lab"]),
  name: z.string().trim().min(2).max(120),
});

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  const db = getLabDb()!;
  try {
    if (req.method === "GET") {
      res.status(200).json({ ok: true, ...(await db.listCatalog()) });
      return;
    }
    const parsed = POST_SCHEMA.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "Nombre inválido (mín. 2 caracteres)." });
      return;
    }
    const name = await db.addCatalogItem(parsed.data.kind, parsed.data.name);
    res.status(200).json({ ok: true, name });
  } catch (err) {
    console.error(`[lab/catalog] ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
