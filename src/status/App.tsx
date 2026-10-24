import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  FlaskConical,
  HeartHandshake,
  Info,
  MapPin,
  PawPrint,
  Search,
} from "lucide-react";
import { fetchTracking, isLabTracking } from "./api";
import type { TrackingBooking, TrackingLab, TrackingResult } from "./types";
import { SLOT_LABELS, STATUS_META, STATUS_ORDER, statusMeta } from "../statuses";
import { LAB_STATUS_ORDER, labStatusMeta } from "../labStatuses";
import { MASCOT_PLACEHOLDER, iconFor, mascotFor } from "./mascots";
import type { LucideIcon } from "lucide-react";

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

type StepState = "done" | "current" | "pending";

// ─────────────────────────────────────────────────────────────
// Mascota por estado: webp final con cascada de fallback
// (archivo definitivo → imagen genérica → emoji). El crossfade
// y la "respiración" se desactivan con prefers-reduced-motion.
// ─────────────────────────────────────────────────────────────
function Mascot({
  kind,
  status,
  emoji,
  reduceMotion,
  className = "",
}: {
  kind: "va" | "lab";
  status: string;
  emoji: string;
  reduceMotion: boolean;
  className?: string;
}) {
  // Estado nuevo (llega por polling cada 30 s): el padre remonta con
  // key={status} → la cascada de fallback y la entrada reinician solas.
  const [src, setSrc] = useState(() => mascotFor(kind, status));
  const [emojiFallback, setEmojiFallback] = useState(false);

  const handleError = () => {
    if (src !== MASCOT_PLACEHOLDER) setSrc(MASCOT_PLACEHOLDER);
    else setEmojiFallback(true);
  };

  return (
    <div className={`relative h-full w-full select-none ${className}`}>
      {/* Cascada: webp definitivo → genérica → emoji */}
      {emojiFallback ? (
        <div className="flex h-full w-full items-center justify-center text-6xl" role="img" aria-label={emoji}>
          {emoji}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={src}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="h-full w-full"
          >
            <img
              src={src}
              alt={`Mascota Ariels Clinic — ${emoji}`}
              loading="eager"
              onError={handleError}
              draggable={false}
              className={`h-full w-full object-contain ${reduceMotion ? "" : "mascot-breathe"}`}
            />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// Fila de la línea de proceso (compartida por grooming y laboratorio).
// Estilo referencia: done = verde con check, current = anillo blanco +
// punto azul con pulso, pending = icono line-art gris.
function TimelineRow({
  label,
  icon: Icon,
  state,
  time,
  last,
  reduceMotion,
}: {
  label: string;
  icon: LucideIcon;
  state: StepState;
  time?: string;
  last?: boolean;
  reduceMotion: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          {state === "current" && !reduceMotion && (
            <span aria-hidden className="pulse-ring absolute inset-0 rounded-full bg-blue-500" />
          )}
          {state === "current" ? (
            // Anillo blanco + disco azul + punto blanco (nodito "target")
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 ring-1 ring-blue-200">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue">
                <span className="h-2.5 w-2.5 rounded-full bg-white" />
              </div>
            </div>
          ) : (
            <div
              className={`relative flex h-9 w-9 items-center justify-center rounded-full font-bold transition ${
                state === "done" ? "bg-green-500 text-white" : "bg-slate-100 text-slate-400"
              }`}
            >
              {state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" strokeWidth={2.2} />}
            </div>
          )}
        </div>
        {!last && (
          <div
            aria-hidden
            className={`my-1 w-1 flex-1 rounded-full ${
              state === "done"
                ? "bg-green-400"
                : state === "current"
                  ? "bg-gradient-to-b from-green-400 to-slate-200"
                  : "bg-slate-200"
            }`}
          />
        )}
      </div>
      <div className={last ? "pt-2" : "pt-2 pb-5"}>
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-semibold ${state === "pending" ? "text-slate-400" : "text-slate-800"}`}>
            {label}
          </p>
          {state === "current" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-blue">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full bg-brand-blue ${reduceMotion ? "" : "dot-pulse"}`}
              />
              Ahora
            </span>
          )}
        </div>
        {time && <p className="mt-0.5 text-xs text-slate-400">{time}</p>}
      </div>
    </div>
  );
}

// Fila de detalle del card de estado (estilo referencia: icono en cuadro
// de color + label pequeño + valor bold).
function DetailRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-left">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-bold leading-snug text-slate-800">{children}</p>
      </div>
    </div>
  );
}

