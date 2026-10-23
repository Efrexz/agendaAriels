import { getLabDb, notConfigured } from "./_shared.js";

// ─────────────────────────────────────────────────────────────
// GET /api/internal/lab/purge  (VERCEL CRON diario, 2º cron gratis)
// Borrador automático de resultados PUBLICADOS hace > 20 days:
//  • elimina el objeto del bucket privado "lab-results"
//  • limpia result_path/name/published_at
//  • si la orden seguía en 'resultado_listo' pasa a 'entregada'
//    (el cliente ya no la ve con el archivo; el estado queda coherente)
// Protegido con CRON_SECRET (mismo patrón de /medical/reminders;
// sin secret en dev queda abierto).
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const RESULT_WINDOW_MS = 20 * 24 * 60 * 60 * 1000;

interface Req {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

async function listExpired(db: NonNullable<ReturnType<typeof getLabDb>>): Promise<Array<{
  id: string; orderCode: string; status: string; resultPath: string | null;
}>> {
  const before = new Date(Date.now() - RESULT_WINDOW_MS).toISOString();
  const orders = await db.listExpiredResults(before);
  return orders.map((o) => ({ id: o.id, orderCode: o.orderCode, status: o.status, resultPath: o.resultPath }));
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }

  // Guard del secret (parity con medical/_reminders): en prod SIN header correcto → 401.
  const secret = process.env.CRON_SECRET;
  const token = req.headers?.authorization;
  if (secret && token !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, error: "No autorizado." });
    return;
  }

  if (notConfigured(res)) return;
  const db = getLabDb()!;

  try {
    const expired = await listExpired(db);
    let purged = 0;
    let failed = 0;
    if (expired.length > 0) {
      const client = createClient(
        process.env.SUPABASE_URL ?? "",
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
        { auth: { persistSession: false } },
      );
      const storage = client.storage.from("lab-results");
      for (const o of expired) {
        try {
          if (o.resultPath) await storage.remove([o.resultPath]);
          await db.finalizePurge(o.id, o.status);
          purged += 1;
        } catch (err) {
          failed += 1;
          console.error(`[lab/purge] ${o.orderCode}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
    console.log(`[lab/purge] publicados vencidos: ${expired.length}, purgados: ${purged}, fallos: ${failed}`);
    res.status(200).json({ ok: true, expired: expired.length, purged, failed });
  } catch (err) {
    console.error(`[lab/purge] ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
