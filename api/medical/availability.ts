import { computeFreeSlots, currentMinuteLima, minuteToTime, weekdayOf } from "./slots.js";
import { getLimaDayKey } from "../lib-lima.js";
import { getMedicalDb, notConfigured } from "./_shared.js";

// GET /api/medical/availability?doctor=<uuid>&date=YYYY-MM-DD
// Slots libres de un doctor en una fecha (público). Valida ventana de hoy.

export const maxDuration = 15;

interface Req {
  method?: string;
  url?: string;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
  setHeader(name: string, value: string): Res;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req: Req, res: Res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;

  const url = new URL(req.url ?? "/", "https://placeholder.local");
  const doctorId = url.searchParams.get("doctor") ?? "";
  const date = url.searchParams.get("date") ?? "";

  if (!UUID_RE.test(doctorId)) {
    res.status(400).json({ ok: false, error: "Doctor inválido." });
    return;
  }
  if (!DATE_RE.test(date)) {
    res.status(400).json({ ok: false, error: "Fecha inválida." });
    return;
  }

  const today = getLimaDayKey();
  if (date < today) {
    res.status(400).json({ ok: false, error: "La fecha ya pasó." });
    return;
  }

  try {
    const db = getMedicalDb()!;
    const config = await db.getConfig();
    const durationMinutes = Math.max(Number(config.appt_duration_minutes) || 60, 15);

    const schedules = await db.listDoctorSchedules(doctorId);
    const busy = await db.listApptsForDoctor(doctorId, date);
    const timeOffRows = (await db.listTimeOff(null, date, date)).filter((t) => t.doctorId === doctorId);

    const weekday = weekdayOf(date);
    const minStart = date === today ? currentMinuteLima() + 30 : 0;
    const slots = computeFreeSlots({
      durationMinutes,
      weekday,
      schedules,
      busy,
      timeOffBlocks: timeOffRows,
      minStartMinute: minStart,
    });

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      ok: true,
      date,
      durationMinutes,
      slots: slots.map((s) => ({
        startMinute: s.startMinute,
        endMinute: s.endMinute,
        label: `${minuteToTime(s.startMinute)}`,
      })),
    });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