// Card de estado actual (estilo referencia): chip de contexto, mascota
// sobre círculo suave, pastilla del estado actual con color del catálogo
// y detalles con iconos.
function StatusCard({
  chip,
  kind,
  status,
  label,
  badge,
  emoji,
  polling,
  reduceMotion,
  stateIcon: StatusIcon,
  details,
}: {
  chip: string;
  kind: "va" | "lab";
  status: string;
  label: string;
  badge: string;
  emoji: string;
  polling: boolean;
  reduceMotion: boolean;
  stateIcon: LucideIcon;
  details: Array<{ icon: LucideIcon; label: string; value: React.ReactNode }>;
}) {
  return (
    <section className="relative rounded-3xl bg-white p-6 pt-7 text-center shadow-lg shadow-slate-900/5 ring-1 ring-slate-100">
      {/* Chip de contexto + indicador de actualización */}
      <div className="absolute inset-x-5 top-5 flex items-center justify-between gap-2">
        <span className="truncate rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-blue">
          {chip}
        </span>
        {polling && (
          <span className={`shrink-0 text-[10px] font-semibold text-slate-400 ${reduceMotion ? "" : "animate-pulse"}`}>
            actualizando…
          </span>
        )}
      </div>

      {/* Mascota sobre círculo suave (backdrop) */}
      <div className="relative mx-auto mt-4 h-44 w-44 rounded-full bg-blue-50/80 sm:h-48 sm:w-48">
        <Mascot key={`${kind}-${status}`} kind={kind} status={status} emoji={emoji} reduceMotion={reduceMotion} className="absolute inset-1" />
        <PawPrint aria-hidden className="absolute -left-6 top-3 h-6 w-6 rotate-[-20deg] text-blue-100" strokeWidth={2.5} />
        <PawPrint aria-hidden className="absolute -right-5 bottom-4 h-5 w-5 rotate-[25deg] text-blue-100" strokeWidth={2.5} />
      </div>

      {/* Estado actual como pastilla de color */}
      <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 ${badge}`}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70">
          <StatusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        <span className="text-sm font-bold uppercase tracking-wide">{label}</span>
      </div>

      {/* Detalles */}
      <div className="mx-auto mt-6 flex max-w-xs flex-col gap-3">
        {details.map((d) => (
          <DetailRow key={d.label} icon={d.icon} label={d.label}>
            {d.value}
          </DetailRow>
        ))}
      </div>
    </section>
  );
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
    <div className="relative mx-auto min-h-screen max-w-md px-4 py-8">
      {/* Fondo decorativo (estilo referencia): blobs difusos + huellitas tenues */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-28 -top-24 h-80 w-80 rounded-full bg-blue-200/50 blur-3xl" />
        <div className="absolute -right-28 top-16 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-blue-100/60 blur-3xl" />
        <PawPrint className="absolute right-6 top-6 h-8 w-8 rotate-[25deg] text-orange-300/30" strokeWidth={2.5} />
        <PawPrint className="absolute right-16 top-24 h-6 w-6 rotate-[45deg] text-orange-300/25" strokeWidth={2.5} />
        <PawPrint className="absolute left-2 bottom-32 h-8 w-8 rotate-[-20deg] text-blue-300/30" strokeWidth={2.5} />
        <PawPrint className="absolute left-16 bottom-24 h-5 w-5 rotate-[-45deg] text-blue-300/25" strokeWidth={2.5} />
        <PawPrint className="absolute right-4 bottom-40 h-7 w-7 rotate-[10deg] text-blue-300/20" strokeWidth={2.5} />
      </div>

      <div className="relative z-10">
        {/* Encabezado en línea (estilo referencia): logo + marca naranja */}
        <header className="mb-6 flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blue text-white shadow-md shadow-blue-600/20">
            <PawPrint className="h-6 w-6" />
          </div>
          <span className="font-hand text-2xl leading-none text-brand-orange">Ariel&apos;s Clinic</span>
        </header>
        <h1 className="font-display text-3xl font-bold leading-tight text-slate-900">¿Cómo va tu mascota? 🐾</h1>
        <p className="mt-2 text-sm text-slate-500">
          Consulta el estado de su baño, corte o examen de laboratorio. Ingresa tu código: <b>VA-</b> grooming ·{" "}
          <b>LAB-</b> laboratorio.
        </p>

        {/* Búsqueda por código */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(code);
          }}
          className="mb-6 mt-5"
        >
          <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
            <Search className="ml-2 h-5 w-5 text-slate-400" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={9}
              placeholder="VA-XXXXX · LAB-XXXXX"
              autoComplete="off"
              className="w-full bg-transparent py-2 font-mono text-lg tracking-widest uppercase outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-300"
            />
            <button
              type="submit"
              disabled={loading}
              className="ml-auto shrink-0 rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
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
  const reduceMotion = useReducedMotion() ?? false;

  // Auto-refresco cada 30 s vía tick: los setStates ocurren en el
  // callback del interval (no directamente en el effect) y la
  // consulta se hace tras await.
  return (
    <main>
      {/* Estado actual: chip + mascota sobre círculo + pastilla del estado */}
      <StatusCard
        chip={`Viaje de ${petNames}`}
        kind="va"
        status={booking.status}
        label={current.label}
        badge={current.badge}
        emoji={current.emoji}
        polling={polling}
        reduceMotion={reduceMotion}
        stateIcon={iconFor("va", booking.status)}
        details={[
          { icon: CalendarDays, label: "Fecha y hora", value: `${formatDate(booking.serviceDate)} · ${SLOT_LABELS[booking.timeSlot]}` },
          { icon: MapPin, label: "Sede", value: booking.branchLabel.replace("Sede ", "") },
          { icon: ClipboardList, label: "Código", value: booking.bookingCode },
        ]}
      />

      {/* Seguimiento paso a paso */}
      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
            <Clock className="h-5 w-5" />
          </div>
          <h3 className="font-display text-lg font-semibold text-slate-900">Seguimiento del proceso</h3>
        </div>
        <ProcessStep status="en_camino_recojo" active={booking.status} timeline={booking.timeline} reduceMotion={reduceMotion} />
        <ProcessStep status="recibido" active={booking.status} timeline={booking.timeline} reduceMotion={reduceMotion} />
        <ProcessStep status="en_bano" active={booking.status} timeline={booking.timeline} reduceMotion={reduceMotion} />
        <ProcessStep status="en_secado" active={booking.status} timeline={booking.timeline} reduceMotion={reduceMotion} />
        <ProcessStep status="en_corte" active={booking.status} timeline={booking.timeline} reduceMotion={reduceMotion} />
        <ProcessStep status="listo" active={booking.status} timeline={booking.timeline} reduceMotion={reduceMotion} />
        <ProcessStep status="en_camino_entrega" active={booking.status} timeline={booking.timeline} reduceMotion={reduceMotion} />
        <ProcessStep status="entregado" active={booking.status} timeline={booking.timeline} reduceMotion={reduceMotion} last />
      </section>

      <footer className="mt-8 rounded-2xl bg-blue-50/60 px-4 py-3 text-center text-xs text-slate-500">
        <p className="flex items-center justify-center gap-1.5">
          <HeartHandshake className="h-3.5 w-3.5 shrink-0 text-brand-blue" />
          Esta página se actualiza sola. Para volver, abre este link:
        </p>
        <button
          onClick={() => void lookup(booking.bookingCode)}
          className="mt-1 rounded bg-white/80 px-2 py-1 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200"
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
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <main>
      {/* Estado actual del examen: chip + mascota + pastilla */}
      <StatusCard
        chip={`Examen de ${order.petName}`}
        kind="lab"
        status={order.status}
        label={current.label}
        badge={current.badge}
        emoji={current.emoji}
        polling={polling}
        reduceMotion={reduceMotion}
        stateIcon={iconFor("lab", order.status)}
        details={[
          { icon: FlaskConical, label: "Examen", value: order.examType },
          { icon: MapPin, label: "Entrega", value: order.sedeLabel.replace("Sede ", "") },
          { icon: ClipboardList, label: "Código", value: order.orderCode },
        ]}
      />

      {/* Seguimiento del examen */}
      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
            <Clock className="h-5 w-5" />
          </div>
          <h3 className="font-display text-lg font-semibold text-slate-900">Seguimiento del proceso</h3>
        </div>
        <LabStep status="recibida" active={order.status} timeline={order.timeline} reduceMotion={reduceMotion} />
        <LabStep status="en_laboratorio" active={order.status} timeline={order.timeline} reduceMotion={reduceMotion} />
        <LabStep status="resultado_listo" active={order.status} timeline={order.timeline} reduceMotion={reduceMotion} />
        <LabStep status="entregada" active={order.status} timeline={order.timeline} reduceMotion={reduceMotion} last />
      </section>

      {/* Resultado del examen */}
      {order.resultFile && (
        <section className="mt-4 rounded-3xl bg-white p-6 text-center shadow-sm ring-2 ring-green-200">
          <p className="text-sm font-semibold text-slate-800">📄 Tu resultado ya está disponible</p>
          <p className="mt-1 text-xs text-slate-500">{order.resultFile.name}</p>
          <a
            href={order.resultFile.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-green-700"
          >
            ⬇ Descargar resultado
          </a>
          <p className="mt-2 text-[11px] text-slate-400">
            El enlace dura 10 minutos y se regenera cada vez que abres esta página. El archivo se borra de la web a los 20 días.
          </p>
        </section>
      )}
      {order.resultExpired && (
        <section className="mt-4 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-800">Tu resultado ya no está disponible aquí</p>
          <p className="mt-2 text-xs text-slate-500">
            Por proteger tus datos, el resultado se comparte por esta página durante 20 días y luego se elimina de la web.
            Tu mascota lo tiene en su historia clínica — puedes pedirlo o consultarlo por WhatsApp.
          </p>
          <a
            href={`https://wa.me/${(order.sedePhone || "").replace(/\D/g, "")}?text=${encodeURIComponent(
              `Hola 🐾 quisiera consultar el resultado del examen de ${order.petName}, código ${order.orderCode}.`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1EBE5A]"
          >
            👋 Escribir a la sede
          </a>
        </section>
      )}

      <footer className="mt-8 rounded-2xl bg-blue-50/60 px-4 py-3 text-center text-xs text-slate-500">
        <p className="flex items-center justify-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 text-brand-blue" />
          Esta página se actualiza sola. El resultado se entrega impreso en la sede.
        </p>
        <button
          onClick={() => void lookup(order.orderCode)}
          className="mt-1 rounded bg-white/80 px-2 py-1 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200"
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
  reduceMotion,
}: {
  status: string;
  active: string;
  timeline: Array<{ status: string; createdAt: string }>;
  last?: boolean;
  reduceMotion: boolean;
}) {
  const meta = labStatusMeta(status);
  const event = [...timeline].reverse().find((t) => t.status === status);
  const index = LAB_STATUS_ORDER.indexOf(status);
  const activeIndex = LAB_STATUS_ORDER.indexOf(active);
  const isCurrent = index === activeIndex && status === active;

  let state: StepState = "pending";
  if (isCurrent) state = "current";
  else if (event !== undefined && index < activeIndex) state = "done";
  if (active === "cancelado") state = event ? "done" : "pending";

  return (
    <TimelineRow
      label={meta.label}
      icon={iconFor("lab", status)}
      state={state}
      time={event ? timeOf(event.createdAt) : undefined}
      last={last}
      reduceMotion={reduceMotion}
    />
  );
}

function ProcessStep({
  status,
  active,
  timeline,
  last,
  reduceMotion,
}: {
  status: string;
  active: string;
  timeline: Array<{ status: string; createdAt: string }>;
  last?: boolean;
  reduceMotion: boolean;
}) {
  const meta = STATUS_META[status];
  const event = [...timeline].reverse().find((t) => t.status === status);
  const index = STATUS_ORDER.indexOf(status as (typeof STATUS_ORDER)[number]);
  const activeIndex = STATUS_ORDER.indexOf(active as (typeof STATUS_ORDER)[number]);
  const isCurrent = index === activeIndex && status === active;

  let state: StepState = "pending";
  if (isCurrent) state = "current";
  else if (event !== undefined && index < activeIndex) state = "done";
  if (active === "cancelado") state = event ? "done" : "pending";

  return (
    <TimelineRow
      label={meta.label}
      icon={iconFor("va", status)}
      state={state}
      time={event ? timeOf(event.createdAt) : undefined}
      last={last}
      reduceMotion={reduceMotion}
    />
  );
}
