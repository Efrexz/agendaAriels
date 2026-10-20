import { sendViaEvolution, normalizePhoneDest, type BookingEnv } from "../_booking.js";
import { getLimaDayKey } from "../lib-lima.js";
import { minuteToTime } from "./slots.js";
import { BRANCH_LABELS, getMedicalDb } from "./_shared.js";

// GET /api/medical/reminders — CRON DIARIO (vercel.json: 23:00 UTC = 18:00 Lima).
// Recordatorio del día ANTES al cliente con cita confirmada mañana + resumen al counter.
// Protegido con CRON_SECRET (header Authorization: Bearer). Sin secret (dev): abierto.

export const maxDuration = 60;

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface Res {
  status(code: number): Res;
  json(payload: unknown): Res;
}

/** Hora en formato 12h am/pm: 600 → "10:00 am" */
function hora12(min: number): string {
  const h = Math.floor(min / 60);
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(min % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

function shortDateLima(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function tomorrowKey(date: Date = new Date()): string {
  const [y, m, d] = getLimaDayKey(date).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

export function buildReminderMessage(appt: {
  apptDate: string;
  startMinute: number;
  branch: string;
  doctorName: string | null;
  specialtyName: string | null;
  petName: string;
  ownerName: string;
  needsOrder: boolean;
}): string {
  const lines = [
    `🐾 *¡Recordatorio! Mañana ${shortDateLima(appt.apptDate)}`,
    `${hora12(appt.startMinute)}`,
    `${BRANCH_LABELS[appt.branch] ?? appt.branch}*`,
    "",
    appt.doctorName ? `🩺 Doctor: ${appt.doctorName}` : appt.specialtyName ? `🎓 ${appt.specialtyName}` : "📋 Consulta general",
    `🐾 Mascota: ${appt.petName}`,
    `👤 ${appt.ownerName.split(/\s+/)[0] ?? ""}`,
  ];
  if (appt.needsOrder) lines.push("", "📄 No olvides tu orden médica sellada por un médico.");
  lines.push("", "⚠️ La tolerancia es de 10 minutos; luego se atiende al siguiente en espera.", "", "¡Nos vemos mañana! 🐶✨");
  return lines.filter(Boolean).join("\n").replace("* ", "* ") ;
}

interface CounterSummaryAppt {
  apptDate: string | null;
  startMinute: number | null;
  branch: string;
  doctorName: string | null;
  petName: string;
  ownerName: string;
  ownerPhone: string;
  appointmentCode: string;
}

export function buildCounterReminderSummary(appts: CounterSummaryAppt[], date: string): string {
  const sorted = [...appts].sort(
    (a, b) =>
      Number(a.startMinute ?? 0) - Number(b.startMinute ?? 0) ||
      a.branch.localeCompare(b.branch),
  );
  const detallados = sorted.map((a) => {
    const partes = [
      minuteToTime(a.startMinute ?? 540),
      BRANCH_LABELS[a.branch]?.replace("Sede ", "") ?? a.branch,
      a.appointmentCode,
      a.doctorName ?? "-",
      `${a.petName} / ${a.ownerName}`,
      a.ownerPhone,
    ];
    return `• ${partes.join(" · ")}`;
  });
  return [
    `🔔 *RECORDATORIOS: citas de MAÑANA ${shortDateLima(date)}*`,
    "",
    ...(detallados.length > 0 ? detallados : ["(sin citas)"]),
    "",
    `${appts.length} recordatorio(s) enviado(s) al cliente.`,
  ].join("\n");
}

export default async function handler(req: Req, res: Res) {
  const secret = process.env.CRON_SECRET;
  const token = req.headers?.authorization;
  if (secret && token !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, error: "No autorizado." });
    return;
  }

  const db = getMedicalDb();
  if (!db) {
    res.status(500).json({ ok: false, error: "Servicio no disponible." });
    return;
  }

  const tomorrow = tomorrowKey();
  try {
    const appts = (await db.listApptsByDate(null, tomorrow)).filter((a) => a.status === "confirmada");

    const env = process.env as BookingEnv;
    const evoReady = !!(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE);
    const dryRun = env.EVOLUTION_DRY_RUN === "true" || env.EVOLUTION_DRY_RUN === "1";

    let sent = 0;
    let failed = 0;
    for (const appt of appts) {
      const dest = normalizePhoneDest(appt.ownerPhone);
      if (!(dest && (evoReady || dryRun))) {
        failed++;
        continue;
      }
      const r = await sendViaEvolution(
        [
          buildReminderMessage({
            apptDate: appt.apptDate ?? tomorrow,
            startMinute: appt.startMinute ?? 540,
            branch: appt.branch,
            doctorName: appt.doctorName,
            specialtyName: appt.specialtyName,
            petName: appt.petName,
            ownerName: appt.ownerName,
            needsOrder: appt.needsOrder,
          }),
        ],
        env,
        fetch,
        dest,
      );
      if (r.ok) sent++;
      else failed++;
    }

    // Resumen al counter (recordatorios ya enviados, con avisos incluidos los sin teléfono)
    const counterDest = normalizePhoneDest(env.WHATSAPP_DESTINO ?? "");
    if ((evoReady || dryRun) && counterDest && appts.length > 0) {
      await sendViaEvolution(
        [buildCounterReminderSummary(appts.map((appt) => ({ ...appt, apptDate: appt.apptDate, startMinute: appt.startMinute })), tomorrow)],
        env,
        fetch,
        counterDest,
      );
    }

    res.status(200).json({
      ok: true,
      date: tomorrow,
      reminders: appts.length,
      sent,
      failed,
    });
  } catch (err) {
    console.error(`[medical/reminders] ${err instanceof Error ? err.message : err}`);
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
