import { z } from "zod/v4";
import { addDays, format } from "date-fns";
import { getLimaDayKey } from "../lib-lima.js";
import { currentMinuteLima, weekdayOf } from "./slots.js";
import { getMedicalDb, notConfigured, staffGuard, BRANCH_LABELS, BRANCH_PHONES } from "./_shared.js";
import { sendViaEvolution, normalizePhoneDest, type BookingEnv } from "../_booking.js";
import { MedicalSlotConflictError } from "./errors.js";

// PATCH /api/medical/reschedule  { id, doctorId, apptDate, startMinute }
// Cambiar horario (y doctor) de una cita CONFIRMADA sin cancelarla: al
// cliente se le presenta algo o el counter se equivocó. Mismo candado duro
// que la asignación (horario del doctor, sin solapamientos, hoy con margen).
// Reversible: puede volver a cambiarse cuantas veces haga falta (cada cambio
// queda en el historial como "reprogramada") y el WhatsApp del nuevo
// horario registra su entrega (M1). El código de cita NO cambia.

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

const BODY_SCHEMA = z.object({
  id: z.string().uuid(),
  doctorId: z.string().uuid(),
  apptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinute: z.number().int().min(0).max(1380),
});

function shortDateLima(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function minuteToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Mensaje del cambio de horario (corto; el detalle va en el historial). */
export function buildRescheduleMessage(appt: {
  ownerName: string;
  petName: string;
  specialtyName: string | null;
  branchLabel: string;
  doctorName: string | null;
  oldDate: string | null;
  oldMinute: number | null;
  newDate: string;
  newMinute: number;
  appointmentCode: string;
  branchPhone: string;
}): string {
  const before = appt.oldDate
    ? `${shortDateLima(appt.oldDate)}${appt.oldMinute !== null ? ` · ${minuteToTime(appt.oldMinute)}` : ""}`
    : "(sin horario)";
  const lines = [
    `🕐 *Cambiamos el horario de tu cita, ${appt.ownerName.split(/\s+/)[0]}!*`,
    "",
    `🐾 Mascota: ${appt.petName}`,
    appt.specialtyName ? `🎓 ${appt.specialtyName}` : "📋 Consulta General",
    `🏥 ${appt.branchLabel}`,
    "",
    `❌ Antes: ${before}`,
    `✅ *Nueva cita: ${shortDateLima(appt.newDate)} · ${minuteToTime(appt.newMinute)}*`,
    appt.doctorName ? `🩺 Doctor: ${appt.doctorName}` : "",
    "",
    `🔖 Código (no cambia): *${appt.appointmentCode}*`,
    "",
    // Feedback 17/11 del dueño: consecuencia de la tolerancia por tipo de consulta.
    ...(appt.specialtyName
      ? [
          "⚠️ La tolerancia es de 10 minutos: el especialista reserva un espacio en su agenda y atiende a otros pacientes.",
          "ℹ️ Recuerda: cancela o cambia tu cita con 24 horas de anticipación; después se aplica una penalización.",
        ]
      : ["⚠️ Llega puntual; la tolerancia es de 10 minutos y luego atendemos al siguiente en espera."]),
    `☎ Consultas: ${appt.branchPhone}`,
    "",
    "¡Te esperamos! 🐶✨",
  ];
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

  const parsed = BODY_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Datos inválidos." });
    return;
  }
  const { id, doctorId, apptDate, startMinute } = parsed.data;

  try {
    const db = getMedicalDb()!;
    const appt = await db.findApptById(id);
    if (!appt) {
      res.status(404).json({ ok: false, error: "Cita no encontrada." });
      return;
    }
    if (appt.status !== "confirmada") {
      res.status(409).json({ ok: false, error: "Solo se puede cambiar el horario de una cita confirmada." });
      return;
    }
    if (appt.apptDate === apptDate && appt.startMinute === startMinute && appt.doctorId === doctorId) {
      res.status(400).json({ ok: false, error: "La cita ya tiene ese horario y doctor; no hay cambios." });
      return;
    }

    // Doctor de la sede y del tipo correcto (generales atienden general/
    // rayos/eco; especialistas las especializadas — igual que el wizard).
    const doctors = await db.listDoctors(appt.branch, null);
    const doctor = doctors.find((d) => d.id === doctorId && d.active) ?? null;
    if (!doctor) {
      res.status(400).json({ ok: false, error: "Doctor no disponible en esa sede." });
      return;
    }
    const wantKind = appt.serviceType === "especializada" ? "especialista" : "general";
    if (doctor.kind !== wantKind) {
      res.status(400).json({
        ok: false,
        error: appt.serviceType === "especializada"
          ? "Las especializadas solo con doctor especialista."
          : "Las consultas generales/rayos/eco solo con doctor general.",
      });
      return;
    }

    // Duración efectiva: la propia cita (si tiene) o la de app_config.
    const config = await db.getConfig();
    const duration = appt.durationMinutes > 0 ? appt.durationMinutes : Math.max(Number(config.appt_duration_minutes) || 60, 15);

    // Fecha válida: hoy (Lima) → +30 días; hoy solo con 10 min de margen.
    const today = getLimaDayKey();
    const maxDay = format(addDays(new Date(`${today}T12:00:00Z`), 30), "yyyy-MM-dd");
    if (apptDate < today || apptDate > maxDay) {
      res.status(400).json({ ok: false, error: "Fecha fuera del rango permitido (máx. 30 días)." });
      return;
    }
    if (apptDate === today && startMinute < currentMinuteLima() + 10) {
      res.status(409).json({ ok: false, error: "Esa hora ya pasó (hoy se asigna con 10 min de margen)." });
      return;
    }

    // Dentro del horario semanal del doctor cubriendo la duración completa.
    const end = startMinute + duration;
    const weekday = weekdayOf(apptDate);
    const schedules = await db.listDoctorSchedules(doctorId);
    const inWindow = schedules.some(
      (s) => s.weekday === weekday && startMinute >= s.startMinute && end <= s.endMinute,
    );
    if (!inWindow) {
      res.status(409).json({ ok: false, error: "Esa hora no está dentro del horario del doctor." });
      return;
    }

    // Sin solapamiento (excluyendo ESTA cita) ni ausencias del doctor.
    const busy = await db.listBusyForDoctor(doctorId, apptDate, id);
    const timeOff = (await db.listTimeOff(null, apptDate, apptDate)).filter((t) => t.doctorId === doctorId);
    const overlaps =
      busy.some((b) => b.startMinute < end && b.startMinute + b.durationMinutes > startMinute) ||
      timeOff.some(
        (t) => t.startMinute === null || t.endMinute === null || (t.startMinute < end && t.endMinute > startMinute),
      );
    if (overlaps) {
      res.status(409).json({ ok: false, error: "El doctor ya tiene una cita (o ausencia) en ese horario." });
      return;
    }

    // Aplica con guard atómico (p_from = confirmada; p_status null = NO
    // mete ruido de timeline en la RPC — el marcador lo ponemos nosotros).
    const changed = await db.assignAppt(
      id,
      { doctorId, apptDate, startMinute, durationMinutes: duration },
      staff.email,
      null,
      "confirmada",
    );
    if (!changed) {
      res.status(409).json({ ok: false, error: "La cita cambió. Actualiza la lista antes de continuar." });
      return;
    }
    // Marcador del historial: el panel lo muestra como "🕐 Reprogramada".
    try { await db.recordApptStatus(id, "reprogramada", staff.email); } catch { /* best-effort */ }

    // WhatsApp con el horario nuevo (best-effort; marca su entrega, M1).
    let notified = false;
    {
      const env = process.env as BookingEnv;
      const dest = normalizePhoneDest(appt.ownerPhone);
      const evoReady = !!(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE);
      if (dest && (evoReady || env.EVOLUTION_DRY_RUN === "true")) {
        const text = buildRescheduleMessage({
          ownerName: appt.ownerName,
          petName: appt.petName,
          specialtyName: appt.specialtyName,
          branchLabel: BRANCH_LABELS[appt.branch] ?? appt.branch,
          doctorName: doctor.fullName,
          oldDate: appt.apptDate,
          oldMinute: appt.startMinute,
          newDate: apptDate,
          newMinute: startMinute,
          appointmentCode: appt.appointmentCode,
          branchPhone: BRANCH_PHONES[appt.branch] ?? "",
        });
        const sent = await sendViaEvolution([text], env, fetch, dest);
        notified = sent.ok;
        if (evoReady) {
          try { await db.recordWhatsappNotice(id, sent.ok); } catch { /* best-effort */ }
        }
      }
    }

    res.status(200).json({ ok: true, notified });
  } catch (err) {
    if (err instanceof MedicalSlotConflictError) {
      res.status(409).json({ ok: false, error: "El doctor ya tiene una cita en ese horario. Elige otro." });
      return;
    }
    console.error(`[medical/reschedule] ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
