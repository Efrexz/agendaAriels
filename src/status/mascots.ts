// Presentación /estado: imagen de la mascota por estado.
// SOLO presentación — los ids coinciden con statuses.ts y labStatuses.ts
// (allí vive el catálogo compartido con el panel; aquí solo el mapa visual).
//
// Los archivos apuntan a sus NOMBRES FINALES: mientras no existan en
// public/images/vetMascot/, el componente Mascot hace fallback a
// PLACEHOLDER_WEBP (imagen genérica ya existente) y el emoji del estado
// como última red. Al soltar el .webp definitivo aparece sin tocar código.

export const MASCOT_BASE = "/images/vetMascot/";
/** Imagen genérica existente mientras llegan las definitivas. */
export const MASCOT_PLACEHOLDER = `${MASCOT_BASE}DogAndCat.webp`;

/** Grooming (VA-): estado → archivo final. */
export const VA_MASCOT: Record<string, string> = {
  pendiente: `${MASCOT_BASE}esperando.webp`,
  en_camino_recojo: `${MASCOT_BASE}camino.webp`,
  recibido: `${MASCOT_BASE}recibido.webp`,
  en_bano: `${MASCOT_BASE}burbujas.webp`,
  en_secado: `${MASCOT_BASE}secado.webp`,
  en_corte: `${MASCOT_BASE}corte.webp`,
  listo: `${MASCOT_BASE}aprobado.webp`,
  en_camino_entrega: `${MASCOT_BASE}camino.webp`,
  entregado: `${MASCOT_BASE}DogAndCatFamilia.webp`,
  cancelado: `${MASCOT_BASE}error-dog.webp`,
};

/** Laboratorio (LAB-): estado → archivo final. */
export const LAB_MASCOT: Record<string, string> = {
  recibida: `${MASCOT_BASE}recibida.webp`,
  en_laboratorio: `${MASCOT_BASE}laboratorio.webp`,
  resultado_listo: `${MASCOT_BASE}resultadoListo.webp`,
  entregada: `${MASCOT_BASE}DogAndCatFamilia.webp`,
  cancelado: `${MASCOT_BASE}error-dog.webp`,
};

export function mascotFor(kind: "va" | "lab", status: string): string {
  const map = kind === "lab" ? LAB_MASCOT : VA_MASCOT;
  return map[status] ?? MASCOT_PLACEHOLDER;
}

// Tinte por estado: familia de color del catálogo aplicada al backdrop de la
// mascota y al chip de contexto del /estado (el pastilla del estado sigue
// viniendo del catálogo badges). Fallback neutro azul como hoy.
interface Tint {
  /** Backdrop redondo detrás de la mascota. */
  soft: string;
  /** Fondo del chip de contexto dentro del card (sobre fondo blanco). */
  chipBg: string;
  /** Texto del chip de contexto. */
  chipText: string;
}

const BLUE_TINT: Tint = { soft: "bg-blue-50", chipBg: "bg-blue-100", chipText: "text-brand-blue" };

export const STATUS_TINT: Record<string, Tint> = {
  // Grooming
  pendiente: { soft: "bg-amber-50", chipBg: "bg-amber-100", chipText: "text-amber-700" },
  en_camino_recojo: { soft: "bg-sky-50", chipBg: "bg-sky-100", chipText: "text-sky-700" },
  recibido: BLUE_TINT,
  en_bano: { soft: "bg-cyan-50", chipBg: "bg-cyan-100", chipText: "text-cyan-700" },
  en_secado: { soft: "bg-indigo-50", chipBg: "bg-indigo-100", chipText: "text-indigo-700" },
  en_corte: { soft: "bg-violet-50", chipBg: "bg-violet-100", chipText: "text-violet-700" },
  listo: { soft: "bg-green-50", chipBg: "bg-green-100", chipText: "text-green-700" },
  en_camino_entrega: { soft: "bg-sky-50", chipBg: "bg-sky-100", chipText: "text-sky-700" },
  entregado: { soft: "bg-slate-100", chipBg: "bg-slate-200", chipText: "text-slate-600" },
  cancelado: { soft: "bg-red-50", chipBg: "bg-red-100", chipText: "text-red-700" },
  // Laboratorio
  recibida: BLUE_TINT,
  en_laboratorio: { soft: "bg-amber-50", chipBg: "bg-amber-100", chipText: "text-amber-700" },
  resultado_listo: { soft: "bg-green-50", chipBg: "bg-green-100", chipText: "text-green-700" },
  entregada: { soft: "bg-slate-100", chipBg: "bg-slate-200", chipText: "text-slate-600" },
};

export const TINT_PLACEHOLDER = BLUE_TINT;

export function tintFor(status: string): Tint {
  return STATUS_TINT[status] ?? TINT_PLACEHOLDER;
}

// Iconos line-art de la timeline (estilo referencia). Presentación pura —
// el catálogo de estados con color/label vive en statuses.ts / labStatuses.ts.
import type { LucideIcon } from "lucide-react";
import {
  Bath,
  Building2,
  CheckCircle2,
  FileText,
  FlaskConical,
  Hourglass,
  Inbox,
  PackageCheck,
  Scissors,
  Truck,
  Wind,
  XCircle,
} from "lucide-react";

export const VA_ICON: Record<string, LucideIcon> = {
  pendiente: Hourglass,
  en_camino_recojo: Truck,
  recibido: Building2,
  en_bano: Bath,
  en_secado: Wind,
  en_corte: Scissors,
  listo: CheckCircle2,
  en_camino_entrega: Truck,
  entregado: PackageCheck,
  cancelado: XCircle,
};

export const LAB_ICON: Record<string, LucideIcon> = {
  recibida: Inbox,
  en_laboratorio: FlaskConical,
  resultado_listo: CheckCircle2,
  entregada: FileText,
  cancelado: XCircle,
};

export function iconFor(kind: "va" | "lab", status: string): LucideIcon {
  const map = kind === "lab" ? LAB_ICON : VA_ICON;
  return map[status] ?? CheckCircle2;
}
