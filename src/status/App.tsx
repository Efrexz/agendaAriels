import { useCallback, useEffect, useState } from "react";
import { HeartHandshake, PawPrint, Search } from "lucide-react";
import { fetchTracking, isLabTracking } from "./api";
import type { TrackingBooking, TrackingLab, TrackingResult } from "./types";
import { SLOT_LABELS, STATUS_META, STATUS_ORDER, statusMeta } from "../statuses";
import { LAB_STATUS_ORDER, labStatusMeta } from "../labStatuses";

// ─────────────────────────────────────────────────────────────
// Página del cliente: ingresa el código VA-XXXXX (reserva de
// grooming) o LAB-XXXXX (examen de laboratorio) y ve en tiempo
// real cómo va. Solo consume las API públicas de seguimiento
// (campos seguros: jamás dirección, teléfonos ni datos del dueño).
// ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d)).toLocaleDateString("es-PE", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function App() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [pollTick, setPollTick] = useState(0);
  const trackedCode = result
    ? (isLabTracking(result) ? result.orderCode : result.bookingCode)
    : null;

  const lookup = useCallback(async (raw: string) => {
    // Frontera async: al invocar lookup desde un effect, ningún setState
    // ocurre sincrónicamente en la ejecución del effect (react-hooks).
    await Promise.resolve();
    const clean = raw.trim().toUpperCase();
    setCode(clean);
    setLoading(true);
    try {
      const found = await fetchTracking(clean);
      setResult(found);
      setError(null);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "No pudimos conectarnos.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Code en la URL (p.ej. /estado?code=VA-XXXXX): consulta automática.
  // Patrón IIFE: todos los setState ocurren tras un await.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("code");
    if (!initial) return;
    let active = true;
    (async () => {
      const clean = initial.trim().toUpperCase();
      await Promise.resolve();
      if (!active) return;
      setCode(clean);
      setLoading(true);
      try {
        const found = await fetchTracking(clean);
        if (active) {
          setResult(found);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setResult(null);
          setError(err instanceof Error ? err.message : "No pudimos conectarnos.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
   }, []); // el efecto de URL solo corre al montar

  // Auto-refresco cada 30 s: el setState del tick ocurre en el callback
  // del interval (no directamente en el effect) y la consulta tras await.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && trackedCode) setPollTick((t) => t + 1);
    }, 30_000);
    return () => clearInterval(id);
  }, [trackedCode]);
  useEffect(() => {
    if (pollTick === 0 || !trackedCode) return;
    let active = true;
    (async () => {
      setPolling(true);
      try {
        const fresh = await fetchTracking(trackedCode);
        if (active) {
          setResult(fresh);
          setError(null);
        }
      } catch {
        /* silencioso: el próximo ciclo reintenta */
      } finally {
        if (active) setPolling(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [pollTick, trackedCode]);

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-8">
      <header className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue text-white shadow-lg shadow-blue-600/20">
          <PawPrint className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-900">¿Cómo va tu mascota? 🐾</h1>
        <p className="text-sm text-slate-500">
          Ingresa tu código: <b>VA-</b> reserva de grooming · <b>LAB-</b> examen de laboratorio.
          Veterinaria Ariel.
        </p>
      </header>

      {/* Búsqueda por código */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(code);
        }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
          <Search className="ml-2 h-5 w-5 text-slate-400" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="VA-XXXXX · LAB-XXXXX"
            maxLength={8}
            autoComplete="off"
            className="w-full bg-transparent py-2 font-mono text-lg tracking-widest uppercase outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-300"
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "…" : "Ver"}
          </button>
        </div>
        {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>

      {result && (isLabTracking(result)
        ? <LabView order={result} lookup={lookup} polling={polling} />
        : <BookingView booking={result} lookup={lookup} polling={polling} />)}
    </div>
  );
}

function BookingView({
  booking,
  lookup,
  polling,
}: {
  booking: TrackingBooking;
  lookup: (raw: string) => Promise<void>;
  polling: boolean;
}) {
  const petNames = booking.pets.map((p) => p.name).join(", ");
  const current = statusMeta(booking.status);

  // Auto-refresco cada 30 s vía tick: los setStates ocurren en el
  // callback del interval (no directamente en el effect) y la
  // consulta se hace tras await.
  return (
    <main>
      {/* Estado actual */}
      <section className="rounded-3xl bg-white p-6 text-center shadow-lg shadow-slate-900/5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Estado de {petNames} {polling && <span className="animate-pulse text-brand-blue">· actualizando…</span>}
        </p>
        <div className="my-3 text-5xl">{current.emoji}</div>
        <h2 className="font-display text-2xl font-bold text-brand-blue">{current.label}</h2>
        <p className="mt-3 text-sm text-slate-500">
          🗓 {formatDate(booking.serviceDate)} · {SLOT_LABELS[booking.timeSlot]}
        </p>
        <p className="text-sm text-slate-500">🏥 Sede {booking.branchLabel.replace("Sede ", "")}</p>
        <p className="mt-2 font-mono text-xs text-slate-400">Código {booking.bookingCode}</p>
      </section>

      {/* Línea de proceso completo */}
      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">El proceso paso a paso</h3>
        <ProcessStep status="en_camino_recojo" active={booking.status} timeline={booking.timeline} />
        <ProcessStep status="recibido" active={booking.status} timeline={booking.timeline} />
        <ProcessStep status="en_bano" active={booking.status} timeline={booking.timeline} />
        <ProcessStep status="en_secado" active={booking.status} timeline={booking.timeline} />
        <ProcessStep status="en_corte" active={booking.status} timeline={booking.timeline} />
        <ProcessStep status="listo" active={booking.status} timeline={booking.timeline} />
        <ProcessStep status="en_camino_entrega" active={booking.status} timeline={booking.timeline} />
        <ProcessStep status="entregado" active={booking.status} timeline={booking.timeline} last />
      </section>

      <footer className="mt-8 flex flex-col items-center gap-1 text-center text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <HeartHandshake className="h-3.5 w-3.5" /> Esta página se actualiza sola. Para volver, abre este link:
        </span>
        <button
          onClick={() => void lookup(booking.bookingCode)}
          className="rounded bg-slate-200/70 px-2 py-1 font-mono text-[11px] text-slate-500"
        >
          {window.location.origin}/estado?code={booking.bookingCode}
        </button>
      </footer>
    </main>
  );
}

function LabView({
  order,
  lookup,
  polling,
}: {
  order: TrackingLab;
  lookup: (raw: string) => Promise<void>;
  polling: boolean;
}) {
  const current = labStatusMeta(order.status);
  return (
    <main>
      {/* Estado actual del examen */}
      <section className="rounded-3xl bg-white p-6 text-center shadow-lg shadow-slate-900/5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Examen de {order.petName} {polling && <span className="animate-pulse text-brand-blue">· actualizando…</span>}
        </p>
        <div className="my-3 text-5xl">{current.emoji}</div>
        <h2 className="font-display text-2xl font-bold text-brand-blue">{current.label}</h2>
        <p className="mt-3 text-sm text-slate-500">🧪 {order.examType}</p>
        <p className="text-sm text-slate-500">🏥 Entrega: sede {order.sedeLabel.replace("Sede ", "")}</p>
        <p className="mt-2 font-mono text-xs text-slate-400">Código {order.orderCode}</p>
      </section>

      {/* Línea del proceso del examen */}
      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">El proceso del examen paso a paso</h3>
        <LabStep status="recibida" active={order.status} timeline={order.timeline} />
        <LabStep status="en_laboratorio" active={order.status} timeline={order.timeline} />
        <LabStep status="resultado_listo" active={order.status} timeline={order.timeline} />
        <LabStep status="entregada" active={order.status} timeline={order.timeline} last />
      </section>

      <footer className="mt-8 flex flex-col items-center gap-1 text-center text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <HeartHandshake className="h-3.5 w-3.5" /> Esta página se actualiza sola. El resultado se entrega impreso en la sede.
        </span>
        <button
          onClick={() => void lookup(order.orderCode)}
          className="rounded bg-slate-200/70 px-2 py-1 font-mono text-[11px] text-slate-500"
        >
          {window.location.origin}/estado?code={order.orderCode}
        </button>
      </footer>
    </main>
  );
}

function LabStep({
  status,
  active,
  timeline,
  last,
}: {
  status: string;
  active: string;
  timeline: Array<{ status: string; createdAt: string }>;
  last?: boolean;
}) {
  const meta = labStatusMeta(status);
  const event = [...timeline].reverse().find((t) => t.status === status);
  const index = LAB_STATUS_ORDER.indexOf(status);
  const activeIndex = LAB_STATUS_ORDER.indexOf(active);
  const isCurrent = index === activeIndex && status === active;

  let state: "done" | "current" | "pending" = "pending";
  if (isCurrent) state = "current";
  else if (event !== undefined && index < activeIndex) state = "done";
  if (active === "cancelado") state = event ? "done" : "pending";

  return (
    <div className="flex gap-3">
      <div className="flex h-auto flex-col items-center">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
            state === "done"
              ? "bg-green-500 text-white"
              : state === "current"
                ? "bg-brand-blue text-white ring-4 ring-blue-600/20"
                : "bg-slate-100 text-slate-400"
          }`}
        >
          {state === "done" ? "✓" : meta.emoji}
        </div>
        {!last && <div className={`my-1 w-0.5 flex-1 ${state !== "pending" ? "bg-green-400" : "bg-slate-200"}`} />}
      </div>
      <div className={last ? "" : "pb-4"}>
        <p className={`text-sm font-semibold ${state === "pending" ? "text-slate-400" : "text-slate-800"}`}>
          {meta.label}
        </p>
        {event && <p className="text-xs text-slate-400">{timeOf(event.createdAt)}</p>}
        {state === "current" && <p className="text-xs font-medium text-brand-blue">Ahora mismo…</p>}
      </div>
    </div>
  );
}

function ProcessStep({
  status,
  active,
  timeline,
  last,
}: {
  status: string;
  active: string;
  timeline: Array<{ status: string; createdAt: string }>;
  last?: boolean;
}) {
  const meta = STATUS_META[status];
  const event = [...timeline].reverse().find((t) => t.status === status);
  const index = STATUS_ORDER.indexOf(status as (typeof STATUS_ORDER)[number]);
  const activeIndex = STATUS_ORDER.indexOf(active as (typeof STATUS_ORDER)[number]);
  const isCurrent = index === activeIndex && status === active;

  let state: "done" | "current" | "pending" = "pending";
  if (isCurrent) state = "current";
  else if (event !== undefined && index < activeIndex) state = "done";
  if (active === "cancelado") state = event ? "done" : "pending";

  return (
    <div className="flex gap-3">
      <div className="flex h-auto flex-col items-center">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
            state === "done"
              ? "bg-green-500 text-white"
              : state === "current"
                ? "bg-brand-blue text-white ring-4 ring-blue-600/20"
                : "bg-slate-100 text-slate-400"
          }`}
        >
          {state === "done" ? "✓" : meta.emoji}
        </div>
        {!last && <div className={`my-1 w-0.5 flex-1 ${state !== "pending" ? "bg-green-400" : "bg-slate-200"}`} />}
      </div>
      <div className={last ? "" : "pb-4"}>
        <p className={`text-sm font-semibold ${state === "pending" ? "text-slate-400" : "text-slate-800"}`}>
          {meta.label}
        </p>
        {event && <p className="text-xs text-slate-400">{timeOf(event.createdAt)}</p>}
        {state === "current" && <p className="text-xs font-medium text-brand-blue">Ahora mismo…</p>}
      </div>
    </div>
  );
}
