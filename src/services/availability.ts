// Días/franjas cerrados por el staff (vía /api/availability).
// Cache en módulo con TTL porque el wizard puede volver a este paso.

export interface ClosureEntry {
  branch: string;
  date: string;
  timeSlot: string | null;
}

const TTL_MS = 60_000;
let cache: { data: ClosureEntry[]; at: number } | null = null;

export function resetAvailabilityCache(): void {
  cache = null;
}

export async function fetchClosuresPublic(): Promise<ClosureEntry[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const res = await fetch("/api/availability");
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    closures?: ClosureEntry[];
  };
  if (!res.ok || !body.ok || !Array.isArray(body.closures)) {
    throw new Error("No se pudo consultar la disponibilidad");
  }
  cache = { data: body.closures, at: Date.now() };
  return cache.data;
}

/** Cierre para una sede en una fecha: "all" (día completo) o lista de franjas. */
export function closureFor(
  closures: ClosureEntry[],
  branch: string | null,
  date: string,
): { all: boolean; slots: Set<string> } {
  if (!branch) return { all: false, slots: new Set() };
  const relevant = closures.filter((c) => c.branch === branch && c.date === date);
  const all = relevant.some((c) => c.timeSlot === null);
  const slots = new Set(relevant.flatMap((c) => (c.timeSlot ? [c.timeSlot] : [])));
  return { all, slots };
}
