import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, LogOut, PawPrint, Printer, RefreshCw, Search } from "lucide-react";
import { fetchClosures, fetchDay, searchBookings, type PanelBooking, type PanelClosure } from "./api";
import { printViaQz } from "./qz";
import { BookingCard } from "./BookingCard";
import { ClosuresPanel } from "./ClosuresPanel";
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

export function Panel({ onSignOut, embedded = false }: { email?: string; onSignOut: () => void; embedded?: boolean }) {
  const [date, setDate] = useState(limaToday);
  const [branch, setBranch] = useState<string>("all");
  const [bookings, setBookings] = useState<PanelBooking[]>([]);
  const [closures, setClosures] = useState<PanelClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setQueryResults] = useState<PanelBooking[] | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const searchSeqRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchedRef = useRef("");

  // Auto-impresión: cuando el panel está abierto, cada reserva nueva que
  // llega se imprime sola en la térmica (vía QZ Tray), sin anotar nada a mano.
  const [autoPrint, setAutoPrint] = useState(true);
  const autoPrintRef = useRef(true);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const resetDayView = () => {
    setQueryResults(null);
    setQuery("");
    setLoading(true);
    setTick((t) => t + 1);
  };

  // Carga del día: los setState ocurren tras await (regla de hooks).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [{ bookings: day }, { closures: closed }] = await Promise.all([
          fetchDay(date, branch),
          fetchClosures(),
        ]);
        if (!active) return;
        setBookings(day);
        setClosures(closed);
        setError(null);
        // Nunca imprimir al abrir la página (evita lanzar boletas históricas);
        // después, cada reserva pendiente nueva que aparezca → imprimir.
        const incoming = day.filter(
          (b) => b.status === "pendiente" && !seenIdsRef.current.has(b.id),
        );
        if (firstLoadRef.current) {
          firstLoadRef.current = false;
        } else if (autoPrintRef.current && incoming.length > 0) {
          for (const b of incoming) void printViaQz(b);
        }
        for (const b of day) seenIdsRef.current.add(b.id);
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
    const list = searchResults ?? bookings;
    return {
      "9-11": list.filter((b) => b.timeSlot === "9-11"),
      "11-14": list.filter((b) => b.timeSlot === "11-14"),
    };
  }, [bookings, searchResults]);

  return (
    <div className="mx-auto min-h-screen max-w-6xl p-4 pb-24 lg:p-8">
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
    </div>
  );
}
