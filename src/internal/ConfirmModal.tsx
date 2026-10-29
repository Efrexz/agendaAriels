import { createPortal } from "react-dom";
import { Loader2, TriangleAlert, X } from "lucide-react";

// Confirmación destructiva propia (reemplaza window.confirm nativo):
// tono rojo para cancelaciones/borrados y azul solo si el icono no es peligro.
// Usa ModalShell por debajo (portal z-80): el navbar no queda encima.
export function ConfirmModal({ title, description, confirmLabel, danger = false, busy, onClose, onConfirm }: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          disabled={busy}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-3 flex items-start gap-3 pr-8">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            danger ? "bg-red-100 text-red-600" : "bg-[#EFF6FF] text-blue-500"
          }`}>
            <TriangleAlert className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold leading-tight text-[#475AAB]">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Volver atrás
          </button>
          <button
            onClick={() => void onConfirm()}
            disabled={busy}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-blue hover:bg-blue-700"
            }`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
