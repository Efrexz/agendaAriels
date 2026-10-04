const LIMA_TIME_ZONE = "America/Lima";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LIMA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LIMA_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

export function getLimaDayKey(date: Date = new Date()): string {
  return dayFormatter.format(date);
}

export function getLimaHour(date: Date = new Date()): number {
  return Number(hourFormatter.format(date));
}

export function limaToday(date: Date = new Date()): Date {
  const [y, m, d] = getLimaDayKey(date).split("-").map(Number);
  return new Date(y, m - 1, d);
}
