import { z } from "zod/v4";
import { getLabDb, notConfigured, staffGuard } from "./_shared.js";
import { newResultToken, resultAvailable, resultTokenHash, sendResultLink } from "./_access.js";

interface Req { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface Res { status(code: number): Res; json(payload: unknown): Res; setHeader(name: string, value: string): unknown }
const SCHEMA = z.object({ id: z.string().uuid() });

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Método no permitido." }); return; }
  if (notConfigured(res) || !(await staffGuard(req, res))) return;
  const parsed = SCHEMA.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: "Orden inválida." }); return; }
  try {
    const db = getLabDb()!;
    const order = await db.findOrderById(parsed.data.id);
    if (!order || !resultAvailable(order)) {
      res.status(404).json({ ok: false, error: "El resultado no está disponible o ya venció." }); return;
    }
    const token = newResultToken();
    const updated = await db.rotateResultAccess(order.id, order.resultPath!, order.resultPublishedAt!, resultTokenHash(token));
    if (!updated) { res.status(409).json({ ok: false, error: "El resultado cambió. Actualiza la orden e intenta de nuevo." }); return; }
    const notified = await sendResultLink(order, token);
    res.status(200).json({ ok: true, notified });
  } catch {
    res.status(500).json({ ok: false, error: "No pudimos enviar el enlace. Intenta nuevamente." });
  }
}
