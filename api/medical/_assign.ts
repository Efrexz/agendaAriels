import { z } from "zod/v4";
import { addDays, format } from "date-fns";
import { getLimaDayKey } from "../lib-lima.js";
import { currentMinuteLima, weekdayOf } from "./slots.js";
import { getMedicalDb, notConfigured, staffGuard } from "./_shared.js";

// POST /api/medical/assign  { id, doctorId?, apptDate?, startMinute?, paymentNotes? }
// Counter asigna doctor/fecha/hora (y notas de pago) a una especializada.
// Pasa a 'asignada'. Luego counter marca 'confirmada' con PATCH /status.

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
      res.status(400).json({ ok: false, error: "Solo las especializadas se asignan manualmente." });
      return;
    }
    if (appt.status !== "solicitud" && appt.status !== "pagado") {
      res.status(409).json({ ok: false, error: `Esta cita ya está en estado ${appt.status}.` });
      return;
    }
    // Para asignar se exige pago verificado
    if (appt.status !== "pagado") {
      res.status(409).json({ ok: false, error: "Verifica el pago primero (estado 'pagado')." });
      return;
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

    await db.assignAppt(
      id,
      { doctorId, apptDate, startMinute, paymentNotes: paymentNotes ?? undefined, durationMinutes: duration },
      staff.email,
      "asignada",
    );
    res.status(200).json({ ok: true, status: "asignada" });  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
