import { useState } from "react";
import { Ban, ChevronDown, Trash2 } from "lucide-react";
import { createClosure, deleteClosure, type PanelClosure } from "./api";
import { BRANCH_LABELS, SLOT_LABELS } from "../statuses";

const BRANCH_OPTIONS = Object.entries(BRANCH_LABELS);

export function ClosuresPanel({
  closures: list,
  onChanged,
  hidden,
}: {
  closures: PanelClosure[];
  onChanged: () => void;
  hidden: boolean;
}) {
  const [open, setOpen] = useState(false);
  const closures = list ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [form, setForm] = useState({
    branch: "san_martin",
    date: "",
    timeSlot: "all" as "all" | "9-11" | "11-14",
    reason: "",
  });

  if (hidden) return null;

  async function handleClose() {
    if (!form.date) return;
    setBusy(true);
    setError(null);
    setWarn(null);
    try {
      const result = await createClosure({
        branch: form.branch,
        date: form.date,
        timeSlot: form.timeSlot === "all" ? null : form.timeSlot,
        reason: form.reason.trim(),
      });
      if (result.affected && result.affected > 0) {
        setWarn(
          `⚠️ El cierre afecta ${result.affected} reserva(s) ya hechas: NO se cancelan, siguen visibles en el panel.`,
        );
      }
      setForm((f) => ({ ...f, date: "", reason: "" }));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cerrar el día");
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteClosure(id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reabrir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="no-print mt-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200"
      >
        <span className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-red-500" />
          Días cerrados (Ocupado) — {closures.length} activo(s)
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="mb-3 text-xs text-slate-500">
            Cierra una fecha (o solo una franja) cuando no queden cupos: en la página de reservas
            el calendario la mostrará en rojo como «Ocupado». No afecta las reservas ya hechas.
          </p>

          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Sede</span>
              <select
                value={form.branch}
                onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
                className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none"
              >
                {BRANCH_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Fecha</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Franja</span>
              <select
                value={form.timeSlot}
                onChange={(e) => setForm((f) => ({ ...f, timeSlot: e.target.value as typeof f.timeSlot }))}
                className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none"
              >
                <option value="all">Todo el día</option>
                <option value="9-11">9:00 am – 11:00 am</option>
                <option value="11-14">11:00 am – 2:00 pm</option>
              </select>
            </label>
            <label className="flex min-w-40 flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Motivo (opcional)</span>
              <input
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Ej: día lleno / feriado"
                className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none"
              />
            </label>
            <button
              onClick={handleClose}
              disabled={busy || !form.date}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              Cerrar
            </button>
          </div>

          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          {warn && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">{warn}</p>}

          {closures.length === 0 ? (
            <p className="text-sm text-slate-400">No hay días cerrados próximos.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {closures.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-3 py-2 text-sm"
                >
                  <span>
                    <strong>{BRANCH_LABELS[c.branch]}</strong> — {c.closureDate}
                    {c.timeSlot ? ` (${SLOT_LABELS[c.timeSlot]})` : " (todo el día)"}
                    {c.reason && <span className="text-slate-500"> · {c.reason}</span>}
                  </span>
                  <button
                    onClick={() => handleReopen(c.id)}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Reabrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
