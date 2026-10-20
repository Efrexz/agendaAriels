// Lógica PURA de disponibilidad de citas — sin Supabase ni process.env.
// Se testa con vitest; la usan /api/medical/availability y la creación.

export interface ScheduleBlock {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface BusyBlock {
  startMinute: number;
  durationMinutes: number;
}

export interface TimeOffBlock {
  startMinute: number | null; // null = todo el día
  endMinute: number | null;
}

export interface Slot {
  startMinute: number;
  endMinute: number;
}

/**
 * Slots libres para un doctor en un día (minutos desde medianoche):
 * - cada bloque de horario semanal del weekday se trocea en citas de durationMinutes
 * - remove ocupadas (citas activas), ausencias (time_off) y pasado del día
 */
export function computeFreeSlots(opts: {
  durationMinutes: number;
  weekday: number;
  schedules: ScheduleBlock[];
  busy: BusyBlock[];
  timeOffBlocks: TimeOffBlock[];
  /** No ofrecer slots que empiecen antes de este minuto (ej. hora actual de Lima). */
  minStartMinute?: number;
}): Slot[] {
  const { durationMinutes, weekday, schedules, busy, timeOffBlocks, minStartMinute = 0 } = opts;
  const byStart = new Map<number, Slot>();

  for (const block of schedules) {
    if (block.weekday !== weekday) continue;
    for (let start = block.startMinute; start + durationMinutes <= block.endMinute; start += durationMinutes) {
      const end = start + durationMinutes;
      if (start < minStartMinute) continue;
      if (busy.some((b) => b.startMinute < end && b.startMinute + b.durationMinutes > start)) continue;
      const inOff = timeOffBlocks.some((t) => {
        if (t.startMinute === null || t.endMinute === null) return true; // día completo
        return t.startMinute < end && t.endMinute > start;
      });
      if (inOff) continue;
      byStart.set(start, { startMinute: start, endMinute: end });
    }
  }

  return [...byStart.values()].sort((a, b) => a.startMinute - b.startMinute);
}

/** "14:35" desde minutos. */
export function minuteToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Weekday de una fecha calendario (0=domingo). Fecha "yyyy-mm-dd" puro: sin zona. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
}

/** Minutos de la hora actual en Lima (para bloquear slots pasados de hoy). */
export function currentMinuteLima(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const [h, m] = parts.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
