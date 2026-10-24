import { useEffect, useRef, useState } from "react";
import { ChevronDown, PlusCircle } from "lucide-react";
import {
  addLabCatalogItem, createLabOrder, deleteLabResult, fetchLabCatalog, fetchLabList,
  getLabResultUrl, patchLabStatus, publishLabResult, uploadLabResultFile,
  type LabOrder, type LabView,
} from "./apiLab";
import { fetchDoctors, MED_BRANCHES, type MedBranch, type MedDoctor } from "../medical/api";
import { LAB_STATUS_META, labStatusMeta } from "../labStatuses";
import { ModalShell } from "./ModalShell";

// Pestaña 🧪 Laboratorio: reemplazo digital del cuaderno de exámenes externos.
// Vista por defecto "En curso" + Hoy/Semana/Búsqueda. Cross-sede: cada orden
// lleva sede_origen (quién la registró) y sede_responsable (dónde se atiende),
// así San Martín ve lo que originó hacia San Miguel y viceversa.

/** Combobox del catálogo persistente global: escribe → opciones filtradas en
 *  vivo (máx 6); si no existe, el propio counter puede AGREGARLO al catálogo
 *  (botón ➕) y queda disponible para todas las sedes desde el próximo uso. */
function SuggestField({ kind, value, onSelect, placeholder }: {
  kind: "exam" | "lab";
  value: string;
  onSelect: (v: string) => void;
  placeholder: string;
}) {
  const [items, setItems] = useState<string[] | null>(null);
  const [focused, setFocused] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addedFlash, setAddedFlash] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { exams, labs } = await fetchLabCatalog();
        if (active) setItems(kind === "exam" ? exams : labs);
      } catch {
        if (active) setItems([]); // sin catálogo: sigue siendo input libre
      }
    })();
    return () => { active = false; };
  }, [kind]);

  const query = value.trim().toLowerCase();
  const matches = items
    ? (query ? items.filter((n) => n.toLowerCase().includes(query)) : items).slice(0, 6)
    : [];
  const exactExists = (items ?? []).some((n) => n.toLowerCase() === query);
  const showAdd = focused && query.length >= 2 && !exactExists && !adding;

  async function agregar() {
    const name = value.trim();
    setAdding(true);
    try {
      const saved = await addLabCatalogItem(kind, name);
      setItems((l) => (l ? (l.includes(saved) ? l : [...l, saved].sort((a, b) => a.localeCompare(b))) : [saved]));
      onSelect(saved);
      setAddedFlash(saved);
      setTimeout(() => setAddedFlash(""), 2500);
    } catch {
      // best-effort: si falla la BD, el valor queda como texto escrito
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onSelect(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {focused && (items ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {matches.map((n) => (
            <button
              key={n}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(n)}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                value === n ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >{n}</button>
          ))}
          {showAdd && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void agregar()}
              className="rounded-full bg-green-600 px-2.5 py-0.5 text-[11px] font-bold text-white transition hover:bg-green-700"
            >
              {adding ? "Agregando…" : `➕ Agregar "${value.trim()}"`}
            </button>
          )}
        </div>
      )}
      {addedFlash && (
        <p className="text-[11px] text-green-600">
          ✓ "{addedFlash}" agregado al catálogo — disponible ya para todas las sedes
        </p>
      )}
    </div>
  );
}

