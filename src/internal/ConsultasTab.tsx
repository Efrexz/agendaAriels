import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Clock, FileText, History, MapPin, NotebookText, Phone, PlusCircle, Search, Stethoscope, UserRound, type LucideIcon } from "lucide-react";
import {
  assignMedAppt, fetchMedDay, fetchMedPending, fetchSchedules, patchMedStatus, resendMedNotice, searchMedAppts,
  type MedAppt, type ScheduleWithDoctor,
} from "./apiMedical";
import { createAppointment, fetchDoctors, fetchSlots, fetchSpecialties, MED_BRANCHES, type MedBranch, type MedDoctor, type MedSlot, type MedSpecialty } from "../medical/api";
import { MED_SERVICE_LABELS, MED_STATUS_META, medStatusMeta } from "../medicalStatuses";
import { MiniWhatsApp } from "./MiniWhatsApp";
import { NewArrivalsToast } from "./NewArrivalsToast";
import { ModalShell } from "./ModalShell";
import { ConfirmModal } from "./ConfirmModal";
import { useVisibleRefresh } from "./useVisibleRefresh";

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

export function ConsultasTab({ jumpSearch = null }: { jumpSearch?: string | null }) {
  const [vista, setVista] = useState<Vista>("hoy");
  const [branch, setBranch] = useState<string>("all");
  const [appts, setAppts] = useState<MedAppt[]>([]);
  const [pendings, setPendings] = useState<MedAppt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MedAppt[] | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  // Prefijo para "🔁 Reagendar": datos del dueño/mascota listos, el counter
  // solo elige fecha/hora (o especialidad). El guard de "¿descartar?" compara
  // contra este base, no pide confirmación si el usuario no tocó nada.
  const [manualPrefill, setManualPrefill] = useState<ManApptPrefill | null>(null);
  const [tick, setTick] = useState(0);
  // Toast de llegadas nuevas (citas creadas tras abrir el panel y aún no vistas)
  const [novelCount, setNovelCount] = useState(0);
  const sessionStartRef = useRef<number | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);
  const searchSeqRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Evita interrumpir búsquedas, formularios o peticiones en curso. La vista
  // semanal hace ocho consultas, por eso se actualiza con menor frecuencia.
  useVisibleRefresh(setTick, !query.trim() && !manualOpen && !busy, vista === "semana" ? 60_000 : 30_000);

  // Salto desde 📚 Historial: busca el código al montar en la frontera async.
  useEffect(() => {
    if (!jumpSearch) return;
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      const term = jumpSearch.trim();
      if (term.length < 3) return;
      setQuery(term);
      try {
        const { results } = await searchMedAppts(term);
        if (active) setSearchResults(results ?? []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "No se pudo abrir el código del historial");
      }
    })();
    return () => {
      active = false;
    };
  }, [jumpSearch]);  

  // datos de la vista (setState siempre tras await)
  useEffect(() => {
    let active = true;
    (async () => {
      setBusy(true);
      try {
        sessionStartRef.current ??= Date.now();
        const sessionStart = sessionStartRef.current ?? Date.now();
        const deVista: MedAppt[] = vista === "semana"
          ? (await Promise.all([0, 1, 2, 3, 4, 5, 6].map((i) => fetchMedDay(isoPlus(i), branch)))).flatMap((p) => p.appointments ?? [])
          : (await fetchMedDay(vista === "hoy" ? limaISO() : isoPlus(1), branch)).appointments ?? [];
        if (active) {
          setAppts(deVista);
          setError(null);
        }
        const pending = await fetchMedPending(branch);
        if (active) {
          setPendings(pending.appointments ?? []);
          // Llegadas nuevas (citas creadas tras abrir el panel y aún no vistas).
          // En "semana" no se pescan históricos: solo se marcan como vistos.
          const universo: MedAppt[] = [...(pending.appointments ?? []), ...deVista];
          const fresh = universo.filter(
            (x) => vista !== "semana" && new Date(x.createdAt).getTime() > sessionStart && !seenRef.current.has(x.id),
          );
          for (const x of universo) seenRef.current.add(x.id);
          if (!firstLoadRef.current && fresh.length > 0) setNovelCount((c) => c + fresh.length);
          firstLoadRef.current = false;
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
  }, [vista, branch, tick]);

  useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    },
    [],
  );

  async function setApptStatus(a: MedAppt, status: string) {
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

  // Reagendar: abre el modal manual con identidad prefijada (dueño/mascota);
  // el counter solo completa fecha/hora o especialidad.
  function openReagendar(a: MedAppt) {
    setManualPrefill({
      branch: a.branch as MedBranch,
      serviceType: a.serviceType,
      specialtyId: a.specialtyId ?? "",
      petName: a.petName,
      petType: a.petType,
      ownerName: a.ownerName,
      ownerPhone: a.ownerPhone,
      petNotes: a.petNotes === "-" ? "" : a.petNotes,
    });
    setManualOpen(true);
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
      {/* Encabezado */}
      <header className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-brand-blue">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold leading-tight text-[#475AAB]">Citas médicas</h2>
          <p className="text-xs text-slate-500"> Agenda del día/semana, búsquedas y pendientes</p>
        </div>
      </header>

      {/* Por asignar (especializadas) — siempre visible arriba */}
      <PendientesBox pendings={pendings} onChanged={() => setTick((t) => t + 1)} />

      {/* Controles — control segmentado (estilo común de las 3 pestañas) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {([["hoy", "Hoy"], ["manana", "Mañana"], ["semana", "Esta semana"]] as Array<[Vista, string]>).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { setVista(v); setQuery(""); setSearchResults(null); }}
              className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
                vista === v
                  ? "bg-brand-blue text-white shadow-sm"
                  : "text-slate-500 hover:text-brand-blue"
              }`}
            >{label}</button>
          ))}
        </div>
        <select
          value={branch}
          onChange={(e) => { setBranch(e.target.value); setQuery(""); setSearchResults(null); }}
          className="ml-auto rounded-2xl bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-slate-200 outline-none transition hover:ring-brand-blue"
        >
          <option value="all">Todas las sedes</option>
          {MED_BRANCHES.map((b) => <option key={b.value} value={b.value}>{b.short}</option>)}
        </select>
        <label className="flex w-52 items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200 outline-none transition focus-within:ring-brand-blue">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => {
              // Igual que el grooming: búsqueda en vivo con debounce (no onBlur)
              const raw = e.target.value;
              setQuery(raw);
              searchSeqRef.current += 1;
              const mySeq = searchSeqRef.current;
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              if (raw.trim().length < 3) {
                setSearchResults(null);
                return;
              }
              searchTimerRef.current = setTimeout(() => {
                void (async () => {
                  try {
                    const { results } = await searchMedAppts(raw.trim());
                    if (searchSeqRef.current === mySeq) setSearchResults(results ?? []);
                  } catch {
                    /* conserva lo anterior */
                  }
                })();
              }, 300);
            }}
            placeholder="Buscar código/teléfono/nombre…"
            className="w-full text-sm outline-none"
          />
        </label>
        <button
          onClick={() => setManualOpen(true)}
          className="flex items-center gap-1.5 rounded-2xl bg-brand-blue px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0"
        >
          <PlusCircle className="h-4 w-4" />Cita manual
        </button>
      </div>

      {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {searchResults && (
        <div className="no-print mb-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="mb-2 text-xs text-slate-500">Resultados de búsqueda ({searchResults.length})</p>
          {searchResults.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-slate-400">
              Sin resultados para "{query}".
            </p>
          )}
          {searchResults.map((a) => <ApptCard key={a.id} a={a} onStatus={setApptStatus} onReagendar={openReagendar} onUpdate={() => setTick((t) => t + 1)} />)}
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
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-blue">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EFF6FF] text-blue-500">
                  <Stethoscope className="h-3.5 w-3.5" />
                </span>
                {doctor}
                <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[11px] font-bold text-brand-blue">
                  {list.length} cita{list.length !== 1 ? "s" : ""}
                </span>
              </h3>
              <div className="flex flex-col gap-2">
                {list.map((a) => <ApptCard key={a.id} a={a} onStatus={setApptStatus} onReagendar={openReagendar} onUpdate={() => setTick((t) => t + 1)} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {manualOpen && <ManualApptModal prefill={manualPrefill} onClose={(reload) => { setManualOpen(false); setManualPrefill(null); if (reload) setTick((t) => t + 1); }} />}

      {/* Llegadas nuevas con el panel abierto */}
      <NewArrivalsToast
        count={novelCount}
        label="cita médica nueva"
        onView={() => { setNovelCount(0); setTick((t) => t + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
      />
    </div>
  );
}

function PendientesBox({ pendings, onChanged }: { pendings: MedAppt[]; onChanged: () => void }) {
  if (pendings.length === 0) return null;
  return (
    <div className="mb-5 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="mb-2 text-sm font-bold text-amber-800">📥 Citas por confirmar fecha y hora ({pendings.length})</p>
      <div className="flex flex-col gap-2">
        {pendings.map((a) => <PendingRow key={a.id} a={a} onChanged={onChanged} />)}
      </div>
    </div>
  );
}

// Chip V2: distingue el flujo de cada fila pendiente (antes el título del box
// mezclaba pago de especializadas con solicitudes de próxima semana).
function PendingChip({ a }: { a: MedAppt }) {
  if (a.serviceType === "especializada") {
    return a.status === "solicitud" ? (
      <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
        🎓 Especializada · pago pendiente
      </span>
    ) : (
      <span className="inline-flex w-fit items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-sky-200">
        🎓 Especializada · por asignar
      </span>
    );
  }
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-200">
      🗓 Semana próxima · sin hora
    </span>
  );
}

function PendingRow({ a, onChanged }: { a: MedAppt; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [doctors, setDocList] = useState<MedDoctorLite[] | null>(null);
  // Bloques semanales del doctor (horarios de ⚙ Config): base de los chips V2.
  const [scheds, setSchedsList] = useState<ScheduleWithDoctor[] | null>(null);
  const [docId, setDocId] = useState("");
  const [date, setPicker] = useState("");
  const [startMin, setStart] = useState<number | null>(null);
  const [slots, setSlotsList] = useState<Array<{ startMinute: number; label: string }>>([]);
  // Citas ocupadas de ese día del doctor (grid V2: chips tachadas).
  const [busyAppts, setBusyList] = useState<Array<{ startMinute: number; durationMinutes: number }>>([]);
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
        // Especializadas: SOLO especialistas. Solicitudes de próxima semana
        // (general/rayos/eco): cualquier doctor activo, con el pedido preseleccionado.
        // Los horarios van en paralelo: si fallan, los chips V2 no aparecen y
        // queda la vía de "Otra hora (excepcional)" — la asignación no se bloquea.
        const [todos, schedRes] = await Promise.all([
          fetchDoctors(a.branch as MedBranch),
          fetchSchedules().catch(() => ({ schedules: [] as ScheduleWithDoctor[] })),
        ]);
        const docs = a.serviceType === "especializada" ? todos.filter((d) => d.kind !== "general") : todos;
        setDocList(docs);
        setSchedsList(schedRes.schedules ?? []);
        if (a.serviceType !== "especializada" && a.doctorId && docs.some((d) => d.id === a.doctorId)) setDocId(a.doctorId);        else if (docs.length > 0) setDocId(docs[0].id);
        else setError(a.serviceType === "especializada" ? "No hay especialistas disponibles en esta sede." : "No hay doctores disponibles en esta sede.");
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

  // Hora manual (HH:MM) → minutos: para horas fuera de grilla (9:15, 9:20…)
  const [manualTime, setManualTime] = useState("");
  function setManualHour(value: string) {
    setManualTime(value);
    const [h, m] = value.split(":").map(Number);
    if (!Number.isNaN(h) && !Number.isNaN(m)) setStart((h ?? 0) * 60 + (m ?? 0));
  }

  async function cargarSlots(d: string) {
    setPicker(d); setStart(null); setSlotsList([]); setBusyList([]);
    if (!docId) return;
    try {
      // Slots libres (API pública, mismos datos del wizard) + citas del día
      // del staff: las ocupadas se pintan en el grid V2 como inhabilitadas.
      const [loadedSlots, dayRes] = await Promise.all([
        fetchSlots(docId, d),
        fetchMedDay(d, "all"),
      ]);
      setSlotsList(loadedSlots);
      setBusyList(
        (dayRes.appointments ?? [])
          .filter((x) => x.doctorId === docId && x.startMinute !== null)
          .map((x) => ({ startMinute: x.startMinute!, durationMinutes: x.durationMinutes })),
      );
    } catch { setSlotsList([]); }
  }

  // Chip V2 (pedido del dueño): rejilla cada 15 min dentro del HORARIO REAL
  // del doctor (bloques de ⚙ Config para el weekday de la fecha). Naranja =
  // hora libre sugerida por la API de disponibilidad; tachada = colisión con
  // otra cita (no clicable); azul = dentro del horario y libre. Fuera del
  // horario solo se puede vía el desplegable "Otra hora (excepcional)".
  const docBlocks = date && docId
    ? (scheds ?? []).filter((s) => s.doctorId === docId && s.weekday === weekdayOfDate(date))
    : [];
  const chipsGrid: Array<{ min: number; label: string; suggested: boolean; taken: boolean }> = [];
  if (date && docId && docBlocks.length > 0) {
    // Duración de cita inferida del paso real de la grilla de slots (Config
    // "duración cita"); sin slots se asume 60 min.
    let dur = 60;
    for (let i = 1; i < slots.length; i++) {
      const paso = slots[i].startMinute - slots[i - 1].startMinute;
      if (paso > 0) dur = Math.min(dur, paso);
    }
    const seen = new Set<number>();
    for (const b of docBlocks) {
      for (let m = b.startMinute; m + dur <= b.endMinute; m += 15) {
        if (seen.has(m)) continue;
        seen.add(m);
        chipsGrid.push({
          min: m,
          label: horaCorta(m),
          suggested: slots.some((s) => s.startMinute === m),
          taken: busyAppts.some((x) => m < x.startMinute + x.durationMinutes && m + dur > x.startMinute),
        });
      }
    }
  }
  const chipsManaña = chipsGrid.filter((c) => c.min < 720);
  const chipsTarde = chipsGrid.filter((c) => c.min >= 720);

  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm flex flex-wrap items-center gap-2">
          <b className="font-mono text-brand-blue">{a.appointmentCode}</b>
          <PendingChip a={a} />
          <span>{a.specialtyName} · {a.petName} ({a.petType}) · {a.ownerName} · {a.ownerPhone}</span>
        </div>
        <div className="flex gap-2">
          {esSolicitud && a.serviceType === "especializada" ? (
            <button onClick={() => void marcarPagado()} disabled={busy} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
              💰 Verifiqué el pago
            </button>
          ) : (
            <button onClick={() => void abrirAsignar()} disabled={busy} className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
              {a.serviceType === "especializada" ? "🩺 Asignar doctor/fecha" : "🗓 Confirmar horario (avisamos al cliente)"}
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
          {/* Estado inicial: sin fecha aún no hay horas que mostrar — guía el
              flujo (antes quedaba un input de hora suelto sin contexto). */}
          {!date && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Clock className="h-3.5 w-3.5 shrink-0 text-brand-orange" />
              Elige una fecha para ver las horas del doctor.
            </p>
          )}
          {date && slots.length === 0 && docBlocks.length === 0 && (
            <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-100">
              Sin horas en el horario semanal de ⚙ Config para ese día — usa una
              hora excepcional, o pide configurar el horario del doctor.
            </div>
          )}
          {/* Slots librados sin horario semanal en memoria local (ej. la API de
              horarios falló): no perder las horas sugeridas — chips simples. */}
          {date && docBlocks.length === 0 && slots.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {slots.map((s) => (
                <button
                  key={s.startMinute}
                  onClick={() => { setStart(s.startMinute); setManualTime(""); }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    startMin === s.startMinute && !manualTime
                      ? "bg-brand-orange text-white"
                      : "bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {chipsManaña.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              <ChipGroup titulo="☀️ Mañana" grupo={chipsManaña} startMin={startMin} manualTime={manualTime}
                onPick={(min) => { setStart(min); setManualTime(""); }} />
              <ChipGroup titulo="🌇 Tarde" grupo={chipsTarde} startMin={startMin} manualTime={manualTime}
                onPick={(min) => { setStart(min); setManualTime(""); }} />
            </div>
          )}
          {/* La excepción, no la regla (pedido explícito del dueño): desplegable
              cuando hay grid; input directo solo en el fallback sin grid. */}
          {chipsManaña.length > 0 ? (
            <details className="mt-2 w-fit">
              <summary className="w-fit cursor-pointer select-none rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-blue ring-1 ring-blue-100 hover:bg-blue-50">
                ⏱ Otra hora (excepcional)
              </summary>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="time"
                  step={60}
                  value={manualTime}
                  onChange={(e) => setManualHour(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
                <span className="text-xs text-slate-400">(fuera del horario regular, ej. 9:15)</span>
              </div>
            </details>
          ) : date ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Hora (excepcional):</span>
              <input
                type="time"
                step={60}
                value={manualTime}
                onChange={(e) => setManualHour(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          ) : null}
          {startMin !== null && manualTime && (
            <p className="mt-2 text-xs text-amber-700">
              ⚠️ Hora excepcional ({manualTime}) fuera del horario regular del doctor.
            </p>
          )}
          {startMin !== null && (
            <button onClick={() => void asignar()} disabled={busy} className="mt-3 w-full rounded-lg bg-brand-blue py-2 text-sm font-semibold text-white disabled:opacity-50">
              ✅ Confirmar horario y avisar al cliente
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface MedDoctorLite { id: string; name: string; kind: string; specialty: string | null }

// Etiquetas humanas de los eventos M1 de WhatsApp en el historial de citas.
const WA_EVENT_META: Record<string, string> = {
  wa_fallado: "⚠ Aviso por WhatsApp no entregado",
  wa_entregado: "✓ Aviso por WhatsApp entregado",
};

// Hora compacta del grid V2: 690 → "8:30a" (mismo formato 12h del sistema).
function horaCorta(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}m`;
}

// Weekday (0=domingo) de una fecha yyyy-mm-dd — MISMA convención que
// weekdayOf en api/medical/slots.ts, de donde vienen los bloques de ⚙ Config.
function weekdayOfDate(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
}

// Grupos de chips con separador mañana/tarde (mismo lenguaje del wizard).
function ChipGroup({ titulo, grupo, startMin, manualTime, onPick }: {
  titulo: string;
  grupo: Array<{ min: number; label: string; suggested: boolean; taken: boolean }>;
  startMin: number | null;
  manualTime: string;
  onPick: (min: number) => void;
}) {
  if (grupo.length === 0) return null;
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#8A97B1]">{titulo}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {grupo.map((c) => {
          const sel = startMin === c.min && !manualTime;
          if (c.taken) {
            return (
              <button
                key={c.min}
                disabled
                aria-disabled="true"
                title="Ocupada: hay otra cita en esta hora"
                className="cursor-not-allowed rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-300 line-through ring-1 ring-red-100"
              >
                {c.label}
              </button>
            );
          }
          return (
            <button
              key={c.min}
              onClick={() => onPick(c.min)}
              title={c.suggested ? undefined : "Libre dentro del horario del doctor"}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                sel
                  ? "bg-brand-orange text-white shadow-sm"
                  : c.suggested
                    ? "bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100"
                    : "bg-slate-100 text-slate-600 ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Borde de color por estado (mismo semáforo que las cards de grooming).
const MED_BORDER: Record<string, string> = {
  solicitud: "border-l-amber-400",
  pagado: "border-l-amber-400",
  asignada: "border-l-blue-500",
  confirmada: "border-l-green-500",
  en_consulta: "border-l-sky-500",
  atendida: "border-l-slate-400",
  no_llego: "border-l-orange-400",
  cancelado: "border-l-red-500",
};

// Chip de fecha/hora pastel por estado (mock: hora grande a la izquierda).
const MED_TIME_CHIP: Record<string, string> = {
  solicitud: "bg-amber-50 text-amber-700",
  pagado: "bg-amber-50 text-amber-700",
  asignada: "bg-blue-50 text-blue-700",
  confirmada: "bg-green-50 text-green-700",
  en_consulta: "bg-sky-50 text-sky-700",
  atendida: "bg-slate-100 text-slate-600",
  no_llego: "bg-orange-50 text-orange-700",
  cancelado: "bg-red-50 text-red-700",
};

// Bloques del detalle estilo mockup: icono pastel + label + valor.
function InfoCell({ icon: Icon, tint, label, children }: {
  icon: LucideIcon;
  tint: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-[#F8FBFF] px-3 py-2.5 ring-1 ring-[#EDF4FD]">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-[#8A97B1]">{label}</span>
        <span className="block break-words text-sm font-semibold text-[#1A2238]">{children}</span>
      </span>
    </div>
  );
}

function ApptCard({ a, onStatus, onReagendar, onUpdate }: {
  a: MedAppt;
  onStatus: (a: MedAppt, status: string) => void;
  onReagendar: (a: MedAppt) => void;
  onUpdate: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Confirmación de cancelación con modal propio (adiós window.confirm)
  const [confirmCancel, setConfirmCancel] = useState(false);
  // M1 honestidad: reenvío del aviso de WhatsApp cuando falló y no se entregó después.
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const meta = medStatusMeta(a.status);

  // ⚠ vivo: hay un "wa_fallado" SIN un "wa_entregado" posterior en el historial.
  const avisoFallado = (() => {
    let failed = false;
    for (const ev of a.timeline ?? []) {
      if (ev.status === "wa_fallado") failed = true;
      else if (ev.status === "wa_entregado") failed = false;
    }
    return failed;
  })();

  async function reenviarAviso() {
    setResendBusy(true); setResendMsg(null);
    try {
      const out = await resendMedNotice(a.id);
      setResendMsg(out.sent ? "✓ Aviso reenviado por WhatsApp." : "⚠ No se pudo enviar — intenta de nuevo o avisa al cliente por llamada.");
      onUpdate();
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : "Error al reenviar el aviso");
    } finally {
      setResendBusy(false);
    }
  }

  const nextActions: Array<[string, string]> = [];
  if (a.status === "confirmada") nextActions.push(["en_consulta", "🏥 Entró"], ["no_llego", "⏰ No llegó"], ["cancelado", "❌ Cancelar"]);
  else if (a.status === "en_consulta") nextActions.push(["atendida", "🏁 Atendida"]);
  else if (a.status === "asignada") nextActions.push(["confirmada", "📨 Confirmar al cliente"]);

  // Chip de fecha/hora: día corto + fecha corta en Lima.
  const fechaChip = (() => {
    if (!a.apptDate) return { dia: "Sin", corto: "fecha", hora: "" };
    const d = new Date(a.apptDate + "T12:00:00Z");
    const dia = DIAS[d.getUTCDay()];
    const corto = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "short" }).format(d);
    return { dia, corto, hora: a.startMinute !== null ? hour(a.startMinute) : "" };
  })();

  const timeChip = MED_TIME_CHIP[a.status] ?? "bg-slate-100 text-slate-600";
  // Último evento del timeline: línea visible al pie (mock).
  const ultimo = a.timeline?.length ? a.timeline[a.timeline.length - 1] : null;

  return (
    <article className={`rounded-2xl border-l-4 bg-white shadow-sm ring-1 ring-slate-200 ${MED_BORDER[a.status] ?? "border-l-slate-300"}`}>
      {/* Bloque visible: chip de hora + mascota + estado + código */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); }
        }}
        className="flex cursor-pointer items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-inset"
        onClick={() => setOpen((v) => !v)}
      >
        <div className={`flex h-14 w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl ${timeChip}`}>
          <span className="text-sm font-black leading-none">{fechaChip.hora || "—"}</span>
          <span className="mt-0.5 text-[10px] leading-none">{fechaChip.dia}</span>
          <span className="text-[10px] leading-none opacity-80">{fechaChip.corto}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-brand-blue">
              {a.petName} <span className="font-medium text-slate-500">({a.petType})</span>
            </p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>{meta.label}</span>
            {avisoFallado && (
              <span
                title="El aviso por WhatsApp no se entregó al cliente"
                className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 ring-1 ring-red-200"
              >
                ⚠ WhatsApp
              </span>
            )}
            <span className="text-xs text-slate-500">{MED_SERVICE_LABELS[a.serviceType]}{a.specialtyName ? ` · ${a.specialtyName}` : ""}</span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 truncate text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <UserRound className="h-3 w-3 shrink-0 text-slate-400" />
              {a.ownerName}
            </span>
            <a
              className="flex items-center gap-1 font-semibold text-brand-blue underline decoration-dotted"
              href={`tel:${a.ownerPhone}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="h-3 w-3 shrink-0" />
              {a.ownerPhone}
            </a>
            <span onClick={(e) => e.stopPropagation()}>
              <MiniWhatsApp phone={a.ownerPhone} message={`Hola ${a.ownerName} 🐾 le escribimos de Ariel's Clinic sobre la cita de ${a.petName} (código ${a.appointmentCode}).`} />
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
              {MED_BRANCHES.find((b) => b.value === a.branch)?.short ?? a.branch}
            </span>
            {a.ownerEmail !== "-" && <span className="hidden truncate md:inline text-slate-400">✉ {a.ownerEmail}</span>}
          </p>
        </div>
        <span className="hidden shrink-0 font-mono text-[11px] font-bold text-slate-400 sm:block">{a.appointmentCode}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="border-t border-slate-100 p-4 pt-3">
          {/* Detalle en columnas (mock): motivo / médico / orden y pago */}
          <div className="grid gap-2 sm:grid-cols-3">
            <InfoCell icon={FileText} tint="bg-[#EFF6FF] text-blue-500" label="Motivo de consulta">
              {a.petNotes && a.petNotes !== "-" ? a.petNotes : "—"}
            </InfoCell>
            <InfoCell icon={Stethoscope} tint="bg-[#FFF1E6] text-orange-500" label="Médico veterinario">
              {a.doctorName ?? "—"}
            </InfoCell>
            <InfoCell icon={NotebookText} tint="bg-[#EDEFFF] text-[#475AAB]" label="Orden / pago">
              {a.needsOrder
                ? (a.hasOrder ? "Presentará orden sellada" : "⚠️ Sin orden")
                : a.paymentNotes !== "-" ? a.paymentNotes : "—"}
            </InfoCell>
          </div>

          {/* Acciones + historial (mock: historial a la derecha de la fila) */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {nextActions.map(([s, label], i) => {
              const peligro = s === "cancelado" || s === "no_llego";
              return (
                <button
                  key={s}
                  onClick={() => (s === "cancelado" ? setConfirmCancel(true) : onStatus(a, s))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    peligro
                      ? s === "no_llego"
                        ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                        : "bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                      : i === 0
                        ? "bg-brand-blue text-white shadow-sm hover:bg-blue-700"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >{label}</button>
              );
            })}
            {(a.status === "no_llego" || a.status === "cancelado") && (
              <button
                onClick={() => onReagendar(a)}
                className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"
              >
                🔁 Reagendar como nueva cita
              </button>
            )}
            {avisoFallado && (
              <button
                onClick={() => void reenviarAviso()}
                disabled={resendBusy}
                title="Reenvía el aviso de WhatsApp de esta cita (con su estado actual)"
                className="rounded-lg bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-800 ring-1 ring-orange-200 transition hover:bg-orange-200 disabled:opacity-50"
              >
                🔁 Reenviar aviso
              </button>
            )}
            {resendMsg && <span className="w-full text-[11px] font-medium text-[#3B5178]">{resendMsg}</span>}
            {a.timeline && a.timeline.length > 0 && (
              <details className="ml-auto">
                <summary className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100">
                  <History className="h-3.5 w-3.5" /> Historial ({a.timeline.length})
                </summary>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs text-slate-400">
                  {a.timeline.map((t, i) => (
                    <li key={i}>{new Date(t.createdAt).toLocaleString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} — {MED_STATUS_META[t.status]?.label ?? WA_EVENT_META[t.status] ?? t.status} ({t.createdBy})</li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {/* Último evento del timeline, visible sin abrir nada */}
          {ultimo && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock className="h-3 w-3 shrink-0" />
              {new Date(ultimo.createdAt).toLocaleString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} — {MED_STATUS_META[ultimo.status]?.label ?? WA_EVENT_META[ultimo.status] ?? ultimo.status} ({ultimo.createdBy})
            </p>
          )}
        </div>
      )}

      {confirmCancel && (
        <ConfirmModal
          title="¿Cancelar esta cita?"
          description={`La cita ${a.appointmentCode} de ${a.petName} quedará cancelada y el cliente será avisado por WhatsApp si el servidor está disponible.`}
          confirmLabel="Sí, cancelar"
          danger
          onClose={() => setConfirmCancel(false)}
          onConfirm={() => {
            setConfirmCancel(false);
            onStatus(a, "cancelado");
          }}
        />
      )}
    </article>
  );
}

// Prefill de "Reagendar": identidad desde una cita existente; el counter
// completa fecha/hora (o especialidad para las especializadas).
interface ManApptPrefill {
  branch: MedBranch;
  serviceType: MedAppt["serviceType"];
  specialtyId: string;
  petName: string;
  petType: string;
  ownerName: string;
  ownerPhone: string;
  petNotes: string;
}

function ManualApptModal({ onClose, prefill = null }: { onClose: (reload: boolean) => void; prefill: ManApptPrefill | null }) {
  const [branch, setBranch] = useState<MedBranch>(prefill?.branch ?? "san_miguel");
  const [serviceType, setService] = useState<"general" | "rayos" | "eco" | "especializada">(prefill?.serviceType ?? "general");
  const [doctors, setDocList] = useState<MedDoctor[] | null>(null);
  const [doctorId, setDoctor] = useState("");
  const [specialties, setSpecList] = useState<MedSpecialty[] | null>(null);
  const [specialtyId, setSpecialty] = useState(prefill?.specialtyId ?? "");
  const [date, setDate] = useState("");
  const [slots, setSlotsList] = useState<MedSlot[]>([]);
  const [startMinute, setStart] = useState<number | null>(null);
  const [name, setName] = useState({
    petName: prefill?.petName ?? "",
    ownerName: prefill?.ownerName ?? "",
    ownerPhone: prefill?.ownerPhone ?? "",
    petNotes: prefill?.petNotes ?? "",
    petType: prefill?.petType ?? "Perro",
  });
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

  // dirty (para la confirmación de salida): solo lo que el USUARIO cambió
  // respecto al base (prefill de reagendar o valores vacíos de una nueva).
  const clean = prefill ?? {
    petName: "", ownerName: "", ownerPhone: "", petNotes: "", petType: "Perro",
    date: "", startMinute: null, serviceType: "general", branch: "san_miguel",
  } as const;
  const dirty =
    name.petName !== clean.petName || name.ownerName !== clean.ownerName ||
    name.ownerPhone !== clean.ownerPhone || name.petNotes !== clean.petNotes ||
    name.petType !== clean.petType || date !== "" || startMinute !== null ||
    serviceType !== clean.serviceType || branch !== clean.branch;

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
    <ModalShell title={prefill ? `🔁 Reagendar cita de ${prefill.petName}` : "＋ Cita manual (teléfono / mostrador)"} dirty={dirty} onClose={onClose}>
      {(maybeClose) => (
      <>
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
          <button onClick={() => maybeClose(false)} className="text-sm text-slate-400">Cancelar</button>
        </div>
      </>
      )}
    </ModalShell>
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
