// Catálogo de estados de ÓRDENES DE LABORATORIO — compartido por panel y /estado.
// Los ids coinciden con el CHECK de lab_orders.

export interface LabStatusMeta {
  id: string;
  label: string;
  emoji: string;
  badge: string;
}

export const LAB_STATUS_META: Record<string, LabStatusMeta> = {
  recibida: {
    id: "recibida",
    label: "Muestra recibida",
    emoji: "📥",
    badge: "bg-blue-100 text-blue-800",
  },
  en_laboratorio: {
    id: "en_laboratorio",
    label: "En laboratorio",
    emoji: "🔬",
    badge: "bg-amber-100 text-amber-800",
  },
  resultado_listo: {
    id: "resultado_listo",
    label: "Resultado listo",
    emoji: "✅",
    badge: "bg-green-100 text-green-800",
  },
  entregada: {
    id: "entregada",
    label: "Entregada",
    emoji: "📋",
    badge: "bg-slate-200 text-slate-700",
  },
  cancelado: {
    id: "cancelado",
    label: "Cancelada",
    emoji: "❌",
    badge: "bg-red-100 text-red-800",
  },
};

/** Orden para timelines del cliente (los ya-vistos quedan detrás del actual). */
export const LAB_STATUS_ORDER: string[] = [
  "recibida", "en_laboratorio", "resultado_listo", "entregada",
];

export function labStatusMeta(status: string): LabStatusMeta {
  return LAB_STATUS_META[status] ?? { id: status, label: status, emoji: "🐾", badge: "bg-slate-100 text-slate-700" };
}