function timeOfLima(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "America/Lima", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function branchShort(v: string): string {
  return MED_BRANCHES.find((b) => b.value === v)?.short ?? v;
}

export function LabTab() {
  const [vista, setVista] = useState<LabView>("active");
  const [branch, setBranch] = useState<string>("all");
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LabOrder[] | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const searchSeqRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // datos de la vista (setState siempre tras await — regla de purity)
  useEffect(() => {
    if (searchResults !== null) return;
    let active = true;
    (async () => {
      setBusy(true);
      try {
        const { orders: list } = await fetchLabList(vista, branch, "");
        if (active) {
          setOrders(list);
          setError(null);
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
  }, [vista, branch, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    },
    [],
  );

  async function setOrderStatus(o: LabOrder, status: string) {
    if (status === "cancelado" && !window.confirm(`¿Cancelar la orden ${o.orderCode} de ${o.petName}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await patchLabStatus(o.id, status);
      if (status === "resultado_listo" && !result.notified) {
        setError("La orden pasó a 'Resultado listo' pero el WhatsApp al cliente NO se envió (revisa la conexión del servidor WhatsApp). La orden ya está en el panel.");
      }
      setSearchResults(null);
      setTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setBusy(false);
    }
  }

  function onQuery(raw: string) {
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
          const { orders: results } = await fetchLabList("active", branch, raw.trim());
          if (searchSeqRef.current === mySeq) setSearchResults(results);
        } catch {
          /* conserva lo anterior */
        }
      })();
    }, 300);
  }

  const overdueCount = orders.filter((o) => o.overdue).length;

  return (
    <div>
      {/* Controles */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([["active", "En curso"], ["today", "Hoy"], ["week", "Última semana"]] as Array<[LabView, string]>).map(([v, label]) => (
          <button
            key={v}
            onClick={() => { setVista(v); setQuery(""); setSearchResults(null); }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${vista === v ? "bg-brand-blue text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-brand-blue"}`}
          >{label}{v === "active" && overdueCount > 0 ? ` (${overdueCount} ⚠)` : ""}</button>
        ))}
        <select
          value={branch}
          onChange={(e) => { setBranch(e.target.value); setSearchResults(null); }}
          className="ml-auto rounded-xl bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-slate-200 outline-none"
        >
          <option value="all">Todas las sedes</option>
          {MED_BRANCHES.map((b) => <option key={b.value} value={b.value}>{b.short}</option>)}
        </select>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Buscar código/teléfono/mascota/historia…"
          className="w-56 rounded-xl bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-slate-200 outline-none"
        />
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          <PlusCircle className="h-4 w-4" /> ＋ Nueva orden
        </button>
      </div>

      {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {searchResults !== null && (
        <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="mb-2 text-xs text-slate-500">Resultados de búsqueda ({searchResults.length})</p>
          {searchResults.length === 0 && <p className="text-sm text-slate-400">Sin resultados.</p>}
          {searchResults.map((o) => <LabCard key={o.id} o={o} onStatus={setOrderStatus} onChanged={() => { setSearchResults(null); setQuery(""); setTick((t) => t + 1); }} />)}
        </div>
      )}

      {/* Lista de órdenes */}
      {searchResults === null && (
        <div className="flex flex-col gap-3">
          {busy && orders.length === 0 && <p className="text-center text-sm text-slate-400">Cargando…</p>}
          {!busy && orders.length === 0 && (
            <p className="rounded-2xl bg-white/70 p-6 text-center text-sm text-slate-400">
              {vista === "active" ? "No hay exámenes en curso" : "Sin órdenes en este rango"}
              {branch !== "all" ? ` — ${branchShort(branch)}` : ""}
            </p>
          )}
          {orders.map((o) => <LabCard key={o.id} o={o} onStatus={setOrderStatus} onChanged={() => setTick((t) => t + 1)} />)}
        </div>
      )}

      {newOpen && <NewLabOrderModal onClose={(reload) => { setNewOpen(false); if (reload) setTick((t) => t + 1); }} />}
    </div>
  );
}

// Borde de color por estado (mismo semáforo del panel).
const LAB_BORDER: Record<string, string> = {
  recibida: "border-l-blue-500",
  en_laboratorio: "border-l-amber-400",
  resultado_listo: "border-l-green-500",
  entregada: "border-l-slate-400",
  cancelado: "border-l-red-500",
};

function LabCard({ o, onStatus, onChanged }: {
  o: LabOrder;
  onStatus: (o: LabOrder, status: string) => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [resultBusy, setResultBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const resultFileRef = useRef<HTMLInputElement | null>(null);
  const meta = labStatusMeta(o.status);

  async function publicarResultado(file: File | null) {
    if (!file) return;
    setResultBusy(true);
    setResultMsg(null);
    try {
      const { path } = await uploadLabResultFile(o.id, file, o.orderCode);
      await publishLabResult({
        id: o.id,
        path,
        name: file.name,
        mime: file.type,
        size: file.size,
      });
      setResultMsg("✓ Resultado publicado — el cliente ya puede verlo en /estado con su código.");
      onChanged();
    } catch (err) {
      setResultMsg(err instanceof Error ? err.message : "No se pudo publicar el resultado.");
    } finally {
      setResultBusy(false);
      if (resultFileRef.current) resultFileRef.current.value = "";
    }
  }

  async function verResultado() {
    setResultBusy(true);
    setResultMsg(null);
    try {
      const { url } = await getLabResultUrl(o.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setResultMsg(err instanceof Error ? err.message : "No se pudo abrir el resultado.");
    } finally {
      setResultBusy(false);
    }
  }

  async function borrarResultado() {
    if (!window.confirm(`¿Borrar el resultado publicado de ${o.orderCode}? El cliente dejará de verlo.`)) return;
    setResultBusy(true);
    setResultMsg(null);
    try {
      await deleteLabResult(o.id);
      setResultMsg("✓ Resultado borrado.");
      onChanged();
    } catch (err) {
      setResultMsg(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setResultBusy(false);
    }
  }

  const nextActions: Array<[string, string]> = [];
  if (o.status === "recibida") nextActions.push(["en_laboratorio", "🔬 Enviar al laboratorio"], ["cancelado", "❌ Cancelar"]);
  else if (o.status === "en_laboratorio") nextActions.push(["resultado_listo", "✅ Resultado listo"], ["cancelado", "❌ Cancelar"]);
  else if (o.status === "resultado_listo") nextActions.push(["entregada", "📋 Entregada / leída"]);

  const crossSede = o.sedeOrigen !== o.sedeResponsable;

  return (
    <article className={`rounded-2xl border-l-4 bg-white shadow-sm ring-1 ${LAB_BORDER[o.status] ?? "border-l-slate-300"} ${o.overdue ? "ring-2 ring-amber-400" : "ring-slate-200"}`}>
      <div className="flex cursor-pointer items-center justify-between gap-3 p-4" onClick={() => setOpen((v) => !v)}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-800">
              {o.petName} ({o.ownerName}) · {o.examType} · {o.labName}
              {!crossSede && <span className="font-normal text-slate-400"> · {branchShort(o.sedeResponsable)}</span>}
            </p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>{meta.label}</span>
            {o.overdue && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">⚠ &gt;7 días en lab</span>}
            {crossSede && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                📍 Origen {branchShort(o.sedeOrigen)} → Responsable {branchShort(o.sedeResponsable)}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{o.orderCode}</p>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="border-t border-slate-100 p-4 pt-3">
          <p className="text-sm text-slate-600">👤 {o.ownerName} · 📞 {o.ownerPhone}</p>
          <p className="text-sm text-slate-600">🏠 Historia: {o.historyCode}{o.doctorName !== "-" ? ` · 🩺 Solicitó: ${o.doctorName}` : ""}</p>
          <p className="text-sm text-slate-500">🧪 {o.labName}</p>
          {o.paidNotes !== "-" && <p className="text-xs text-slate-500">💳 {o.paidNotes}</p>}
          {o.notes !== "-" && <p className="text-xs text-slate-500">📝 {o.notes}</p>}
          <p className="text-xs text-slate-400">Registrada: {timeOfLima(o.createdAt)} · por {o.createdBy}</p>

          {nextActions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {nextActions.map(([s, label]) => (
                <button
                  key={s}
                  onClick={() => onStatus(o, s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${s === "cancelado" ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >{label}</button>
              ))}
            </div>
          )}

          {/* Resultado publicado al cliente (PDF/foto, ventana de 20 días) */}
          {o.status === "resultado_listo" && (
            <div className="mt-3 rounded-xl bg-blue-50/60 p-3 ring-1 ring-blue-100">
              <p className="text-xs font-semibold text-slate-700">📄 Resultado del examen</p>
              {!o.resultPath ? (
                <>
                  <p className="mt-1 text-xs text-slate-500">
                    Sube el PDF o la foto del resultado: el cliente lo descarga gratis desde /estado con su código (se borra solo a los 20 días).
                  </p>
                  <input
                    ref={resultFileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={resultBusy}
                    onChange={(e) => void publicarResultado(e.target.files?.[0] ?? null)}
                    className="mt-2 w-full text-xs text-slate-600 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-blue file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-700 disabled:opacity-50"
                  />
                </>
              ) : (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-green-700">
                    ✓ Publicado {o.resultPublishedAt ? timeOfLima(o.resultPublishedAt) : ""}
                  </span>
                  <button onClick={() => void verResultado()} disabled={resultBusy} className="rounded-lg bg-brand-blue px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">👁 Ver</button>
                  <label className="cursor-pointer rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                    🔁 Reemplazar
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={(e) => void publicarResultado(e.target.files?.[0] ?? null)} />
                  </label>
                  <button onClick={() => void borrarResultado()} disabled={resultBusy} className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">🗑 Borrar</button>
                </div>
              )}
              {resultMsg && <p className="mt-1.5 text-xs text-slate-600">{resultMsg}</p>}
            </div>
          )}

          {o.status === "entregada" && o.resultPath && (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              📄 Resultado publicado {o.resultPublishedAt ? `(${timeOfLima(o.resultPublishedAt)})` : ""}
              <button onClick={() => void verResultado()} disabled={resultBusy} className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-200">👁 Ver</button>
            </div>
          )}

          {o.timeline && o.timeline.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500">Historial ({o.timeline.length})</summary>
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-slate-400">
                {o.timeline.map((t, i) => (
                  <li key={i}>{timeOfLima(t.createdAt)} — {LAB_STATUS_META[t.status]?.label ?? t.status} ({t.createdBy})</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </article>
  );
}

function NewLabOrderModal({ onClose }: { onClose: (reload: boolean) => void }) {
  const [sedeOrigen, setOrigen] = useState<MedBranch>("san_miguel");
  const [sedeResponsable, setResponsable] = useState<MedBranch>("san_miguel");
  const [form, setForm] = useState({
    labName: "", examType: "", petName: "", petType: "Perro",
    historyCode: "", doctorName: "-", ownerName: "", ownerPhone: "", paidNotes: "", notes: "",
  });
  const [doctors, setDoctors] = useState<MedDoctor[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string; notified: boolean } | null>(null);

  useEffect(() => {
    // Médico solicitante: doctores ACTIVOS de la sede ORIGEN (quién genera
    // la orden), no de la responsable.
    let active = true;
    (async () => {
      try {
        const generales = await fetchDoctors(sedeOrigen, "general");
        const especialistas = await fetchDoctors(sedeOrigen, "especialista");
        if (active) setDoctors([...(especialistas ?? []), ...(generales ?? [])]);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Error al cargar doctores");
      }
    })();
    return () => { active = false; };
  }, [sedeOrigen]);

  async function guardar() {
    setBusy(true);
    setError(null);
    try {
      const result = await createLabOrder({
        sedeOrigen,
        sedeResponsable,
        labName: form.labName.trim(),
        examType: form.examType.trim(),
        petName: form.petName.trim(),
        petType: form.petType,
        historyCode: form.historyCode.trim() || "-",
        doctorName: form.doctorName,
        ownerName: form.ownerName.trim(),
        ownerPhone: form.ownerPhone.trim(),
        paidNotes: form.paidNotes.trim() || "-",
        notes: form.notes.trim() || "-",
      });
      setCreated({ code: result.orderCode, notified: result.notified });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear");
    } finally {
      setBusy(false);
    }
  }

  const canSave =
    form.labName.trim().length >= 1 &&
    form.examType.trim().length >= 2 &&
    form.petName.trim().length >= 2 &&
    form.ownerName.trim().length >= 3 &&
    form.ownerPhone.trim().length >= 6;

  // dirty: cualquier campo tocado por el USUARIO (las cargas automáticas no cuentan)
  const dirty =
    form.labName.trim() !== "" || form.examType.trim() !== "" ||
    form.petName.trim() !== "" || form.ownerName.trim() !== "" ||
    form.ownerPhone.trim() !== "" ||
    form.historyCode.trim() !== "" || form.paidNotes.trim() !== "" ||
    form.notes.trim() !== "" || form.petType !== "Perro" || form.doctorName !== "-" ||
    sedeOrigen !== "san_miguel" || sedeResponsable !== "san_miguel";

  return (
    <ModalShell title="🧪 Nueva orden de laboratorio" dirty={dirty && !created} onClose={onClose}>
      {(maybeClose) =>
      created ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-3xl">✅</p>
            <p className="text-sm text-slate-600">Orden registrada y el cliente ya tiene su código:</p>
            <p className="rounded-xl bg-blue-50 px-4 py-2 font-mono text-lg font-bold tracking-wider text-brand-blue">{created.code}</p>
            {!created.notified && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                La orden quedó registrada, pero el WhatsApp al cliente NO se envió (servidor de WhatsApp no disponible ahora).
              </p>
            )}
            <button onClick={() => onClose(true)} className="rounded-lg bg-brand-blue py-2 text-sm font-semibold text-white">Listo</button>
          </div>
        ) : (
          <>
            {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Row01 label="Sede que registra">
                  <select value={sedeOrigen} onChange={(e) => setOrigen(e.target.value as MedBranch)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                    {MED_BRANCHES.map((b) => <option key={b.value} value={b.value}>{b.short}</option>)}
                  </select>
                </Row01>
                <Row01 label="Sede responsable">
                  <select value={sedeResponsable} onChange={(e) => setResponsable(e.target.value as MedBranch)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                    {MED_BRANCHES.map((b) => <option key={b.value} value={b.value}>{b.short}</option>)}
                  </select>
                </Row01>
              </div>
              {sedeOrigen !== sedeResponsable && (
                <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                  Cross-sede: la orden se verá tanto en {branchShort(sedeOrigen)} (origen) como en {branchShort(sedeResponsable)} (responsable).
                </p>
              )}
              <SuggestField
                kind="lab"
                value={form.labName}
                onSelect={(v) => setForm((f) => ({ ...f, labName: v }))}
                placeholder="Laboratorio externo (escribe para filtrar o agrega uno nuevo)"
              />
              <SuggestField
                kind="exam"
                value={form.examType}
                onSelect={(v) => setForm((f) => ({ ...f, examType: v }))}
                placeholder="Tipo de examen (escribe para filtrar o agrega uno nuevo)"
              />
              <div className="flex gap-2">
                <input value={form.petName} onChange={(e) => setForm((f) => ({ ...f, petName: e.target.value }))} placeholder="Mascota (nombre)" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <div className="flex gap-1">
                  {["Perro", "Gato"].map((t) => (
                    <button key={t} onClick={() => setForm((f) => ({ ...f, petType: t }))} className={`rounded-lg px-2.5 text-sm font-semibold ${form.petType === t ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-700"}`}>{t === "Perro" ? "🐶" : "🐱"}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input value={form.historyCode} onChange={(e) => setForm((f) => ({ ...f, historyCode: e.target.value }))} placeholder="# Historia (VetPraxis, opcional)" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <select
                  value={form.doctorName}
                  onChange={(e) => setForm((f) => ({ ...f, doctorName: e.target.value }))}
                  className="w-40 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                >
                  <option value="-">Sin médico</option>
                  {(doctors ?? []).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  {form.doctorName !== "-" && !(doctors ?? []).some((d) => d.name === form.doctorName) && (
                    <option value={form.doctorName}>{form.doctorName}</option>
                  )}
                </select>
              </div>
              <input value={form.ownerName} onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))} placeholder="Nombre del dueño" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input
                value={form.ownerPhone}
                onChange={(e) => setForm((f) => ({ ...f, ownerPhone: e.target.value }))}
                placeholder="Celular del dueño (WhatsApp) — obligatorio"
                inputMode="tel"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input value={form.paidNotes} onChange={(e) => setForm((f) => ({ ...f, paidNotes: e.target.value }))} placeholder="Monto / pago (opcional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notas (opcional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button
                onClick={() => void guardar()}
                disabled={busy || !canSave}
                className="rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Registrando…" : "Registrar orden"}
              </button>
              <button onClick={() => maybeClose(false)} className="text-sm text-slate-400">Cancelar</button>
            </div>
          </>
          )
      }
    </ModalShell>
  );
}

function Row01({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
