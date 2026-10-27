import { useEffect, useState } from "react";

// Toast flotante "llegó algo nuevo": el panel refresca cada 30s en silencio;
// si apareció una reserva/cita/orden creada DESPUÉS de abrir el panel, el
// contador salta y este toast lo anuncia. Sin sonido (es una oficina).
// Visible mientras el contador actual no esté en `dismissed` (clic del usuario
// o autocierre a los 8s, agendado por pinta en el chrono del timer).
// Cada pestaña gestiona su contador; aquí solo la presentación.

export function NewArrivalsToast({ count, label, onView }: {
  count: number;
  /** Singular, ej: "cita médica nueva" → añade "s" al plural. */
  label: string;
  onView: () => void;
}) {
  // Valores de `count` ya cerrados (por clic o por tiempo)
  const [dismissed, setDismissed] = useState<number[]>([]);

  // Chrono por llegada: agenda el autocierre del toast de ESTE count
  useEffect(() => {
    if (count <= 0) return;
    const id = setTimeout(() => {
      setDismissed((d) => (d.includes(count) ? d : [...d, count]));
    }, 8000);
    return () => clearTimeout(id);
  }, [count]); // dismissed NO vuelve a armar el chrono: un clic no reinicia el temporizador

  const dismissedNow = dismissed.includes(count);

  function dismiss() {
    setDismissed((d) => (d.includes(count) ? d : [...d, count]));
    onView();
  }

  if (count <= 0 || dismissedNow) return null;
  return (
    <button
      onClick={dismiss}
      className="no-print fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-2xl bg-brand-blue px-4 py-3 text-left text-sm font-semibold text-white shadow-xl shadow-blue-600/30 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
    >
      <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-base">
        🆕
      </span>
      <span>
        {count} {label}{count > 1 ? "s" : ""} — <b>clic para ver</b>
      </span>
    </button>
  );
}
