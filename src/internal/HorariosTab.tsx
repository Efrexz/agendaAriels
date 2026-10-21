import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { createSchedule, deleteSchedule, fetchSchedules, fetchCatalog, type ScheduleWithDoctor } from "./apiMedical";

// Editor visual de horarios semanal: 7 días, bloques por doctor.
// El counter pinta/limpia con clicks; "Duplicar" copia todos los bloques
// de un doctor a otro (para cuando la semantics es la misma). Sin campos de texto.

const DIAS_LARGO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const HORAS = Array.from({ length: 28 }, (_, i) => 8 * 60 + i * 30); // 8:00 → 21:30

function horaLbl(min: number): string {
  const h = Math.floor(min / 60);
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(min % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

interface DoctorLite {
  id: string;
  fullName: string;
  branch: string;
  kind: string;
  specialtyName: string | null;
  active: boolean;
}

export function HorariosTab() {
  const [schedules, setSchedules] = useState<ScheduleWithDoctor[] | null>(null);
  const [doctors, setDoct] = useState<DoctorLite[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carga: setState tras await (IIFE)
  useEffect(() => {
    let active = true;
    (async () => {
      setBusy(true);
      try {
        const [{ schedules: s }, { doctors: ds }] = await Promise.all([
          fetchSchedules(),
          fetchCatalog(),
        ]);
        if (active) {
          setSchedules(s);
          setDoct(ds);
          if (!selected && ds[0]) setSelected(ds.find((d) => d.active)?.id ?? "");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Error al cargar");
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mine = useMemo(
    () => (schedules ?? []).filter((x) => x.doctorId === selected),
    [schedules, selected],
  );
  const selDoctor = doctors?.find((d) => d.id === selected) ?? null;

  const blocksByDay = useMemo(() => {
    const map = new Map<number, ScheduleWithDoctor[]>();
    for (const b of mine) {
      const arr = map.get(b.weekday);
      if (arr) arr.push(b);
      else map.set(b.weekday, [b]);
    }
    return map;
  }, [mine]);

  // Bloques que ocupan filas de la cuadrícula: solo los del doctor seleccionado
  const coveredStarts = useMemo(() => {
    const s = new Set<number>();
    for (const b of mine) {
      for (let m = Math.floor(b.startMinute / 30) * 30; m < b.endMinute; m += 30) s.add(m);
    }
    return s;
  }, [mine]);

  async function toggle(weekday: number, hourMin: number) {
    if (!selected || !selDoctor) return;
    setBusy(true); setError(null);
    try {
      // Si hay un bloque cubriendo esta celda → se elimina COMPLETO; si no → agrega media hora.
      const covering = mine.find((b) => b.weekday === weekday && b.startMinute <= hourMin && hourMin < b.endMinute);
      if (covering) {
        await deleteSchedule(covering.id);
      } else {
        await createSchedule({ doctorId: selected, weekday, startMinute: hourMin, endMinute: hourMin + 30 });
      }
      const { schedules: s } = await fetchSchedules();
      setSchedules(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el horario");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-4 rounded-2xl bg-blue-50 p-3 text-xs text-blue-800 ring-1 ring-blue-200">
        🗓 Este horario semanal es el que ven los clientes al agendar. La mayoría de las semanas
        no cambia nada: solo edita cuando el doctor muda su hora. Marca/Desmarca los bloques de
        media hora. Para otro doctor con el MISMO horario usa "Duplicar desde".
      </p>

      {/* Selector de doctor */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-xl bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-slate-200 outline-none"
        >
          {(doctors ?? []).filter((d) => d.active).map((d) => (
            <option key={d.id} value={d.id}>
              {d.fullName} · {d.kind === "general" ? "General" : d.specialtyName ?? d.kind}
            </option>
          ))}
        </select>
        <CopyDoctorButton doctors={doctors ?? []} selected={selected} onCopied={async () => {
          setBusy(true);
          try { const { schedules: s } = await fetchSchedules(); setSchedules(s); }
          catch (err) { setError(err instanceof Error ? err.message : "Error"); }
          finally { setBusy(false); }
        }} />
        {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Cuadrícula: Día × bloques de 30min (8:00-21:30) */}
      <div className="overflow-x-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="p-1 text-slate-400">Hora</th>
              {DIAS_LARGO.map((d) => <th key={d} className="p-1 text-slate-500">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {HORAS.map((m) => (
              <tr key={m}>
                <td className="whitespace-nowrap pr-2 text-right text-[10px] text-slate-400">{horaLbl(m)}</td>
                {[0, 1, 2, 3, 4, 5, 6].map((wd) => {
                  const block = (blocksByDay.get(wd) ?? []).find((b) => b.startMinute <= m && m < b.endMinute);
                  return (
                    <td key={wd} className="p-0.5">
                      <button
                        onClick={() => void toggle(wd, m)}
                        disabled={busy}
                        title={block ? `${horaLbl(block.startMinute)}–${horaLbl(block.endMinute)} — clic para QUITAR el bloque completo` : "Clic para MARCAR media hora aquí"}
                        className={`h-5 w-10 rounded border ${block
                          ? "border-brand-blue bg-brand-blue"
                          : coveredStarts.has(m) ? "border-transparent bg-transparent" : "border-slate-100 bg-slate-50 hover:bg-blue-100"}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-slate-400">
          Clic en un celda vacía marca media hora (el bloque azul completo se quita con un clic en él).
        </p>
      </div>
    </div>
  );
}

function CopyDoctorButton({ doctors, selected, onCopied }: {
  doctors: DoctorLite[];
  selected: string;
  onCopied: () => void;
}) {
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copiar() {
    if (!from || !selected || from === selected) return;
    setBusy(true); setError(null);
    try {
      const { schedules } = await fetchSchedules();
      const source = schedules.filter((s) => s.doctorId === from);
      const target = schedules.filter((s) => s.doctorId === selected);
      // copiar solo los bloques del origen que no existan ya en el destino (por weekday+start)
      for (const b of source) {
        if (target.some((t) => t.weekday === b.weekday && t.startMinute === b.startMinute)) continue;
        try {
          await createSchedule({ doctorId: selected, weekday: b.weekday, startMinute: b.startMinute, endMinute: b.endMinute });
        } catch { /* colección silenciosa: sigue con los demás */ }
      }
      onCopied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al copiar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-slate-200 outline-none">
        <option value="">⧉ Duplicar desde…</option>
        {doctors.filter((d) => d.active && d.id !== selected).map((d) => (
          <option key={d.id} value={d.id}>{d.fullName}</option>
        ))}
      </select>
      {from && (
        <button onClick={() => void copiar()} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          <Copy className="h-4 w-4" /> Copiar
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
