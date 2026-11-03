import { getLabDb, notConfigured } from "./_shared.js";
import { isAuthorizedCron } from "../_cron.js";

// ─────────────────────────────────────────────────────────────
// GET /api/internal/lab/purge  (VERCEL CRON diario, 2º cron gratis)
// Borrador automático de resultados PUBLICADOS hace > 20 days:
//  • elimina el objeto del bucket privado "lab-results"
//  • limpia la ruta, el nombre y la huella; conserva la fecha para el aviso
//  • si la orden seguía en 'resultado_listo' pasa a 'entregada'
//    (el cliente ya no la ve con el archivo; el estado queda coherente)
// CRON_SECRET es obligatorio en todos los entornos, incluido desarrollo.
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
  id: string; orderCode: string; status: string; resultPath: string | null; resultPublishedAt: string | null;
}>> {
  const before = new Date(Date.now() - RESULT_WINDOW_MS).toISOString();
  const orders = await db.listExpiredResults(before);
  return orders.map((o) => ({ id: o.id, orderCode: o.orderCode, status: o.status, resultPath: o.resultPath, resultPublishedAt: o.resultPublishedAt }));
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }

  if (!isAuthorizedCron(req.headers)) {
    res.status(401).json({ ok: false, error: "No autorizado." });
    return;
  }

  if (notConfigured(res)) return;
  const db = getLabDb()!;

  try {
    const expired = await listExpired(db);
    let purged = 0;
    let failed = 0;
    let changed = 0;
    if (expired.length > 0) {
      const client = createClient(
        process.env.SUPABASE_URL ?? "",
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
        { auth: { persistSession: false } },
      );
      const storage = client.storage.from("lab-results");
      for (const o of expired) {
        try {
          if (!o.resultPath || !o.resultPublishedAt) { failed += 1; continue; }
          const { error } = await storage.remove([o.resultPath]);
          if (error) throw new Error("No se pudo borrar el archivo en Storage.");
          const finalized = await db.finalizePurge(o.id, o.status, o.resultPath, o.resultPublishedAt);
          if (finalized) purged += 1;
          else changed += 1; // El archivo fue reemplazado mientras corría la purga.
        } catch (err) {
          failed += 1;
          console.error(`[lab/purge] ${o.orderCode}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
    console.log(`[lab/purge] publicados vencidos: ${expired.length}, purgados: ${purged}, cambiados: ${changed}, fallos: ${failed}`);
    res.status(200).json({ ok: failed === 0, expired: expired.length, purged, changed, failed });
  } catch (err) {
    console.error(`[lab/purge] ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
