import { z } from "zod/v4";
import { isValidMedicalStatus } from "./db.js";
import { sendViaEvolution, normalizePhoneDest, type BookingEnv } from "../_booking.js";
import { minuteToTime } from "./slots.js";
import { getMedicalDb, notConfigured, staffGuard, BRANCH_LABELS, BRANCH_PHONES } from "./_shared.js";
import { MedicalSlotConflictError } from "./errors.js";

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
  // Feedback 17/11 del dueño: la consecuencia de la tolerancia cambia por tipo
  // de consulta. General: entra el siguiente en espera. Especializada: doctor
  // externo con agenda reservada → tolerancia + regla de 24h con penalización.
  if (appt.specialtyName) {
    lines.push(
      "",
      "⚠️ La tolerancia es de 10 minutos: el especialista reserva un espacio en su agenda y atiende a otros pacientes.",
      "ℹ️ Recuerda: cancela o cambia tu cita con 24 horas de anticipación; después se aplica una penalización.",
    );
  } else {
    lines.push(
      "",
      "⚠️ Llega puntual; la tolerancia es de 10 minutos y luego atendemos al siguiente en espera.",
    );
  }
  lines.push(
    `☎ Consultas: ${appt.branchPhone}`,
    "",
    "¡Te esperamos! 🐶✨",
  );
  return lines.filter(Boolean).join("\n");
}

/** Mensaje-encuesta al terminar la atención (feedback 16/11 del dueño):
 *  corto, se responde EN el propio chat (sin links de formularios) y cierra
 *  invitando a la reseña de Google de la sede (si ya está configurada). */
export function buildSurveyMessage(appt: {
  ownerName: string;
  petName: string;
  appointmentCode: string;
}, googleUrl: string | null): string {
  const lines = [
    `🐾 *¡Gracias por su visita, ${appt.ownerName.split(/\s+/)[0]}!*`,
    `💙 *${appt.petName}* ya fue atendido/a.`,
    "",
    "Su opinión nos ayuda a mejorar cada día. ¿Nos responde aquí mismo? 🙏",
    "1️⃣ Del 1 al 5, ¿cómo califica la atención?",
    "2️⃣ ¿Nos recomendaría con sus conocidos?",
    "3️⃣ ¿Algo que podamos mejorar?",
  ];
  // Feedback 18/11: "si nos llevó bien" sonaba confuso — ahora pide la
  // reseña de forma clara y amable.
  if (googleUrl) lines.push("", `⭐ Si le gustó la atención, califíquenos en Google: ${googleUrl}`);
  lines.push("", `🔖 Su código: ${appt.appointmentCode}`, "¡Gracias por confiar en Ariel's Clinic! 🐶✨");
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
      res.status(409).json({ ok: false, error: "La cita cambió. Actualiza la lista antes de continuar." });
      return;
    }

    // 'confirmada' → avisar al cliente (single corto, best-effort)
    // 'atendida'   → encuesta corta + link de Google de la sede (best-effort)
    let notified = false;
    if (status === "confirmada" || status === "atendida") {
      const env = process.env as BookingEnv;
      const dest = normalizePhoneDest(appt.ownerPhone);
      const evoReady = !!(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE);
      if (dest && (evoReady || env.EVOLUTION_DRY_RUN === "true")) {
        const text =
          status === "confirmada"
            ? buildConfirmationMessage({
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
              })
            : buildSurveyMessage(
                { ownerName: appt.ownerName, petName: appt.petName, appointmentCode: appt.appointmentCode },
                (await db.getConfig())[`google_review_url_${appt.branch}`] || null,
              );
        const sent = await sendViaEvolution([text], env, fetch, dest);
        notified = sent.ok;
        // Marca del aviso en el historial (⚠ + reenvío en el panel). Best-effort
        // y solo con Evolution de verdad configurada (el dry-run no marca).
        if (evoReady) {
          try { await db.recordWhatsappNotice(id, sent.ok); } catch { /* best-effort */ }
        }
      }
    }

    res.status(200).json({ ok: true, status, notified });
  } catch (err) {
    if (err instanceof MedicalSlotConflictError) {
      res.status(409).json({ ok: false, error: "El horario ya está ocupado por otra cita." });
      return;
    }
    console.error(`[medical/status] ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
