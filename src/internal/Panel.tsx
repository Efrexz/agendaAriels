import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, LogOut, PawPrint, Printer, RefreshCw, Search } from "lucide-react";
import { fetchClosures, fetchDay, searchBookings, type PanelBooking, type PanelClosure } from "./api";
import { printViaQz } from "./qz";
import { BookingCard } from "./BookingCard";
import { ClosuresPanel } from "./ClosuresPanel";
import { NewArrivalsToast } from "./NewArrivalsToast";
import { BRANCH_LABELS, SLOT_LABELS } from "../statuses";

function limaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const BRANCH_OPTIONS = Object.entries(BRANCH_LABELS);

function limaTomorrow(): string {
  // Mañana en la zona de la clínica (avanza el "reloj" +24h).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + 24 * 3600 * 1000));
}

export function Panel({ onSignOut, embedded = false, jumpSearch = null }: { email?: string; onSignOut: () => void; embedded?: boolean; jumpSearch?: string | null }) {
  const [date, setDate] = useState(limaToday);

  // Salto desde 📚 Historial: left-search al aterrizar en la pestaña.
  useEffect(() => {
    if (!jumpSearch) return;
    void (async () => {
      await Promise.resolve();
      handleSearch(jumpSearch);
    })();
  }, [jumpSearch]);
  const [branch, setBranch] = useState<string>("all");
  const [bookings, setBookings] = useState<PanelBooking[]>([]);
  const [closures, setClosures] = useState<PanelClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setQueryResults] = useState<PanelBooking[] | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // Toast de llegadas nuevas (no por auto-impresión: ese aviso lo da el papel)
  const [novelCount, setNovelCount] = useState(0);
  const searchSeqRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchedRef = useRef("");

  // Auto-impresión: APAGADA por defecto (el counter imprime manual con el botón
  // de la card). Si alguien la activa, solo imprime reservas creadas DESPUÉS de
  // abrir el panel: nunca históricas, sin cascada al cambiar de fecha/sede.
  const [autoPrint, setAutoPrint] = useState(false);
  const autoPrintRef = useRef(false);
  const sessionStartRef = useRef<number | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const resetDayView = () => {
    setQueryResults(null);
    setQuery("");
    setLoading(true);
    setTick((t) => t + 1);
  };

  // Carga del día: los setState ocurren tras await (regla de hooks).
  useEffect(() => {
    let active = true;
    sessionStartRef.current ??= Date.now();
    (async () => {
      try {
        const [{ bookings: day }, { closures: closed }] = await Promise.all([
          fetchDay(date, branch),
          fetchClosures(),
        ]);
        const dayList = day ?? [];
        if (!active) return;
        setBookings(dayList);
        setClosures(closed ?? []);
        setError(null);
        // Solo reservas nuevas (creadas tras abrir el panel) y aún no vistas:
        // el corte por createdAt elimina la cascada al cambiar fecha/sede.
        const incoming = dayList.filter(
          (b) =>
            b.status === "pendiente" &&
            new Date(b.createdAt).getTime() > (sessionStartRef.current ?? Number.MAX_SAFE_INTEGER) &&
            !seenIdsRef.current.has(b.id),
        );
        if (autoPrintRef.current && incoming.length > 0) {
          for (const b of incoming) void printViaQz(b);
        } else if (incoming.length > 0) {
          // Auto-impresión apagada: avisamos con el toast (clic = Actualizar)
          setNovelCount((c) => c + incoming.length);
        }
        for (const b of dayList) seenIdsRef.current.add(b.id);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error al cargar");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [date, branch, tick]);

  // Auto-refresco cada 30s si la pestaña está visible (nuevas reservas en vivo).
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && !query) setTick((t) => t + 1);
    }, 30_000);
    return () => clearInterval(id);
  }, [query]);

  useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    },
    [],
  );

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 3) {
      searchSeqRef.current += 1;
      setQueryResults(null);
      return;
    }
    // Debounce + guard: la respuesta de una tanda vieja se descarta si el
    // usuario ya escribió algo distinto (evita "Sin resultados" atascado).
    searchSeqRef.current += 1;
    const mySeq = searchSeqRef.current;
    const term = q.trim();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void (async () => {
        lastSearchedRef.current = term;
        try {
          const { results } = await searchBookings(term);
          if (searchSeqRef.current === mySeq) setQueryResults(results);
        } catch (err) {
          if (searchSeqRef.current === mySeq) {
            setError(err instanceof Error ? err.message : "Error al buscar");
          }
        }
      })();
    }, 300);
  }

  // Re-ejecuta la última búsqueda (tras cambiar un estado desde un resultado).
  async function refreshSearchResults() {
    const term = lastSearchedRef.current;
    if (!term) return;
    searchSeqRef.current += 1;
    const mySeq = searchSeqRef.current;
    try {
      const { results } = await searchBookings(term);
      if (searchSeqRef.current === mySeq) setQueryResults(results);
    } catch {
      /* conserva los resultados actuales */
    }
  }

  const bySlot = useMemo(() => {
    const list = searchResults ?? bookings ?? [];
    return {
      "9-11": list.filter((b) => b.timeSlot === "9-11"),
      "11-14": list.filter((b) => b.timeSlot === "11-14"),
    };
  }, [bookings, searchResults]);

  return (
    <div className={`mx-auto max-w-6xl ${embedded ? "p-0" : "min-h-screen p-4 pb-24 lg:p-8"}`}>
      {/* Encabezado */}
      <header className={`mb-6 flex items-center justify-between gap-4 ${embedded ? "hidden" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue text-white">
            <PawPrint className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-slate-900">Panel Interno · Grooming</h1>
            <p className="text-xs text-slate-500">Reservas por franja · búsqueda · días ocupados</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </header>

      {/* Controles */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              resetDayView();
            }}
            className="text-sm outline-none"
          />
        </label>
        <select
          value={branch}
          onChange={(e) => {
            setBranch(e.target.value);
            resetDayView();
          }}
          className="rounded-xl bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-slate-200 outline-none"
        >
          <option value="all">Todas las sedes</option>
          {BRANCH_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {/* Atajos rápidos (maqueta): un clic y la lista del día aparece */}
        <div className="flex overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <button
            onClick={() => {
              setDate(limaToday());
              resetDayView();
            }}
            className={`px-3 py-2.5 text-sm font-semibold transition hover:bg-blue-50 hover:text-brand-blue ${
              date === limaToday() ? "bg-brand-blue/10 text-brand-blue" : "text-slate-600"
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => {
              setDate(limaTomorrow());
              resetDayView();
            }}
            className={`border-l border-slate-200 px-3 py-2.5 text-sm font-semibold transition hover:bg-blue-50 hover:text-brand-blue ${
              date === limaTomorrow() ? "bg-brand-blue/10 text-brand-blue" : "text-slate-600"
            }`}
          >
            Mañana
          </button>
        </div>
        <button
          onClick={() => {
            autoPrintRef.current = !autoPrint;
            setAutoPrint(!autoPrint);
          }}
          title={autoPrint ? "Auto-impresión activa: cada reserva nueva se imprime sola" : "Auto-impresión desactivada"}
          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm shadow-sm ring-1 transition ${
            autoPrint
              ? "bg-brand-blue text-white ring-brand-blue"
              : "bg-white text-slate-600 ring-slate-200 hover:text-brand-blue"
          }`}
        >
          <Printer className="h-4 w-4" />
          Auto
        </button>
        <button
          onClick={() => {
            setLoading(true);
            setTick((t) => t + 1);
          }}
          className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:text-brand-blue"
          title="Refrescar"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
        <label className="ml-auto flex min-w-56 flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200 sm:max-w-xs">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar código, teléfono o nombre…"
            className="w-full text-sm outline-none"
          />
        </label>
      </div>

      {error && (
        <div className="no-print mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {searchResults !== null && (
        <>
          <p className="no-print mb-3 text-sm text-slate-500">
            {searchResults.length === 0
              ? `Sin resultados para "${query}".`
              : `${searchResults.length} resultado(s) para "${query}":`}
          </p>
          <div className="flex flex-col gap-3">
            {searchResults.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                showDate
                onChanged={() => {
                  setLoading(true);
                  setTick((t) => t + 1);
                  void refreshSearchResults();
                }}
                printing={printingId === booking.id}
                onPrint={(id) => setPrintingId(id)}
                onPrinted={() => setPrintingId(null)}
              />
            ))}
          </div>
        </>
      )}

      {/* Lista del día por franja */}
      {searchResults === null && (
        <div className="grid gap-6 lg:grid-cols-2">
          {(["9-11", "11-14"] as const).map((slot) => (
            <section key={slot}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="rounded-lg bg-brand-blue/10 px-2 py-1 text-brand-blue">{SLOT_LABELS[slot]}</span>
                <span className="text-slate-400">{bySlot[slot].length} reserva(s)</span>
              </h2>
              <div className="flex flex-col gap-3">
                {bySlot[slot].length === 0 && (
                  <p className="rounded-xl bg-white/60 px-4 py-6 text-center text-sm text-slate-400">
                    Sin reservas en esta franja
                  </p>
                )}
                {bySlot[slot].map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    onChanged={() => {
                      setLoading(true);
                      setTick((t) => t + 1);
                    }}
                    printing={printingId === booking.id}
                    onPrint={(id) => setPrintingId(id)}
                    onPrinted={() => setPrintingId(null)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Gestión de días cerrados */}
      <ClosuresPanel closures={closures} onChanged={() => setTick((t) => t + 1)} hidden={searchResults !== null} />

      {/* Llegadas nuevas con el panel abierto (auto-impresión apagada) */}
      <NewArrivalsToast
        count={novelCount}
        label="reserva nueva"
        onView={() => {
          setNovelCount(0);
          setLoading(true);
          setTick((t) => t + 1);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
