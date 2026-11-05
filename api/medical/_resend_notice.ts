import { sendViaEvolution, normalizePhoneDest, type BookingEnv } from "../_booking.js";
import {
  buildClientApptMessage, buildNextWeekRequestMessage,
} from "./_create.js";
import { buildConfirmationMessage } from "./_status.js";
import { minuteToTime } from "./slots.js";
import { BRANCH_LABELS, BRANCH_PHONES, getMedicalDb, notConfigured, staffGuard } from "./_shared.js";

// POST /api/internal/medical/resend-notice { id }
// Reenvía el aviso de WhatsApp al cliente con el MENSAJE DE SU ESTADO ACTUAL:
//  - solicita pagos/pendiente  → solicitud / recibo original
//  - asignada/confirmada       → mensaje de confirmación con fecha/hora/doctor
// M1 honestidad: registro la entrega en el historial (wa_entregado/wa_fallado)
// para que el ⚠ del panel responda a la realidad, no a un intento viejo.

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

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Método no permitido." });
    return;
  }
  if (notConfigured(res)) return;
  const staff = await staffGuard(req, res);
  if (!staff) return;

  const body = (req.body ?? {}) as { id?: string };
  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    res.status(400).json({ ok: false, error: "Cita inválida." });
    return;
  }

  try {
    const db = getMedicalDb()!;
    const appt = await db.findApptById(id);
    if (!appt) {
      res.status(404).json({ ok: false, error: "Cita no encontrada." });
      return;
    }

    const env = process.env as BookingEnv;
    const evoReady = !!(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE);
    const dryRun = env.EVOLUTION_DRY_RUN === "true" || env.EVOLUTION_DRY_RUN === "1";
    const dest = normalizePhoneDest(appt.ownerPhone);
    if (!(evoReady || dryRun) || !dest) {
      res.status(503).json({ ok: false, error: "WhatsApp no está disponible ahora mismo; intenta más tarde o avísale al cliente por llamada." });
      return;
    }

    const cfg = await db.getConfig();
    const text =
      appt.status === "asignada" || appt.status === "confirmada"
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
        : appt.serviceType !== "especializada" && appt.startMinute === null
          ? buildNextWeekRequestMessage(
              { ownerName: appt.ownerName, petName: appt.petName },
              appt.appointmentCode,
              { doctor: appt.doctorName },
            )
          : buildClientApptMessage(
              // Payload mínimo que el builder usa en realidad (misma forma que
              // el body del wizard); el reenvío parte del registro guardado.
              {
                branch: appt.branch, serviceType: appt.serviceType, petName: appt.petName,
                petType: appt.petType, ownerName: appt.ownerName, date: appt.apptDate,
                hasOrder: appt.hasOrder,
              } as Parameters<typeof buildClientApptMessage>[0],
              appt.appointmentCode,
              {
                specialty: appt.specialtyName,
                doctor: appt.doctorName,
                time: appt.startMinute !== null ? minuteToTime(appt.startMinute) : null,
              },
              cfg.payment_info,
            );

    const sent = await sendViaEvolution([text], env, fetch, dest);
    if (!dryRun && evoReady) {
      try { await db.recordWhatsappNotice(id, sent.ok); } catch { /* best-effort */ }
    }
    res.status(200).json({ ok: true, sent: sent.ok });
  } catch {
    res.status(500).json({ ok: false, error: "Error inesperado del servidor." });
  }
}
