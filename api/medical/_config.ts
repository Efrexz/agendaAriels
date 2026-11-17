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

// Links de reseñas de Google POR SEDE (feedback 16/11 del dueño). Vacíos = la
// encuesta sale sin la línea del link (nunca se bloquea por falta de link).
// Costos de rayos/eco (17/11: clientes preguntan cuánto cuestan) — se muestran
// en el wizard ("Desde S/ X"). Vacíos = sin precio visible.
const ALLOWED_KEYS = new Set([
  "appt_duration_minutes",
  "payment_info",
  "google_review_url_san_martin",
  "google_review_url_los_olivos",
  "google_review_url_san_miguel",
  "price_rayos",
  "price_eco",
]);

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
      if (parsed.data.key.startsWith("google_review_url_") && parsed.data.value.trim() !== "") {
        // Acepta solo https para no guardar enlaces raros (tipo javascript:) en el chat.
        if (!/^https:\/\//.test(parsed.data.value.trim())) {
          res.status(400).json({ ok: false, error: "El link de Google debe empezar con https://" });
          return;
        }
      }
      if (parsed.data.key.startsWith("price_") && parsed.data.value.trim() !== "") {
        const n = Number(parsed.data.value);
        if (!Number.isFinite(n) || n < 0 || n > 9999) {
          res.status(400).json({ ok: false, error: "El costo debe ser un número entre 0 y 9999." });
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
