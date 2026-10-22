import { z } from "zod/v4";
import { sendViaEvolution, normalizePhoneDest, type BookingEnv } from "../_booking.js";
import { isValidLabStatus } from "./db.js";
import { getLabDb, notConfigured, staffGuard, LAB_BRANCH_LABELS } from "./_shared.js";

// PATCH /api/internal/lab/status  { id, status }  (solo staff)
// Cambio de estado atómico con timeline. Al entrar a 'resultado_listo'
// se avisa automáticamente al cliente por WhatsApp ( Evolution, best-effort).

export const maxDuration = 30;

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

const PATCH_SCHEMA = z.object({
  id: z.string().uuid(),
  status: z.string(),
});

function shortDateLima(): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date());
}

export function buildLabResultMessage(order: {
  orderCode: string;
  petName: string;
  examType: string;
  labName: string;
  ownerName: string;
  sedeResponsable: string;
  ownerPhone: string;
}): string {
  const lines = [
    `🧪 *¡Resultados listos, ${order.ownerName.split(/\s+/)[0]}!*`,
    "",
    `🐾 Mascota: ${order.petName} · Examen: ${order.examType}`,
    `🏥 Recoge el resultado y la explicación de tu doctor en: ${LAB_BRANCH_LABELS[order.sedeResponsable] ?? order.sedeResponsable}`,
    `🗓 A partir de: ${shortDateLima()}`,
    `🔖 Código: *${order.orderCode}*`,
    "",
    "¡Gracias por tu confianza! 🐶✨",
  ];
  return lines.join("\n");
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "PATCH") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  const parsed = PATCH_SCHEMA.safeParse(req.body);
  if (!parsed.success || !isValidLabStatus(parsed.data.status)) {
    res.status(400).json({ ok: false, error: "Datos inválidos o estado desconocido." });
    return;
  }
  const { id, status } = parsed.data;

  try {
    const db = getLabDb()!;
    const order = await db.findOrderById(id);
    if (!order) {
      res.status(404).json({ ok: false, error: "Orden no encontrada." });
      return;
    }

    const previous = order.status;
    if (previous === status) {
      res.status(200).json({ ok: true, status, notified: false });
      return;
    }

    // Cambio atómico: solo el ganador registra timeline y notifica (2 PCs del
    // counter a la vez no envíam doble WhatsApp de "resultados listos").
    const changed = await db.transitionOrderStatus(id, previous, status, staff.email);
    if (!changed) {
      res.status(200).json({ ok: true, status, notified: false, stale: true });
      return;
    }

    // 'resultado_listo' → WhatsApp al dueño (best-effort)
    let notified = false;
    if (status === "resultado_listo") {
      const env = process.env as BookingEnv;
      const dest = normalizePhoneDest(order.ownerPhone);
      const evoReady = !!(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE);
      const dryRun = env.EVOLUTION_DRY_RUN === "true" || env.EVOLUTION_DRY_RUN === "1";
      if (dest && (evoReady || dryRun)) {
        const text = buildLabResultMessage({
          orderCode: order.orderCode,
          petName: order.petName,
          examType: order.examType,
          labName: order.labName,
          ownerName: order.ownerName,
          sedeResponsable: order.sedeResponsable,
          ownerPhone: order.ownerPhone,
        });
        const sent = await sendViaEvolution([text], env, fetch, dest);
        notified = sent.ok;
      }
    }

    res.status(200).json({ ok: true, status, notified });
  } catch (err) {
    console.error(`[lab/status] ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
