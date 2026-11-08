// Calendario mensual del wizard médico — port del ScheduleStep del grooming
// (misma API de días cerrados: fetchClosuresPublic + closureFor; cero APIs nuevas).
// Solo presentación (maqueta 07/11): el día elegido va AZUL con puntito naranja
// (naranja reservado a lo activo del proceso); los días ocupados en rojo tachado;
// fuera de rango inhabilitado. Pendiente en cola: espejo en grooming (mini-maqueta).
import { useEffect, useMemo, useState } from "react";
import {
  addMonths, eachDayOfInterval, endOfMonth, format, getDay, isAfter, isBefore, isSameDay, parseISO, startOfMonth, subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, PawPrint, XCircle } from "lucide-react";
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
  const maxPretty = useMemo(
    () => format(maxDay, "EEEE d 'de' MMMM", { locale: es }),
    [maxDay],
  );
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
      <div className="grid grid-cols-7 gap-1 px-4 pb-3 text-center text-[11px] font-bold uppercase tracking-wide text-[#3B5178]">
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
          // El dueño pidió que los días sin agenda digan POR QUÉ están inhabilitados.
          const beyondTip = `Los horarios se publican cada lunes — agenda abierta hasta ${maxPretty}`;

          return (
            <button
              key={day.toISOString()}
              disabled={disabled}
              onClick={() => onSelect(dayStr)}
              title={disabled ? (closed.all ? "Ocupado: sin turnos para esta sede" : isBeyondMax ? beyondTip : undefined) : undefined}
              className={`group relative flex flex-col items-center justify-center rounded-xl py-2 text-sm font-medium transition-all ${
                disabled
                  ? closed.all
                    ? "cursor-not-allowed bg-red-50 font-semibold text-red-300 line-through"
                    : "cursor-not-allowed text-gray-300"
                  : selected
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                    : "text-[#1A2238] hover:-translate-y-0.5 hover:bg-[#EFF6FF]"
              }`}
            >
              <span>{format(day, "d")}</span>
              {disabled && closed.all && <XCircle className="mt-0.5 h-2.5 w-2.5 text-red-400" aria-hidden />}
              {selected && !disabled && (
                // Puntito naranja bajo el número (maqueta): el día elegido
                // va azul y el naranja queda para lo activo del proceso.
                <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-400" />
              )}
              {!selected && !disabled && (
                <PawPrint
                  className={`mt-0.5 h-2.5 w-2.5 text-orange-400 opacity-0 transition-opacity duration-200 group-hover:opacity-70`}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Pill informativa (maqueta, con el dato real: semana en curso + próxima) */}
      <div className="border-t border-[#DCEBFF] px-4 py-3">
        <div className="flex items-start gap-2.5 rounded-xl bg-[#EFF6FF] px-3.5 py-2.5 text-left">
          <CalendarDays className="h-4 w-4 shrink-0 text-blue-600 sm:mt-0.5" aria-hidden />
          <p className="text-[11px] leading-relaxed text-[#3B5178]">
            Reserva hasta el <b>{maxPretty}</b> — los horarios de más allá se
            publican <b>cada lunes</b>.
          </p>
        </div>
      </div>
    </div>
  );
}
