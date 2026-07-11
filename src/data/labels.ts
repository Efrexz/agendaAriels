export const PET_TYPE_LABELS: Record<string, string> = {
  dog: "Perro",
  cat: "Gato",
};

export const SERVICE_LABELS: Record<string, string> = {
  bath: "Baño",
  bath_cut: "Baño + Corte",
  bath_deslanado: "Baño + Deslanado",
};

export const SIZE_LABELS: Record<string, string> = {
  small: "Pequeño",
  medium: "Mediano",
  large: "Grande",
  giant: "Gigante",
};

export const TIME_LABELS: Record<string, string> = {
  "9-11": "9:00 am – 11:00 am",
  "11-14": "11:00 am – 2:00 pm",
};

export const EXTRA_LABELS: Record<string, string> = {
  deworming: "Desparasitación",
  antiflea: "Antipulgas",
  vaccine: "Vacuna",
};

export const EXTRA_VARIANT_LABELS: Record<string, string> = {
  "1m": "1 mes",
  "3m": "3 meses",
  "6m": "6 meses",
  sextuple: "Séxtuple",
  rabia: "Antirrábica",
  kc: "KC (Tos de las perreras)",
  leptospira: "Leptospira",
  triple_felina: "Triple Felina",
};

export interface ExtraServiceLike {
  service: string;
  variant?: string;
}

export function formatExtraLabel(extra: ExtraServiceLike): string {
  const serviceLabel = EXTRA_LABELS[extra.service] || extra.service;
  if (extra.variant) {
    const variantLabel = EXTRA_VARIANT_LABELS[extra.variant] || extra.variant;
    return `${serviceLabel} (${variantLabel})`;
  }
  return serviceLabel;
}

export const CORTE_LABELS: Record<string, string> = {
  rapado: "Corte Rapado",
  rebaje: "Rebaje Comercial (1 cm de largo parejo)",
  tijera: "Corte con Tijera / Estilo de la raza",
};

export const BATH_LABELS: Record<string, string> = {
  hidratado_premium: "Hidratado Premium",
  medicado: "Baño Medicado",
  tradicional: "Baño Tradicional",
};

export const PERFUME_LABELS: Record<string, string> = {
  fruital: "🍓 Frutal",
  floral: "🌸 Floral",
  fresco: "🍃 Fresco",
};

export const BRANCH_LABELS: Record<string, string> = {
  san_martin: "San Martín de Porres",
  los_olivos: "Los Olivos",
  san_miguel: "San Miguel",
};