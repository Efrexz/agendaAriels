import { z } from "zod/v4";
import { createClient } from "@supabase/supabase-js";
import { getLabDb, notConfigured, staffGuard } from "./_shared.js";
import { newResultToken, resultTokenHash, sendResultLink } from "./_access.js";

// ─────────────────────────────────────────────────────────────
// /api/internal/lab/result  (solo staff)
// • POST   { id, path, name, mime, size } → registra el archivo que el
//          counter YA subió directo al bucket privado (supabase-js del
//          navegador con su JWT; policy "staff upload lab results").
//          Marca result_published_at = ahora → arranca la ventana de 20 días.
// • GET ?id= → URL firmada de 10 minutos para que el counter lo abra.
// • DELETE ?id= → borra el objeto del storage + limpia las columnas.
// Reglas: PDF/JPEG/PNG, hasta 25 MB (evaluado en el cliente), path DEBE
// pertenecer a la orden ("<orderId>/...") — nombrado sin datos del dueño.
// ─────────────────────────────────────────────────────────────

export const maxDuration = 30;

interface Req {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

const POST_SCHEMA = z.object({
  id: z.string().uuid(),
  path: z.string().min(3).max(300),
  name: z.string().trim().min(1).max(200),
  mime: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  size: z.number().int().min(1).max(25 * 1024 * 1024),
});

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST" && req.method !== "GET" && req.method !== "DELETE") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  const url = new URL(req.url ?? "/", "https://placeholder.local");
  const db = getLabDb()!;

  try {
    if (req.method === "GET") {
      const id = (url.searchParams.get("id") ?? "").trim();
      if (!/^[0-9a-f-]{36}$/.test(id)) {
        res.status(400).json({ ok: false, error: "Id inválido." });
        return;
      }
      const order = await db.findOrderById(id);
      if (!order?.resultPath) {
        res.status(404).json({ ok: false, error: "La orden no tiene resultado publicado." });
        return;
      }
      const client = serviceClient()!;
      const { data, error } = await client.storage.from("lab-results").createSignedUrl(order.resultPath, 600);
      if (error || !data) {
        console.error(`[lab/result GET] ${error?.message ?? "sin URL"}`);
        res.status(500).json({ ok: false, error: "No pudimos generar el link del resultado." });
        return;
      }
      res.status(200).json({ ok: true, url: data.signedUrl, name: order.resultName || order.orderCode });
      return;
    }

    if (req.method === "POST") {
      const parsed = POST_SCHEMA.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ ok: false, error: "Archivo inválido (PDF/JPG/PNG, hasta 25 MB)." });
        return;
      }
      const { id, path, name, } = parsed.data;
      // El archivo DEBE vivir dentro de la carpeta de su propia orden:
      // un id ajeno (o path malformado) no se registra.
      if (!path.startsWith(`${id}/`)) {
        res.status(400).json({ ok: false, error: "Ruta del archivo inválida." });
        return;
      }
      const order = await db.findOrderById(id);
      if (!order) {
        res.status(404).json({ ok: false, error: "Orden no encontrada." });
        return;
      }
      if (order.status !== "resultado_listo") {
        res.status(409).json({ ok: false, error: "Solo se publica el resultado con la orden en 'Resultado listo'." });
        return;
      }
      const token = newResultToken();
      const published = await db.setResultFile(id, path, name, resultTokenHash(token), order.resultPath);
      if (!published) {
        res.status(409).json({ ok: false, error: "La orden o el resultado cambió. Actualiza e intenta nuevamente." });
        return;
      }
      // Solo borrar el anterior después de registrar el reemplazo. Storage puede
      // devolver error sin lanzar excepción; en ese caso queda un huérfano.
      if (order.resultPath && order.resultPath !== path) {
        try {
          const { error } = await serviceClient()!.storage.from("lab-results").remove([order.resultPath]);
          if (error) console.warn("[lab/result POST] No se pudo borrar el archivo anterior.");
        } catch {
          console.warn("[lab/result POST] No se pudo borrar el archivo anterior.");
        }
      }
      const notified = await sendResultLink(order, token);
      res.status(200).json({ ok: true, notified });
      return;
    }

    // DELETE
    const id = (url.searchParams.get("id") ?? "").trim();
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      res.status(400).json({ ok: false, error: "Id inválido." });
      return;
    }
    const order = await db.findOrderById(id);
    if (!order?.resultPath) {
      res.status(404).json({ ok: false, error: "No hay resultado publicado en esta orden." });
      return;
    }
    if (order.status === "entregada") {
      res.status(409).json({ ok: false, error: "La orden ya fue entregada; no se puede borrar el resultado." });
      return;
    }
    const client = serviceClient()!;
    const { error: storageError } = await client.storage.from("lab-results").remove([order.resultPath]);
    if (storageError) {
      res.status(503).json({ ok: false, error: "No se pudo borrar el archivo. Intenta nuevamente." });
      return;
    }
    const cleared = await db.clearResultFile(id, order.resultPath);
    if (!cleared) {
      res.status(409).json({ ok: false, error: "El resultado cambió. Actualiza la orden antes de continuar." });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`[lab/result] ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
