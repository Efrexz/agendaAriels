// Calendario mensual del wizard médico — port del ScheduleStep del grooming
// (misma API de días cerrados: fetchClosuresPublic + closureFor; cero APIs nuevas).
// Solo presentación: el seleccionado va en naranja de marca; los días ocupados
// en rojo tachado; fuera de rango inhabilitado.
import { useEffect, useMemo, useState } from "react";
import {
  addMonths, eachDayOfInterval, endOfMonth, format, getDay, isAfter, isBefore, isSameDay, parseISO, startOfMonth, subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, PawPrint, XCircle } from "lucide-react";
import { closureFor, fetchClosuresPublic, type ClosureEntry } from "../services/availability";
import { limaToday } from "../utils/limaTime";

const dayNames = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

export function CalendarCard({
  branch,
  date,
  maxDate,
  onSelect,
}: {
  branch: string;
  date: string | null;
  maxDate: string;
  onSelect: (dateStr: string) => void;
}) {
  const todayDate = limaToday();

  const maxDay = useMemo(() => parseISO(maxDate), [maxDate]);
  const [currentMonth, setCurrentMonth] = useState(() => format(todayDate, "yyyy-MM-dd"));
  const [closures, setClosures] = useState<ClosureEntry[]>([]);

  // Días cerrados (los pinta el panel de dias cerrados): rojo "Ocupado".
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchClosuresPublic();
        if (active) setClosures(data);
      } catch {
        /* sin datos el calendario sigue normal */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const { days, blanks } = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return {
      days: eachDayOfInterval({ start, end }),
      blanks: getDay(start),
    };
  }, [currentMonth]);

  const canGoPrev = isBefore(startOfMonth(currentMonth), startOfMonth(todayDate));
  const canGoNext = isBefore(startOfMonth(currentMonth), startOfMonth(maxDay));

  return (
    <div className="overflow-hidden rounded-2xl bg-[#F7FBFF] shadow-sm ring-1 ring-[#DCEBFF]">
      {/* Navegación de mes */}
      <div className="mb-3 flex items-center justify-between px-4 pt-4">
        <button
          onClick={() => setCurrentMonth((m) => format(subMonths(parseISO(m), 1), "yyyy-MM-dd"))}
          disabled={!canGoPrev}
          aria-label="Mes anterior"
          className="rounded-full bg-white p-2 shadow-sm ring-1 ring-[#DCEBFF] transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5 text-[#475AAB]" />
        </button>
        <span className="font-display text-lg font-semibold capitalize text-[#475AAB]">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </span>
        <button
          onClick={() => setCurrentMonth((m) => format(addMonths(parseISO(m), 1), "yyyy-MM-dd"))}
          disabled={!canGoNext}
          aria-label="Mes siguiente"
          className="rounded-full bg-white p-2 shadow-sm ring-1 ring-[#DCEBFF] transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5 text-[#475AAB]" />
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1 px-4 pb-3 text-center text-[11px] font-bold uppercase tracking-wide text-[#8A97B1]">
        {dayNames.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
        {Array.from({ length: blanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
      </div>

      {/* Grid de días */}
      <div className="grid grid-cols-7 gap-1 px-4 pb-3">
        {days.map((day) => {
          const isPast = isBefore(day, todayDate) && !isSameDay(day, todayDate);
          const isBeyondMax = isAfter(day, maxDay);
          const dayStr = format(day, "yyyy-MM-dd");
          const selected = date === dayStr;
          const closed = closureFor(closures, branch, dayStr);
          const disabled = isPast || isBeyondMax || closed.all;

          return (
            <button
              key={day.toISOString()}
              disabled={disabled}
              onClick={() => onSelect(dayStr)}
              title={disabled && closed.all ? "Ocupado: sin turnos para esta sede" : undefined}
              className={`group relative flex flex-col items-center justify-center rounded-xl py-2 text-sm font-medium transition-all ${
                disabled
                  ? closed.all
                    ? "cursor-not-allowed bg-red-50 font-semibold text-red-300 line-through"
                    : "cursor-not-allowed text-gray-300"
                  : selected
                    ? "bg-brand-orange text-white shadow-md shadow-orange-200"
                    : "text-[#1A2238] hover:-translate-y-0.5 hover:bg-[#EFF6FF]"
              }`}
            >
              <span>{format(day, "d")}</span>
              {disabled && closed.all && <XCircle className="mt-0.5 h-2.5 w-2.5 text-red-400" aria-hidden />}
              {!disabled && (
                <PawPrint
                  className={`mt-0.5 h-2.5 w-2.5 transition-opacity duration-200 ${
                    selected ? "text-white/80 opacity-100" : "text-orange-400 opacity-0 group-hover:opacity-70"
                  }`}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="border-t border-[#DCEBFF] py-2.5 text-center text-[11px] text-[#8A97B1]">
        Puedes reservar con hasta 30 días de anticipación.
      </p>
    </div>
  );
}
