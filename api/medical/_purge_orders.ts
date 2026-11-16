import { isAuthorizedCron } from "../_cron.js";
import { getMedicalDb, notConfigured } from "./_shared.js";

// ─────────────────────────────────────────────────────────────
// GET /api/medical/purge-orders  (VERCEL CRON diario, 3er cron gratis)
// Purga de órdenes de rayos/eco subidas por el cliente (feedback del dueño:
// "duren una semana y liberamos espacio"):
//  • elimina el objeto del bucket privado "medical-orders"
//  • limpia order_path (el panel deja de ofrecer "Ver orden")
//  • conservamos has_order (el cliente SÍ declaró tenerla: la historial queda
//    coherente; el counter la pidió por chat o se trajo impresa)
// CRON_SECRET es obligatorio en todos los entornos (mismo patrón del lab).
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const ORDER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 días (decisión del dueño)

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

  if (!isAuthorizedCron(req.headers)) {
    res.status(401).json({ ok: false, error: "No autorizado." });
    return;
  }

  if (notConfigured(res)) return;
  const db = getMedicalDb()!;

  try {
    const cutoff = new Date(Date.now() - ORDER_WINDOW_MS).toISOString();
    const expired = await db.listOrderFilesToPurge(cutoff);
    let purged = 0;
    let failed = 0;
    if (expired.length > 0) {
      const client = createClient(
        process.env.SUPABASE_URL ?? "",
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
        { auth: { persistSession: false } },
      );
      const storage = client.storage.from("medical-orders");
      for (const o of expired) {
        try {
          const { error } = await storage.remove([o.orderPath]);
          if (error) throw new Error("No se pudo borrar el archivo en Storage.");
          await db.setOrderFile(o.id, null);
          purged += 1;
        } catch (err) {
          failed += 1;
          console.error(`[medical/purge-orders] ${o.id}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
    console.log(`[medical/purge-orders] vencidas: ${expired.length}, purgadas: ${purged}, fallos: ${failed}`);
    res.status(200).json({ ok: failed === 0, expired: expired.length, purged, failed });
  } catch (err) {
    console.error(`[medical/purge-orders] ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
