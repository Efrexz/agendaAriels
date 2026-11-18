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
  /** true = reemplaza el PRIMER archivo (corrección del counter). Sin flag,
   *  cuando ya hay resultado el archivo se registra como ADICIONAL. */
  replace: z.boolean().optional(),
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
      // ?result=<uuid> → URL de un archivo ADICIONAL concreto (panel del counter).
      const extraId = (url.searchParams.get("result") ?? "").trim();
      let path = order.resultPath;
      let name = order.resultName || order.orderCode;
      if (extraId) {
        if (!/^[0-9a-f-]{36}$/.test(extraId)) {
          res.status(400).json({ ok: false, error: "Id de resultado inválido." });
          return;
        }
        const extras = await db.listExtraResults(id);
        const target = extras.find((e) => e.id === extraId);
        if (!target) {
          res.status(404).json({ ok: false, error: "No existe ese resultado adicional." });
          return;
        }
        path = target.path;
        name = target.name;
      }
      const { data, error } = await client.storage.from("lab-results").createSignedUrl(path, 600);
      if (error || !data) {
        console.error(`[lab/result GET] ${error?.message ?? "sin URL"}`);
        res.status(500).json({ ok: false, error: "No pudimos generar el link del resultado." });
        return;
      }
      // Lista completa para el panel (principal + adicionales).
      const extras = extraId ? [] : await db.listExtraResults(id);
      const results: Array<{ id: string; name: string; url: string }> = [
        { id: "principal", name: order.resultName || order.orderCode, url: data.signedUrl },
      ];
      for (const ex of extras) {
        const signed = await client.storage.from("lab-results").createSignedUrl(ex.path, 600);
        if (signed.data?.signedUrl) results.push({ id: ex.id, name: ex.name, url: signed.data.signedUrl });
      }
      res.status(200).json({
        ok: true,
        url: data.signedUrl,
        name,
        results,
      });
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

      // Reemplazo EXPLÍCITO del primer archivo (corrección del counter):
      // mismo flujo de siempre — nuevo token + enlace por WhatsApp.
      if (order.resultPath && order.resultPath !== path && parsed.data.replace === true) {
        const token = newResultToken();
        const published = await db.setResultFile(id, path, name, resultTokenHash(token), order.resultPath);
        if (!published) {
          res.status(409).json({ ok: false, error: "La orden o el resultado cambió. Actualiza e intenta nuevamente." });
          return;
        }
        try {
          const { error } = await serviceClient()!.storage.from("lab-results").remove([order.resultPath]);
          if (error) console.warn("[lab/result POST] No se pudo borrar el archivo anterior.");
        } catch {
          console.warn("[lab/result POST] No se pudo borrar el archivo anterior.");
        }
        const notified = await sendResultLink(order, token);
        res.status(200).json({ ok: true, notified, added: false });
        return;
      }

      // SIN resultado aún: el PRIMER archivo (flujo original intacto).
      if (!order.resultPath) {
        const token = newResultToken();
        const published = await db.setResultFile(id, path, name, resultTokenHash(token), null);
        if (!published) {
          res.status(409).json({ ok: false, error: "La orden o el resultado cambió. Actualiza e intenta nuevamente." });
          return;
        }
        const notified = await sendResultLink(order, token);
        res.status(200).json({ ok: true, notified, added: false });
        return;
      }

      // Resultado ya publicado (mismo path: nada por hacer) → archivo
      // ADICIONAL (feedback 17/11: 2-3 exámenes por paciente). Comparten el
      // token y la ventana de la orden — NO se reenvía el enlace (ya lo tiene).
      if (order.resultPath === path) {
        res.status(409).json({ ok: false, error: "Ese archivo ya está registrado en la orden." });
        return;
      }
      const extras = await db.listExtraResults(id);
      if (extras.length >= 5) {
        res.status(409).json({ ok: false, error: "Esta orden ya tiene 5 resultados adicionales." });
        return;
      }
      const added = await db.addExtraResult(id, path, name, "counter");
      if (!added) {
        res.status(409).json({ ok: false, error: "Ese archivo ya está registrado en la orden." });
        return;
      }
      res.status(200).json({ ok: true, notified: false, added: true });
      return;
    }

    // DELETE ?id= → el PRIMER archivo (flujo original). DELETE ?id=&result=<uuid>
    // → un archivo adicional.
    const id = (url.searchParams.get("id") ?? "").trim();
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      res.status(400).json({ ok: false, error: "Id inválido." });
      return;
    }
    const extraId = (url.searchParams.get("result") ?? "").trim();
    if (extraId) {
      if (!/^[0-9a-f-]{36}$/.test(extraId)) {
        res.status(400).json({ ok: false, error: "Id de resultado inválido." });
        return;
      }
      const extras = await db.listExtraResults(id);
      const target = extras.find((e) => e.id === extraId);
      if (!target) {
        res.status(404).json({ ok: false, error: "No existe ese resultado adicional." });
        return;
      }
      const client = serviceClient()!;
      const { error: storageError } = await client.storage.from("lab-results").remove([target.path]);
      if (storageError) {
        res.status(503).json({ ok: false, error: "No se pudo borrar el archivo. Intenta nuevamente." });
        return;
      }
      const removed = await db.removeExtraResult(id, extraId, target.path);
      if (!removed) {
        res.status(409).json({ ok: false, error: "El resultado cambió. Actualiza la orden antes de continuar." });
        return;
      }
      res.status(200).json({ ok: true });
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
    // Coherencia: sin resultado principal no hay token/ventana → los
    // adicionales se van con él (mismo ciclo de publicación).
    const extraPaths = await db.listExtraPaths(id);
    if (extraPaths.length > 0) {
      try {
        await serviceClient()!.storage.from("lab-results").remove(extraPaths);
      } catch {
        console.warn("[lab/result DELETE] No se pudieron borrar los archivos adicionales del storage.");
      }
      await db.deleteExtraResultsOfOrder(id);
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`[lab/result] ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
