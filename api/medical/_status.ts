import { z } from "zod/v4";
import { isValidMedicalStatus } from "./db.js";
import { sendViaEvolution, normalizePhoneDest, type BookingEnv } from "../_booking.js";
import { minuteToTime } from "./slots.js";
import { getMedicalDb, notConfigured, staffGuard, BRANCH_LABELS, BRANCH_PHONES } from "./_shared.js";

// PATCH /api/medical/status  { id, status }
// Cambia el estado de una cita (flujo del panel). Solo staff.
// 'confirmada' → WhatsApp al cliente con los detalles.

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

function shortDateLima(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function buildConfirmationMessage(appt: {
  apptDate: string | null;
  startMinute: number | null;
  branchLabel: string;
  doctorName: string | null;
  specialtyName: string | null;
  petName: string;
  ownerName: string;
  appointmentCode: string;
  needsOrder: boolean;
  branchPhone: string;
}): string {
  const lines = [
    `🐾 *Cita confirmada, ${appt.ownerName.split(/\s+/)[0]}!*`,
    "",
    appt.specialtyName ? `🎓 ${appt.specialtyName}` : "📋 Consulta General",
    `🏥 ${appt.branchLabel}`,
    `🗓 ${appt.apptDate ? shortDateLima(appt.apptDate) : ""}${appt.startMinute !== null ? ` · ${minuteToTime(appt.startMinute)}` : ""}`,
    appt.doctorName ? `🩺 Doctor: ${appt.doctorName}` : "",
    `🐾 Mascota: ${appt.petName}`,
    "",
    `🔖 Código: *${appt.appointmentCode}*`,
  ];
  if (appt.needsOrder) {
    lines.push("", "📄 IMPORTANTE: preséntate con tu orden médica sellada por un médico.");
  }
  lines.push(
    "",
    "⚠️ Llega puntual; la tolerancia es de 10 minutos.",
    `☎ Consultas: ${appt.branchPhone}`,
    "",
    "¡Te esperamos! 🐶✨",
  );
  return lines.filter(Boolean).join("\n");
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
  if (!parsed.success || !isValidMedicalStatus(parsed.data.status)) {
    res.status(400).json({ ok: false, error: "Datos inválidos o estado desconocido." });
    return;
  }
  const { id, status } = parsed.data;

  try {
    const db = getMedicalDb()!;
    const appt = await db.findApptById(id);
    if (!appt) {
      res.status(404).json({ ok: false, error: "Cita no encontrada." });
      return;
    }

    const previous = appt.status;
    if (previous === status) {
      res.status(200).json({ ok: true, status, notified: false });
      return;
    }

    // Cambio atómico: solo el ganador registra timeline y notifica (2 PCs del
    // counter clickeando a la vez no generan doble WhatsApp de confirmación).
    const changed = await db.transitionApptStatus(id, previous, status, staff.email);
    if (!changed) {
      res.status(200).json({ ok: true, status, notified: false, stale: true });
      return;
    }

    // 'confirmada' → avisar al cliente (single corto, best-effort)
    let notified = false;
    if (status === "confirmada") {
      const env = process.env as BookingEnv;
      const dest = normalizePhoneDest(appt.ownerPhone);
      const evoReady = !!(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE);
      if (dest && (evoReady || env.EVOLUTION_DRY_RUN === "true")) {
        const text = buildConfirmationMessage({
          apptDate: appt.apptDate,
          startMinute: appt.startMinute,
          branchLabel: BRANCH_LABELS[appt.branch] ?? appt.branch,
          doctorName: appt.doctorName,
          specialtyName: appt.specialtyName,
          petName: appt.petName,
          ownerName: appt.ownerName,
          appointmentCode: appt.appointmentCode,
          needsOrder: appt.needsOrder,
          branchPhone: BRANCH_PHONES[appt.branch] ?? "",
        });
        const sent = await sendViaEvolution([text], env, fetch, dest);
        notified = sent.ok;
      }
    }

    res.status(200).json({ ok: true, status, notified });
  } catch (err) {
    console.error(`[medical/status] ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
