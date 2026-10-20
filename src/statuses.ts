// Catálogo de estados de una reserva — compartido por el panel interno
// y la página de seguimiento del cliente. Los ids coinciden con el CHECK
// de la tabla `bookings` en Supabase (supabase/migrations/).

export interface StatusMeta {
  id: string;
  label: string;
  short: string;
  emoji: string;
  /** Clases tailwind para el badge (fondo + texto). */
  badge: string;
  /** Clase tailwind para el borde/punto activo. */
  dot: string;
  /** El cliente ve este estado en /estado. */
  visibleToClient: boolean;
}

export const STATUS_ORDER = [
  "pendiente",
  "en_camino_recojo",
  "recibido",
  "en_bano",
  "en_secado",
  "en_corte",
  "listo",
  "en_camino_entrega",
  "entregado",
] as const;

export const STATUS_META: Record<string, StatusMeta> = {
  pendiente: {
    id: "pendiente",
    label: "Pendiente",
    short: "Pendiente",
    emoji: "⏳",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    visibleToClient: true,
  },
  en_camino_recojo: {
    id: "en_camino_recojo",
    label: "En camino por la mascota",
    short: "En camino",
    emoji: "🚐",
    badge: "bg-sky-100 text-sky-800",
    dot: "bg-sky-500",
    visibleToClient: true,
  },
  recibido: {
    id: "recibido",
    label: "Recibido en la sede",
    short: "Recibido",
    emoji: "🏥",
    badge: "bg-blue-100 text-blue-800",
    dot: "bg-blue-500",
    visibleToClient: true,
  },
  en_bano: {
    id: "en_bano",
    label: "En baño",
    short: "En baño",
    emoji: "🛁",
    badge: "bg-cyan-100 text-cyan-800",
    dot: "bg-cyan-500",
    visibleToClient: true,
  },
  en_secado: {
    id: "en_secado",
    label: "En secado",
    short: "En secado",
    emoji: "💨",
    badge: "bg-indigo-100 text-indigo-800",
    dot: "bg-indigo-500",
    visibleToClient: true,
  },
  en_corte: {
    id: "en_corte",
    label: "En corte",
    short: "En corte",
    emoji: "✂️",
    badge: "bg-violet-100 text-violet-800",
    dot: "bg-violet-500",
    visibleToClient: true,
  },
  listo: {
    id: "listo",
    label: "Listo",
    short: "Listo",
    emoji: "✅",
    badge: "bg-green-100 text-green-800",
    dot: "bg-green-500",
    visibleToClient: true,
  },
  en_camino_entrega: {
    id: "en_camino_entrega",
    label: "En camino a casa",
    short: "De vuelta",
    emoji: "🚐",
    badge: "bg-sky-100 text-sky-800",
    dot: "bg-sky-500",
    visibleToClient: true,
  },
  entregado: {
    id: "entregado",
    label: "Entregado",
    short: "Entregado",
    emoji: "📦",
    badge: "bg-slate-200 text-slate-700",
    dot: "bg-slate-400",
    visibleToClient: true,
  },
  cancelado: {
    id: "cancelado",
    label: "Cancelado",
    short: "Cancelado",
    emoji: "❌",
    badge: "bg-red-100 text-red-800",
    dot: "bg-red-500",
    visibleToClient: false,
  },
};

/** Estados que disparan WhatsApp al cliente (definidos en api/internal/status.ts). */
export const NOTIFIABLE_STATUSES = new Set([
  "en_camino_recojo",
  "listo",
  "en_camino_entrega",
]);

export function statusMeta(id: string): StatusMeta {
  return (
    STATUS_META[id] ?? {
      id,
      label: id,
      short: id,
      emoji: "❔",
      badge: "bg-slate-100 text-slate-700",
      dot: "bg-slate-400",
      visibleToClient: false,
    }
  );
}

export const BRANCH_LABELS: Record<string, string> = {
  san_martin: "San Martín de Porres",
  los_olivos: "Los Olivos",
  san_miguel: "San Miguel",
};

export const SLOT_LABELS: Record<string, string> = {
  "9-11": "9:00 am – 11:00 am",
  "11-14": "11:00 am – 2:00 pm",
};
