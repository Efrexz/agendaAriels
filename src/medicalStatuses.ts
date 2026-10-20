// Catálogo de estados de CITAS MÉDICAS — compartido por panel y wizard.
// Los ids coinciden con el CHECK de medical_appointments.

export interface MedStatusMeta {
  id: string;
  label: string;
  emoji: string;
  badge: string;
  /** Estados iniciales según tipo de servicio. */
}

export const MED_STATUS_META: Record<string, MedStatusMeta> = {
  solicitud: {
    id: "solicitud",
    label: "Solicitud recibida",
    emoji: "📥",
    badge: "bg-amber-100 text-amber-800",
  },
  pagado: {
    id: "pagado",
    label: "Pago verificado",
    emoji: "💰",
    badge: "bg-yellow-100 text-yellow-800",
  },
  asignada: {
    id: "asignada",
    label: "Doctor asignado",
    emoji: "🩺",
    badge: "bg-blue-100 text-blue-800",
  },
  confirmada: {
    id: "confirmada",
    label: "Confirmada",
    emoji: "✅",
    badge: "bg-green-100 text-green-800",
  },
  en_consulta: {
    id: "en_consulta",
    label: "En consultorio",
    emoji: "🏥",
    badge: "bg-sky-100 text-sky-800",
  },
  atendida: {
    id: "atendida",
    label: "Atendida",
    emoji: "🏁",
    badge: "bg-slate-200 text-slate-700",
  },
  no_llego: {
    id: "no_llego",
    label: "No llegó",
    emoji: "⏰",
    badge: "bg-orange-100 text-orange-800",
  },
  cancelado: {
    id: "cancelado",
    label: "Cancelada",
    emoji: "❌",
    badge: "bg-red-100 text-red-800",
  },
};

/** Flujo normal (general / rayos / eco). */
export const MED_FLOW_NORMAL = ["confirmada", "en_consulta", "atendida"];

/** Flujo especializada (solicitud → pago → asignación → confirmación). */
export const MED_FLOW_ESPECIALIZADA = ["solicitud", "pagado", "asignada", "confirmada"];

export function medStatusMeta(id: string): MedStatusMeta {
  return MED_STATUS_META[id] ?? { id, label: id, emoji: "❔", badge: "bg-slate-100 text-slate-700" };
}

export const MED_SERVICE_LABELS: Record<string, string> = {
  general: "Consulta General",
  rayos: "Radiografía",
  eco: "Ecografía",
  especializada: "Consulta Especializada",
};
