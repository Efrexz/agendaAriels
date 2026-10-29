import { useEffect, useState } from "react";
import { ChevronDown, Clock, GraduationCap, MessageCircle, Plus, Stethoscope } from "lucide-react";
import { createDoctor, createSpecialty, fetchCatalog, fetchMedConfig, putMedConfig, updateCatalog, type MedDoctorPanel, type MedSpecialtyPanel } from "./apiMedical";
import { MED_BRANCHES } from "../medical/api";
import { HorariosTab } from "./HorariosTab";

// Pestaña Config: duración de cita, texto de métodos de pago, doctores,
// especialidades y horarios médicos (tareas de baja frecuencia del counter).

export function ConfigTab() {
  const [config, setConfigState] = useState<Record<string, string> | null>(null);
  const [doctors, setDocs] = useState<MedDoctorPanel[]>([]);
  const [specialties, setSpecialties] = useState<MedSpecialtyPanel[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [nuevoDoc, setNuevoDoc] = useState({ fullName: "", branch: "san_martin", kind: "general", specialtyId: "" });
  const [nuevaEsp, setNuevaEsp] = useState({ name: "", cost: "", branches: "san_miguel" });

  useEffect(() => {
    let active = true;
    (async () => {
      setBusy(true);
      try {
        const [{ config: c }, { doctors: d, specialties: s }] = await Promise.all([
          fetchMedConfig(),
          fetchCatalog(),
        ]);
        if (active) { setConfigState(c ?? {}); setDocs(d ?? []); setSpecialties(s ?? []); }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Error al cargar");
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function guardarConfig(key: string, value: string, quietKey: string) {
    setBusy(true); setError(null); setSavedMsg(null);
    try {
      await putMedConfig(key, value);
      setSavedMsg(quietKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  if (busy && !config) return <p className="text-center text-sm text-slate-400">Cargando…</p>;

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {savedMsg && <p className="rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-700">✓ Guardado: {savedMsg}</p>}

      {/* Duración de cita */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-blue-500">
            <Clock className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-bold text-[#475AAB]">Duración de cada cita</h3>
        </div>
        <p className="mb-3 text-xs text-slate-500">Los horarios de la web se recalculan con este valor (conviene cambiarlo en horarios muertos: si todos ya agendaron cita no cambia la duración guardada).</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={15}
            max={120}
            step={5}
            value={config?.appt_duration_minutes ?? "60"}
            onChange={(e) => setConfigState((c) => ({ ...(c ?? {}), appt_duration_minutes: e.target.value }))}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
          />
          <span className="text-sm text-slate-500">minutos</span>
          <button onClick={() => void guardarConfig("appt_duration_minutes", config?.appt_duration_minutes ?? "60", "duración de cita")} disabled={busy} className="ml-auto rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Guardar
          </button>
        </div>
      </section>

      {/* Métodos de pago */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E8F7EE] text-green-600">
            <MessageCircle className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-bold text-[#475AAB]">Métodos de pago (texto del mensaje al cliente)</h3>
        </div>
        <p className="mb-3 text-xs text-slate-500">Va en el mensaje de "solicitud especializada". Actualiza los números cuando toque — el texto es libre.</p>
        <textarea
          rows={4}
          value={config?.payment_info ?? ""}
          onChange={(e) => setConfigState((c) => ({ ...(c ?? {}), payment_info: e.target.value }))}
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
        />
        <button onClick={() => void guardarConfig("payment_info", config?.payment_info ?? "", "métodos de pago")} disabled={busy} className="mt-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Guardar texto de pago
        </button>
      </section>

      {/* Doctores */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFF1E6] text-orange-500">
            <Stethoscope className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-bold text-[#475AAB]">Doctores</h3>
        </div>
        <div className="mb-4 flex flex-col gap-2">
          {doctors.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <span>
                <b>{d.fullName}</b> · {d.branch === "san_martin" ? "SPM" : d.branch === "los_olivos" ? "LO" : "SM"} · {d.kind === "general" ? "General" : d.specialtyName}
              </span>
              <button
                onClick={() => void updateCatalog("doctor", { id: d.id, active: !d.active }).then(() => setDocs((prev) => prev.map((x) => x.id === d.id ? { ...x, active: !d.active } : x))).catch((err) => setError(err instanceof Error ? err.message : "Error"))}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${d.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}
              >
                {d.active ? "Activo" : "Inactivo"}
              </button>
            </div>
          ))}
        </div>
        {/* Añadir doctor */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <input
            value={nuevoDoc.fullName}
            onChange={(e) => setNuevoDoc((n) => ({ ...n, fullName: e.target.value }))}
            placeholder="Nombre del doctor"
            className="min-w-40 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select value={nuevoDoc.branch} onChange={(e) => setNuevoDoc((n) => ({ ...n, branch: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            {MED_BRANCHES.map((b) => <option key={b.value} value={b.value}>{b.short}</option>)}
          </select>
          <select value={nuevoDoc.kind} onChange={(e) => setNuevoDoc((n) => ({ ...n, kind: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            <option value="general">General</option>
            <option value="especialista">Especialista</option>
          </select>
          {nuevoDoc.kind === "especialista" && (
            <select value={nuevoDoc.specialtyId} onChange={(e) => setNuevoDoc((n) => ({ ...n, specialtyId: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
              <option value="">Especialidad…</option>
              {specialties.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button
            onClick={() =>
              void createDoctor({
                fullName: nuevoDoc.fullName,
                branch: nuevoDoc.branch,
                doctorKind: nuevoDoc.kind as "general" | "especialista",
                specialtyId: nuevoDoc.specialtyId || null,
              })
                .then(() => void fetchCatalog().then(({ doctors }) => setDocs(doctors)).catch(() => {}))
                .then(() => setNuevoDoc({ fullName: "", branch: nuevoDoc.branch, kind: nuevoDoc.kind, specialtyId: "" }))
                .catch((err) => setError(err instanceof Error ? err.message : "Error al crear doctor"))
            }
            disabled={!nuevoDoc.fullName.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Añadir
          </button>
        </div>
      </section>

      {/* Especialidades */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EDEFFF] text-[#475AAB]">
            <GraduationCap className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-bold text-[#475AAB]">Especialidades (precio y sedes)</h3>
        </div>
        <div className="mb-4 flex flex-col gap-2">
          {specialties.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <span><b>{s.name}</b></span>
              <span className="flex items-center gap-2">
                S/
                <input type="number" defaultValue={s.cost} onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v && v !== s.cost)
                    void updateCatalog("specialty", { id: s.id, cost: v }).then(() => setSpecialties((prev) => prev.map((x) => x.id === s.id ? { ...x, cost: v } : x))).catch((err) => setError(err instanceof Error ? err.message : "Error"));
                }} className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                {MED_BRANCHES.map((b) => (
                  <button
                    key={b.value}
                    title={`${s.branches.includes(b.value) ? "Quitar" : "Agregar"} de ${b.short}`}
                    onClick={() => void updateCatalog("specialty", { id: s.id, branches: s.branches.includes(b.value) ? s.branches.filter((x) => x !== b.value) : [...s.branches, b.value] }).then(() => setSpecialties((prev) => prev.map((x) => x.id === s.id ? { ...x, branches: s.branches.includes(b.value) ? x.branches.filter((y) => y !== b.value) : [...x.branches, b.value] } : x))).catch((err) => setError(err instanceof Error ? err.message : "Error"))}
                    className={`h-7 w-9 rounded text-xs font-bold ${s.branches.includes(b.value) ? "bg-brand-blue text-white" : "bg-slate-200 text-slate-400"}`}
                  >{b.short === "San Martín" ? "SPM" : b.short === "Los Olivos" ? "LO" : "SM"}</button>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <input value={nuevaEsp.name} onChange={(e) => setNuevaEsp((n) => ({ ...n, name: e.target.value }))} placeholder="Nueva especialidad" className="min-w-40 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={nuevaEsp.cost} onChange={(e) => setNuevaEsp((n) => ({ ...n, cost: e.target.value }))} placeholder="Costo S/" type="number" className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select value={nuevaEsp.branches} onChange={(e) => setNuevaEsp((n) => ({ ...n, branches: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            <option value="san_martin">Solo SPM</option>
            <option value="los_olivos">Solo LO</option>
            <option value="san_miguel">Solo SM</option>
            <option value="ALL">Todas</option>
          </select>
          <button
            onClick={async () => {
              setError(null);
              try {
                const branches = nuevaEsp.branches === "ALL"
                  ? ["san_martin", "los_olivos", "san_miguel"]
                  : [nuevaEsp.branches];
                await createSpecialty({ name: nuevaEsp.name, cost: Number(nuevaEsp.cost), branches });
                const catalog = await fetchCatalog();
                setSpecialties(catalog.specialties);
                setNuevaEsp({ name: "", cost: "", branches: "san_miguel" });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Error al crear especialidad");
              }
            }}
            disabled={!nuevaEsp.name.trim() || !nuevaEsp.cost}
            className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Añadir
          </button>
        </div>
      </section>

      {/* Horarios médicos: sección desplegable (tarea de baja frecuencia, no
          debería ocupar una pestaña propia ni robar atención en el día a día) */}
      <HorariosSection />
    </div>
  );
}

function HorariosSection() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[#475AAB] block">📅 Horarios médicos de la web</h3>
          <p className="text-xs text-slate-500">El horario semanal que ve un cliente al agendar una cita en la web. Se toca solo cuando un doctor muda su horario.</p>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-4 border-t border-slate-100 pt-4"><HorariosTab /></div>}
    </section>
  );
}

