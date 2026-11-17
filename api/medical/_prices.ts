import { getMedicalDb, notConfigured } from "./_shared.js";

// GET /api/medical/prices — PÚBLICO (wizard /cita-medica):
// costos de rayos/eco configurados en ⚙ Config (feedback 17/11: los clientes
// escriben para preguntar cuánto cuestan). SOLO expone las 2 claves de precio
// (nunca todo el config del staff). Vacío/null = sin precio visible.

export const maxDuration = 10;

interface Req {
  method?: string;
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
  if (notConfigured(res)) return;

  try {
    const config = await getMedicalDb()!.getConfig();
    res.status(200).json({
      ok: true,
      rayos: config.price_rayos ?? null,
      eco: config.price_eco ?? null,
    });
  } catch {
    res.status(500).json({ ok: false, error: "Servicio no disponible." });
  }
}
