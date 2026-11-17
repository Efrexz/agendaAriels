import { z } from "zod/v4";
import { getLabDb, notConfigured, staffGuard } from "./_shared.js";

// POST /api/internal/lab/sample-date  { id, date }  (solo staff)
// Fecha de toma de muestra de una solicitud de lab (feedback 18/11): el
// counter la fija al coordinar con el cliente — SIN hora (la toma la hace
// cualquier personal) y sin WhatsApp automático: el mensaje manual de
// coordinación de la card ya trae el costo; la fecha se escribe ahí.
// date null = quitar la fecha (se equivocaron de día).

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

const BODY_SCHEMA = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  const parsed = BODY_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Fecha inválida." });
    return;
  }
  const { id, date } = parsed.data;

  try {
    const db = getLabDb()!;
    const order = await db.findOrderById(id);
    if (!order) {
      res.status(404).json({ ok: false, error: "Orden no encontrada." });
      return;
    }
    // Solo en 'solicitada' (una vez tomada la muestra la fecha es historia).
    if (order.status !== "solicitada") {
      res.status(409).json({ ok: false, error: "Solo se fija fecha en solicitudes por confirmar." });
      return;
    }
    await db.setSampleDate(id, date);
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
