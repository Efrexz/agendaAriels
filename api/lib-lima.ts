// Utilidades de tiempo Lima compartidas por los endpoints de api/.
// En.sync con src/utils/limaTime.ts (ese es para el bundle del navegador,
// este para las funciones serverless).

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de hoy en Lima como "yyyy-mm-dd". */
export function getLimaDayKey(date: Date = new Date()): string {
  return dayFormatter.format(date);
}
