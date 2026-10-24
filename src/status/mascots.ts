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
  resultado_listo: `${MASCOT_BASE}aprobado.webp`,
  entregada: `${MASCOT_BASE}DogAndCatFamilia.webp`,
  cancelado: `${MASCOT_BASE}error-dog.webp`,
};

export function mascotFor(kind: "va" | "lab", status: string): string {
  const map = kind === "lab" ? LAB_MASCOT : VA_MASCOT;
  return map[status] ?? MASCOT_PLACEHOLDER;
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
