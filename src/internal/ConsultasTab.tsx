import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, PlusCircle } from "lucide-react";
import {
  assignMedAppt, fetchMedDay, fetchMedPending, patchMedStatus, searchMedAppts,
  type MedAppt,
} from "./apiMedical";
import { createAppointment, fetchDoctors, fetchSlots, fetchSpecialties, MED_BRANCHES, type MedBranch, type MedDoctor, type MedSlot, type MedSpecialty } from "../medical/api";
import { MED_SERVICE_LABELS, MED_STATUS_META, medStatusMeta } from "../medicalStatuses";

// Pestaña Consultas: vista del counter para citas médicas.
// Por defecto HOY, con franja de "Mañana", semana, búsqueda y citas manuales.

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function limaISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function isoPlus(days: number): string {
  const [y, m, d] = limaISO().split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function hour(min: number): string {
  const h = Math.floor(min / 60);
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(min % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

type Vista = "hoy" | "manana" | "semana";

export function ConsultasTab() {
  const [vista, setVista] = useState<Vista>("hoy");
  const [branch, setBranch] = useState<string>("all");
  const [appts, setAppts] = useState<MedAppt[]>([]);
  const [pendings, setPendings] = useState<MedAppt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MedAppt[] | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const searchSeqRef = useRef(0);

  // datos de la vista (setState siempre tras await)
  useEffect(() => {
    let active = true;
    (async () => {
      setBusy(true);
      try {
        if (vista === "semana") {
          const parts = await Promise.all([0, 1, 2, 3, 4, 5, 6].map((i) => fetchMedDay(isoPlus(i), branch)));
          if (active) {
            setAppts(parts.flatMap((p) => p.appointments));
            setError(null);
          }
        } else {
          const day = await fetchMedDay(vista === "hoy" ? limaISO() : isoPlus(1), branch);
          if (active) {
            setAppts(day.appointments);
            setError(null);
          }
        }
        const pending = await fetchMedPending(branch);
        if (active) setPendings(pending.appointments);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Error al cargar");
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [vista, branch, tick]);

  async function setApptStatus(a: MedAppt, status: string) {
    if (status === "cancelado" && !window.confirm(`¿Cancelar la cita ${a.appointmentCode} de ${a.petName}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await patchMedStatus(a.id, status);
      setTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, MedAppt[]>();
    for (const a of appts) {
      const key = a.doctorName ?? `Sin doctor (${a.serviceType})`;
      const arr = map.get(key);
      if (arr) arr.push(a);
      else map.set(key, [a]);
    }
    return [...map.entries()];
  }, [appts]);

  return (
    <div>
      {/* Por asignar (especializadas) — siempre visible arriba */}
      <PendientesBox pendings={pendings} onChanged={() => setTick((t) => t + 1)} />

      {/* Controles */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([["hoy", "Hoy"], ["manana", "Mañana"], ["semana", "Esta semana"]] as Array<[Vista, string]>).map(([v, label]) => (
          <button
            key={v}
            onClick={() => { setVista(v); setQuery(""); setSearchResults(null); }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${vista === v ? "bg-brand-blue text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-brand-blue"}`}
          >{label}</button>
        ))}
        <select
          value={branch}
          onChange={(e) => { setBranch(e.target.value); setQuery(""); setSearchResults(null); }}
          className="ml-auto rounded-xl bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-slate-200 outline-none"
        >
          <option value="all">Todas las sedes</option>
          {MED_BRANCHES.map((b) => <option key={b.value} value={b.value}>{b.short}</option>)}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={async () => {
            searchSeqRef.current += 1;
            const mySeq = searchSeqRef.current;
            if (query.trim().length >= 3) {
              try {
                const { results } = await searchMedAppts(query.trim());
                if (searchSeqRef.current === mySeq) setSearchResults(results);
              } catch { /* nada */ }
            } else setSearchResults(null);
          }}
          placeholder="Buscar código/teléfono/nombre…"
          className="w-52 rounded-xl bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-slate-200 outline-none"
        />
        <button
          onClick={() => setManualOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          <PlusCircle className="h-4 w-4" /> ＋ Cita manual
        </button>
      </div>

      {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {searchResults && (
        <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="mb-2 text-xs text-slate-500">Resultados de búsqueda ({searchResults.length})</p>
          {searchResults.map((a) => <ApptCard key={a.id} a={a} onChanged={() => { setSearchResults(null); setQuery(""); setTick((t) => t + 1); }} onStatus={setApptStatus} />)}
        </div>
      )}

      {/* Lista del día/semana agrupada por doctor */}
      {!searchResults && (
        <div className="flex flex-col gap-5">
          {busy && appts.length === 0 && <p className="text-center text-sm text-slate-400">Cargando…</p>}
          {!busy && appts.length === 0 && (
            <p className="rounded-2xl bg-white/70 p-6 text-center text-sm text-slate-400">
              No hay citas para {vista === "hoy" ? "hoy" : vista === "manana" ? "mañana" : "esta semana"}{branch !== "all" ? ` en ${MED_BRANCHES.find((b) => b.value === branch)?.short}` : ""}
            </p>
          )}
          {grouped.map(([doctor, list]) => (
            <section key={doctor}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                🩺 {doctor}
                <span className="text-slate-400">({list.length})</span>
              </h3>
              <div className="flex flex-col gap-2">
                {list.map((a) => <ApptCard key={a.id} a={a} onChanged={() => setTick((t) => t + 1)} onStatus={setApptStatus} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {manualOpen && <ManualApptModal onClose={(reload) => { setManualOpen(false); if (reload) setTick((t) => t + 1); }} />}
    </div>
  );
}

function PendientesBox({ pendings, onChanged }: { pendings: MedAppt[]; onChanged: () => void }) {
  if (pendings.length === 0) return null;
  return (
    <div className="mb-5 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="mb-2 text-sm font-bold text-amber-800">📥 Pendientes de asignar ({pendings.length}) — especializadas</p>
      <div className="flex flex-col gap-2">
        {pendings.map((a) => <PendingRow key={a.id} a={a} onChanged={onChanged} />)}
      </div>
    </div>
  );
}

function PendingRow({ a, onChanged }: { a: MedAppt; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [doctors, setDocList] = useState<MedDoctorLite[] | null>(null);
  const [docId, setDocId] = useState("");
  const [date, setPicker] = useState("");
  const [startMin, setStart] = useState<number | null>(null);
  const [slots, setSlotsList] = useState<Array<{ startMinute: number; label: string }>>([]);
  const [busy, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esSolicitud = a.status === "solicitud";

  async function marcarPagado() {
    setPending(true); setError(null);
    try { await patchMedStatus(a.id, "pagado"); onChanged(); }
    catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setPending(false); }
  }

  async function abrirAsignar() {
    setOpen(true);
    if (!doctors) {
      setPending(true);
      try {
        // Asignar especializadas: SOLO doctores especialistas
        const docs = (await fetchDoctors(a.branch as MedBranch)).filter((d) => d.kind !== "general");
        setDocList(docs);
        if (docs.length > 0) setDocId(docs[0].id);
        else setError("No hay especialistas disponibles en esta sede.");
      } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
      finally { setPending(false); }
    }
  }

  async function asignar() {
    if (!date || startMin === null || !docId) return;
    setPending(true); setError(null);
    try {
      await assignMedAppt({ id: a.id, doctorId: docId, apptDate: date, startMinute: startMin });
      setOpen(false); onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : "Error al asignar"); }
    finally { setPending(false); }
  }

  async function cargarSlots(d: string) {
    setPicker(d); setStart(null); setSlotsList([]);
    if (!docId) return;
    try {
      const loadedSlots = await fetchSlots(docId, d);
      setSlotsList(loadedSlots);
    } catch { setSlotsList([]); }
  }

  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <b className="font-mono text-brand-blue">{a.appointmentCode}</b> · {a.specialtyName} · {a.petName} ({a.petType}) · {a.ownerName} · {a.ownerPhone}
        </div>
        <div className="flex gap-2">
          {esSolicitud ? (
            <button onClick={() => void marcarPagado()} disabled={busy} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
              💰 Verifiqué el pago
            </button>
          ) : (
            <button onClick={() => void abrirAsignar()} disabled={busy} className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
              🩺 Asignar doctor/fecha
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 border-t border-amber-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              {(doctors ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input type="date" value={date} onChange={(e) => void cargarSlots(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          {date && slots.length === 0 && <p className="mt-2 text-xs text-slate-400">Sin horas libres para esa fecha (prueba otra).</p>}
          {slots.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {slots.map((s) => (
                <button key={s.startMinute} onClick={() => setStart(s.startMinute)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${startMin === s.startMinute ? "bg-brand-orange text-white" : "bg-slate-100 text-slate-700"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {startMin !== null && (
            <button onClick={() => void asignar()} disabled={busy} className="mt-3 w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Asignar y pasar a 'asignada'
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface MedDoctorLite { id: string; name: string; kind: string; specialty: string | null }

function ApptCard({ a, onChanged, onStatus }: {
  a: MedAppt;
  onChanged: () => void;
  onStatus: (a: MedAppt, status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = medStatusMeta(a.status);

  const nextActions: Array<[string, string]> = [];
  if (a.status === "confirmada") nextActions.push(["en_consulta", "🏥 Entró"], ["no_llego", "⏰ No llegó"], ["cancelado", "❌ Cancelar"]);
  else if (a.status === "en_consulta") nextActions.push(["atendida", "🏁 Atendida"]);
  else if (a.status === "asignada") nextActions.push(["confirmada", "📨 Confirmar al cliente"]);

  return (
    <article className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex cursor-pointer items-center justify-between gap-3 p-4" onClick={() => setOpen((v) => !v)}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-brand-blue">{a.appointmentCode}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>{meta.emoji} {meta.label}</span>
            <span className="text-xs text-slate-500">{MED_SERVICE_LABELS[a.serviceType]}{a.specialtyName ? ` · ${a.specialtyName}` : ""}</span>
          </div>
          <p className="mt-1 truncate text-sm text-slate-600">
            {a.apptDate ? `${DIAS[new Date(a.apptDate + "T12:00:00Z").getUTCDay()]} ${a.apptDate}` : "Sin fecha"}{a.startMinute !== null ? ` · ${hour(a.startMinute)}` : ""} · {a.petName} ({a.ownerName})
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="border-t border-slate-100 p-4 pt-3">
          <p className="text-sm text-slate-600">👤 {a.ownerName} · 📞 {a.ownerPhone}{a.ownerEmail !== "-" ? ` · ✉ ${a.ownerEmail}` : ""}</p>
          {a.petNotes && a.petNotes !== "-" && <p className="text-sm text-slate-500">📝 {a.petNotes}</p>}
          {a.doctorName && <p className="text-sm text-slate-600">🩺 {a.doctorName}</p>}
          {a.needsOrder && (
            <p className="text-xs text-amber-700">📄 Orden médica: {a.hasOrder ? "presentará orden sellada" : "⚠️ sin orden"}</p>
          )}
          {a.paymentNotes && a.paymentNotes !== "-" && <p className="text-xs text-slate-500">💳 {a.paymentNotes}</p>}
          {nextActions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {nextActions.map(([s, label]) => (
                <button
                  key={s}
                  onClick={() => onStatus(a, s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${s === "cancelado" || s === "no_llego" ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >{label}</button>
              ))}
            </div>
          )}
          {a.timeline && a.timeline.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500">Historial ({a.timeline.length})</summary>
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-slate-400">
                {a.timeline.map((t, i) => (
                  <li key={i}>{new Date(t.createdAt).toLocaleString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} — {MED_STATUS_META[t.status]?.label ?? t.status} ({t.createdBy})</li>
                ))}
              </ul>
            </details>
          )}
          <button onClick={onChanged} className="hidden" />
        </div>
      )}
    </article>
  );
}

function ManualApptModal({ onClose }: { onClose: (reload: boolean) => void }) {
  const [branch, setBranch] = useState<MedBranch>("san_miguel");
  const [serviceType, setService] = useState<"general" | "rayos" | "eco" | "especializada">("general");
  const [doctors, setDocList] = useState<MedDoctor[] | null>(null);
  const [doctorId, setDoctor] = useState("");
  const [specialties, setSpecList] = useState<MedSpecialty[] | null>(null);
  const [specialtyId, setSpecialty] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlotsList] = useState<MedSlot[]>([]);
  const [startMinute, setStart] = useState<number | null>(null);
  const [name, setName] = useState({ petName: "", ownerName: "", ownerPhone: "", petNotes: "", petType: "Perro" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [list, specs] = await Promise.all([
          fetchDoctors(branch),
          fetchSpecialties(branch),
        ]);
        if (active) {
          // Igual que el wizard: generales atienden general/rayos/eco
          setDocList(list.filter((d) => d.kind === "general"));
          setSpecList(specs);
          if (list[0]) setDoctor(list[0].id);
          if (specs[0]) setSpecialty(specs[0].id);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Error al cargar doctores");
      }
    })();
    return () => { active = false; };
  }, [branch]);

  async function loadSlots(d: string) {
    setDate(d); setStart(null); setSlotsList([]);
    if (!doctorId) return;
    try { setSlotsList(await fetchSlots(doctorId, d)); } catch { setSlotsList([]); setError("No se pudieron cargar las horas de esa fecha."); }
  }

  async function guardar() {
    setError(null);
    try {
      await createAppointment({
        branch, serviceType,
        specialtyId: serviceType === "especializada" ? specialtyId : null,
        doctorId: serviceType === "especializada" ? null : doctorId,
        date: serviceType === "especializada" ? null : date,
        startMinute: serviceType === "especializada" ? null : startMinute,
        petName: name.petName.trim(), petType: name.petType, petNotes: name.petNotes.trim() || "-",
        ownerName: name.ownerName.trim(), ownerPhone: name.ownerPhone.trim(), ownerEmail: "-",
      });
      onClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm" onClick={() => onClose(false)}>
      <div className="mt-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 font-display text-lg font-bold text-slate-900">＋ Cita manual (teléfono / mostrador)</h3>
        {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="grid gap-3">
          <Row label="Sede">
            <select value={branch} onChange={(e) => setBranch(e.target.value as MedBranch)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              {MED_BRANCHES.map((b) => <option key={b.value} value={b.value}>{b.short}</option>)}
            </select>
          </Row>
          <Row label="Servicio">
            <select value={serviceType} onChange={(e) => setService(e.target.value as typeof serviceType)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              <option value="general">Consulta General</option>
              <option value="rayos">Radiografía</option>
              <option value="eco">Ecografía</option>
              <option value="especializada">Especializada</option>
            </select>
          </Row>
          {serviceType === "especializada" ? (
            <Row label="Especialidad">
              <select value={specialtyId} onChange={(e) => setSpecialty(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                {(specialties ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} — S/ {s.cost}</option>)}
              </select>
            </Row>
          ) : (
            <>
              <Row label="Doctor">
                <select value={doctorId} onChange={(e) => setDoctor(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                  {(doctors ?? []).filter((d) => d.kind === "general").map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Row>
              <Row label="Fecha">
                <input type="date" value={date} onChange={(e) => void loadSlots(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              </Row>
              {slots.length > 0 && (
                <Row label="Hora">
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map((s) => (
                      <button key={s.startMinute} onClick={() => setStart(s.startMinute)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${startMinute === s.startMinute ? "bg-brand-orange text-white" : "bg-slate-100 text-slate-700"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </Row>
              )}
            </>
          )}
          <input value={name.petName} onChange={(e) => setName((n) => ({ ...n, petName: e.target.value }))} placeholder="Mascota (nombre)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            {["Perro", "Gato"].map((t) => (
              <button key={t} onClick={() => setName((n) => ({ ...n, petType: t }))} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${name.petType === t ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-700"}`}>{t}</button>
            ))}
          </div>
          <input value={name.ownerName} onChange={(e) => setName((n) => ({ ...n, ownerName: e.target.value }))} placeholder="Nombre del dueño" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input value={name.ownerPhone} onChange={(e) => setName((n) => ({ ...n, ownerPhone: e.target.value }))} placeholder="Celular (WhatsApp)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <textarea value={name.petNotes} onChange={(e) => setName((n) => ({ ...n, petNotes: e.target.value }))} rows={2} placeholder="Motivo / notas (opcional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button
            onClick={() => void guardar()}
            disabled={
              (serviceType !== "especializada" && (!date || startMinute === null)) ||
              (serviceType === "especializada" && !specialtyId)
            }
            className="rounded-xl bg-brand-blue py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Crear cita
          </button>
          <button onClick={() => onClose(false)} className="text-sm text-slate-400">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
