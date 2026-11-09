import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";
import { TriangleAlert, X, type LucideIcon } from "lucide-react";

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
//
// Identidad de marca (09/11): barra superior degradada azul→naranja
// (la misma firma de los wizards públicos), título en display azul y
// primitivas de campo con foco azul de marca — los formularios del
// counter ya no viven en el gris default de Tailwind.
// ─────────────────────────────────────────────────────────────

/** Campos del panel: borde suave + foco azul de marca. Usar en TODOS los
 *  inputs/selects/textarea de los modales (y de Config). Añadir `w-full`
 *  donde el campo ocupe su renglón. */
export const FIELD_CLS =
  "min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

/** Encabezado de sección dentro de un modal: chip de ícono + label en
 *  track + línea de cierre (mismo lenguaje que las fichas /medical). */
export function ModalSection({ title, icon: Icon, tone = "blue" }: {
  title: string;
  icon: LucideIcon;
  tone?: "blue" | "orange" | "green";
}) {
  const tones = {
    blue: "bg-[#EFF5FC] text-blue-600",
    orange: "bg-[#FFF1E7] text-orange-500",
    green: "bg-[#E8F7EE] text-green-600",
  } as const;
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#475AAB]">{title}</span>
      <span aria-hidden className="h-px flex-1 bg-[#DCEBFF]" />
    </div>
  );
}

export function ModalShell({ title, dirty, onClose, children, center = false, wide = false }: {
  title: string;
  dirty: boolean;
  onClose: (reload: boolean) => void;
  children: (maybeClose: (reload?: boolean) => void) => React.ReactNode;
  // center: vista de ÉXITO (estados que ya no son formulario) se muestra
  // centrada verticalmente en pantalla en vez de colgada del borde superior.
  center?: boolean;
  // wide: max-w-xl para los formularios largos del counter (cita manual, lab).
  wide?: boolean;
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
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [maybeClose]);

  return createPortal(
    <div className={`fixed inset-0 z-[80] flex justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4 ${center ? "items-center" : "items-start"}`}>
      <div className={`relative w-full min-w-0 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-100 ${wide ? "max-w-xl" : "max-w-md"} ${center ? "" : "mt-10"}`} onClick={(e) => e.stopPropagation()}>
        {/* Firma de marca: misma barra degradada de los wizards públicos */}
        <div aria-hidden className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-400 to-orange-400" />
        <div className="relative p-5">
          <button
            onClick={() => maybeClose(false)}
            aria-label="Cerrar"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-blue-50 hover:text-[#475AAB]"
          >
            <X className="h-5 w-5" />
          </button>
          {title ? <h3 className="mb-3 pr-8 font-display text-lg font-bold leading-tight text-[#475AAB]">{title}</h3> : null}
          {children(maybeClose)}

          {confirming && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
              <div className="w-full max-w-xs rounded-2xl bg-white p-4 text-center shadow-xl">
                <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF1E7] text-amber-500">
                  <TriangleAlert className="h-5 w-5" />
                </span>
                <p className="text-sm font-bold text-[#475AAB]">¿Salir sin guardar cambios?</p>
                <p className="mt-1 text-xs text-slate-500">Lo que escribiste se perderá.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    className="flex-1 rounded-xl border border-blue-200 py-2 text-sm font-semibold text-[#475AAB] transition hover:bg-blue-50"
                  >
                    Seguir editando
                  </button>
                  <button
                    onClick={() => onClose(false)}
                    className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
