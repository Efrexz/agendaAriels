import { z } from "zod/v4";
import { getMedicalDb, notConfigured, staffGuard } from "./_shared.js";

// Config editable del panel (solo staff):
// GET /api/medical/config  → { config: {...} }
// PUT /api/medical/config  → { key, value } (keys permitidas)

export const maxDuration = 10;

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

const ALLOWED_KEYS = new Set(["appt_duration_minutes", "payment_info"]);

const PUT_SCHEMA = z.object({
  key: z.string(),
  value: z.string().max(1000),
});

export default async function handler(req: Req, res: Res) {
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  const db = getMedicalDb()!;

  try {
    if (req.method === "GET") {
      const config = await db.getConfig();
      res.status(200).json({ ok: true, config });
      return;
    }
    if (req.method === "PUT") {
      const parsed = PUT_SCHEMA.safeParse(req.body);
      if (!parsed.success || !ALLOWED_KEYS.has(parsed.data.key)) {
        res.status(400).json({ ok: false, error: "Clave no permitida." });
        return;
      }
      if (parsed.data.key === "appt_duration_minutes") {
        const n = Number(parsed.data.value);
        if (!Number.isInteger(n) || n < 15 || n > 120) {
          res.status(400).json({ ok: false, error: "La duración debe ser entre 15 y 120 minutos." });
          return;
        }
      }
      await db.setConfig(parsed.data.key, parsed.data.value);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ ok: false, error: "Método no permitido." });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
