import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// ModalShell del panel: evita perder formularios por un clic
// accidental fuera del modal (bug real reportado por el usuario).
// Reglas del sistema:
//  • Nada cierra por clic fuera del cuadro.
//  • Cierra con X, Esc o botón Cancelar — todos pasan por
//    maybeClose(reload).
//  • Con datos sin guardar (dirty=true) y reload=false →
//    confirmación "¿Salir sin guardar cambios?".
// Uso (children como función): children recibe maybeClose:
//   <ModalShell title="…" dirty={…} onClose={…}>
//     {(maybeClose) => (<>
//        ...
//        <button onClick={() => maybeClose(false)}>Cancelar</button>
//     </>)}
//   </ModalShell>
// Todos los modales nuevos del panel DEBEN usarlo.
// ─────────────────────────────────────────────────────────────

export function ModalShell({ title, dirty, onClose, children }: {
  title: string;
  dirty: boolean;
  onClose: (reload: boolean) => void;
  children: (maybeClose: (reload?: boolean) => void) => React.ReactNode;
}) {
  const [confirming, setConfirming] = useState(false);

  // reload=true (guardado con éxito) cierra SIEMPRE directo, sin confirmación.
  const maybeClose = useCallback((reload = false) => {
    if (reload) {
      onClose(true);
      return;
    }
    if (dirty) setConfirming(true);
    else onClose(false);
  }, [onClose, dirty]);

  // Esc actúa igual que la X (la confirmación protege el trabajo)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") maybeClose(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maybeClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative mt-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => maybeClose(false)}
          aria-label="Cerrar"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
        {title
          ? <h3 className="mb-3 pr-8 font-display text-lg font-bold text-slate-900">{title}</h3>
          : null}
        {children(maybeClose)}

        {confirming && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-900/40 p-4">
            <div className="w-full max-w-xs rounded-xl bg-white p-4 text-center shadow-xl">
              <p className="text-sm font-semibold text-slate-900">¿Salir sin guardar cambios?</p>
              <p className="mt-1 text-xs text-slate-500">Lo que escribiste se perderá.</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Seguir editando
                </button>
                <button
                  onClick={() => onClose(false)}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
