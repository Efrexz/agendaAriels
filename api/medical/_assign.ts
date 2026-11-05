import { z } from "zod/v4";
import { addDays, format } from "date-fns";
import { getLimaDayKey } from "../lib-lima.js";
import { currentMinuteLima, weekdayOf } from "./slots.js";
import { getMedicalDb, notConfigured, staffGuard } from "./_shared.js";
import { sendViaEvolution, normalizePhoneDest, type BookingEnv, } from "../_booking.js";
import { buildConfirmationMessage, } from "./_status.js";
import { BRANCH_LABELS, BRANCH_PHONES } from "./_shared.js";
import { MedicalSlotConflictError } from "./errors.js";

// POST /api/medical/assign  { id, doctorId?, apptDate?, startMinute?, paymentNotes? }
// • Especializada: counter asigna doctor/fecha/hora (tras 'pagado') → 'asignada'.
// • Solicitud de PRÓXIMA semana (general/rayos/eco, sin hora): counter confirma
//   fecha/hora con la agenda real del lunes → 'confirmada' + WhatsApp con detalles.

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

const ASSIGN_SCHEMA = z.object({
  id: z.string().uuid(),
  doctorId: z.string().uuid().nullable().optional(),
  apptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  startMinute: z.number().int().min(0).max(1380).nullable().optional(),
  paymentNotes: z.string().trim().max(300).optional(),
});

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  const parsed = ASSIGN_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Datos inválidos." });
    return;
  }
  const { id, doctorId, apptDate, startMinute, paymentNotes } = parsed.data;

  try {
    const db = getMedicalDb()!;
    const appt = await db.findApptById(id);
    if (!appt) {
      res.status(404).json({ ok: false, error: "Cita no encontrada." });
      return;
    }
    if (appt.serviceType !== "especializada") {
      // Solicitud de PRÓXIMA semana (sin hora): counter confirma con fecha/
      // hora de la agenda real cargada el lunes; el cliente recibe WhatsApp.
      if (appt.status !== "solicitud") {
        res.status(409).json({ ok: false, error: "Esta solicitud ya fue confirmada o cambió." });
        return;
      }
    } else {
      if (appt.status !== "solicitud" && appt.status !== "pagado") {
        res.status(409).json({ ok: false, error: `Esta cita ya está en estado ${appt.status}.` });
        return;
      }
      // Para asignar se exige pago verificado
      if (appt.status !== "pagado") {
        res.status(409).json({ ok: false, error: "Verifica el pago primero (estado 'pagado')." });
        return;
      }
    }
    if (!doctorId || !apptDate || startMinute === undefined || startMinute === null) {
      res.status(400).json({ ok: false, error: "Falta doctor, fecha u hora para asignar." });
      return;
    }
    // Valida doctor de la sede
    const doctors = await db.listDoctors(appt.branch, null);
    const doctor = doctors.find((d) => d.id === doctorId && d.active) ?? null;
    if (!doctor) {
      res.status(400).json({ ok: false, error: "Doctor no disponible en esa sede." });
      return;
    }
    // Duración efectiva desde app_config; las citas por asignar guardan 0.
    const config = await db.getConfig();
    const duration = Math.max(Number(config.appt_duration_minutes) || 60, 15);
    const durOf = (d: number | null) => (d && d > 0 ? d : duration);

    // Fecha válida: hoy (Lima) → +30 días.
    const today = getLimaDayKey();
    const maxDay = format(addDays(new Date(`${today}T12:00:00Z`), 30), "yyyy-MM-dd");
    if (apptDate < today || apptDate > maxDay) {
      res.status(400).json({ ok: false, error: "Fecha fuera del rango permitido (máx. 30 días)." });
      return;
    }

    // Slot válido sin exigir grilla (el counter puede dar 9:15/9:20):
    // ① dentro del horario semanal del doctor cubriendo la duración completa,
    // ② sin solapamiento con citas (duración efectiva) ni ausencias,
    // ③ hoy solo desde hora actual + 10 min.
    const busy = await db.listApptsForDoctor(doctorId, apptDate);
    const timeOff = (await db.listTimeOff(null, apptDate, apptDate)).filter(
      (t) => t.doctorId === doctorId,
    );
    const end = startMinute + duration;
    if (apptDate === today && startMinute < currentMinuteLima() + 10) {
      res.status(409).json({ ok: false, error: "Esa hora ya pasó (hoy se asigna con 10 min de margen)." });
      return;
    }
    const weekday = weekdayOf(apptDate);
    const schedules = await db.listDoctorSchedules(doctorId);
    const inWindow = schedules.some(
      (s) => s.weekday === weekday && startMinute >= s.startMinute && end <= s.endMinute,
    );
    if (!inWindow) {
      res.status(409).json({ ok: false, error: "Esa hora no está dentro del horario del doctor." });
      return;
    }
    const overlaps =
      busy.some(
        (b) => (b.startMinute ?? 0) < end && (b.startMinute ?? 0) + durOf(b.durationMinutes) > startMinute,
      ) ||
      timeOff.some(
        (t) => t.startMinute === null || t.endMinute === null || (t.startMinute < end && t.endMinute > startMinute),
      );
    if (overlaps) {
      res.status(409).json({ ok: false, error: "El doctor ya tiene una cita (o ausencia) en ese horario." });
      return;
    }

    const asignada = await db.assignAppt(
      id,
      { doctorId, apptDate, startMinute, paymentNotes: paymentNotes ?? undefined, durationMinutes: duration },
      staff.email,
      "confirmada",
      appt.status,
    );
    if (!asignada) {
      res.status(409).json({ ok: false, error: "La cita ya cambió. Actualiza la lista antes de asignarla." });
      return;
    }

    // La solicitud confirmada recibe el WhatsApp oficial con fecha/hora/doctor.
    let notified = false;
    if (appt.serviceType !== "especializada") {
      const env = process.env as BookingEnv;
      const dest = normalizePhoneDest(appt.ownerPhone);
      const evoReady = !!(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE);
      const dryRun = env.EVOLUTION_DRY_RUN === "true" || env.EVOLUTION_DRY_RUN === "1";
      if (dest && (evoReady || dryRun)) {
        const sent = await sendViaEvolution(
          [buildConfirmationMessage({
            apptDate,
            startMinute,
            branchLabel: BRANCH_LABELS[appt.branch] ?? appt.branch,
            doctorName: (await db.findApptById(id))?.doctorName ?? doctor.fullName,
            specialtyName: appt.specialtyName,
            petName: appt.petName,
            ownerName: appt.ownerName,
            appointmentCode: appt.appointmentCode,
            needsOrder: appt.needsOrder,
            branchPhone: BRANCH_PHONES[appt.branch] ?? "",
          })],
          env,
          fetch,
          dest,
        );
        notified = sent.ok;
        // Marca del aviso en el historial (⚠ + reenvío en el panel). Best-effort.
        if (evoReady && !dryRun) {
          try { await db.recordWhatsappNotice(id, sent.ok); } catch { /* best-effort */ }
        }
      }
    }
    res.status(200).json({ ok: true, status: "confirmada", notified });
  } catch (err) {
    if (err instanceof MedicalSlotConflictError) {
      res.status(409).json({ ok: false, error: "El doctor ya tiene una cita en ese horario. Elige otro." });
      return;
    }
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
