import { useEffect, type Dispatch, type SetStateAction } from "react";

type VisibilitySource = Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;

/** No consulta con la pestaña oculta; vuelve a consultar al hacerla visible. */
export function scheduleVisibleRefresh(source: VisibilitySource, refresh: () => void, delay: number): () => void {
  const onVisible = () => { if (source.visibilityState === "visible") refresh(); };
  const timer = setInterval(onVisible, delay);
  source.addEventListener("visibilitychange", onVisible);
  return () => { clearInterval(timer); source.removeEventListener("visibilitychange", onVisible); };
}

export function useVisibleRefresh(setTick: Dispatch<SetStateAction<number>>, enabled: boolean, delay = 30_000): void {
  useEffect(() => {
    if (!enabled) return;
    return scheduleVisibleRefresh(document, () => setTick((tick) => tick + 1), delay);
  }, [setTick, enabled, delay]);
}
