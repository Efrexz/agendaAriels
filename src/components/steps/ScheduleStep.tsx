import { useState, useMemo } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isBefore, addMonths, subMonths,
  getDay, parseISO, addDays, isAfter
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, PawPrint, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import type { FormData } from "../BookingWizard";
import { LazyImage } from "../LazyImage";
import { MAX_ADVANCE_DAYS } from "../../data/branches";
import { getLimaDayKey, getLimaHour, limaToday } from "../../utils/limaTime";

interface ScheduleStepProps {
  formData: FormData;
  update: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext: () => void;
  onBack: () => void;
  onAddAnother?: () => void;
  onContinue?: () => void;
}

const TIME_SLOTS = [
  {
    value: "9-11" as const,
    label: "9:00 am – 11:00 am",
    sub: "Turno mañana",
    timeKey: "morning" as const,
    alt: "Horario de mañana",
    startHour: 9,
  },
  {
    value: "11-14" as const,
    label: "11:00 am – 2:00 pm",
    sub: "Turno mediodía",
    timeKey: "noon" as const,
    alt: "Horario de mediodía",
    startHour: 11,
  },
];

const dayNames = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

export function ScheduleStep({ formData, update, onNext }: ScheduleStepProps) {
  const [today] = useState(() => limaToday());
  const todayKey = getLimaDayKey();
  const nowHour = getLimaHour();
  const maxDay = addDays(today, MAX_ADVANCE_DAYS);
  const [currentMonth, setCurrentMonth] = useState(today);

  const { days, blanks } = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const monthDays = eachDayOfInterval({ start, end });
    const firstDay = getDay(start);
    return { days: monthDays, blanks: firstDay };
  }, [currentMonth]);

  const canGoPrev = isBefore(startOfMonth(currentMonth), startOfMonth(today));
  const canGoNext = isBefore(startOfMonth(currentMonth), startOfMonth(maxDay));

  const prevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const nextMonth = () => setCurrentMonth((m) => addMonths(m, 1));

  const handleSelectDate = (day: Date) => {
    update("date", format(day, "yyyy-MM-dd"));
    update("timeRange", null);
  };

  const handleSelectTime = (value: "9-11" | "11-14") => {
    update("timeRange", value);
  };

  const petType = formData.petType === "cat" ? "cat" : "dog";
  const canContinue = Boolean(formData.date && formData.timeRange);

  const selectedDateLabel = useMemo(() => {
    if (!formData.date) return "";
    try {
      return format(parseISO(formData.date), "EEEE d", { locale: es });
    } catch {
      return "";
    }
  }, [formData.date]);

  return (
    <div>
      <h2 className="mb-6 text-center text-step-title font-display font-bold tracking-tight text-gray-800">
        Elige fecha y horario
      </h2>

      <div className="overflow-hidden rounded-2xl border border-[#E7E2D8] bg-white shadow-sm">
        {/* Sección superior: mascota + calendario */}
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Columna izquierda: mascota con calendario */}
          <div className="relative flex items-center justify-center bg-gradient-to-br from-blue-50 to-[#FBF8F4] p-3 sm:p-4 md:p-5 min-h-60 sm:min-h-72">
            <img
              src="/images/vetMascot/calendar.webp"
              alt="Mascota de Veterinaria Ariel con un calendario"
              className="h-full w-full max-h-[340px] object-contain"
            />
          </div>

          {/* Columna derecha: calendario estilizado */}
          <div className="border-t border-[#E7E2D8] bg-[#FBF8F4] p-4 sm:p-5 md:border-l md:border-t-0">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={prevMonth}
                disabled={!canGoPrev}
                aria-label="Mes anterior"
                className="rounded-full p-2 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5 text-blue-700" />
              </button>
              <span className="text-base font-semibold capitalize text-blue-700 sm:text-lg">
                {format(currentMonth, "MMMM yyyy", { locale: es })}
              </span>
              <button
                onClick={nextMonth}
                disabled={!canGoNext}
                aria-label="Mes siguiente"
                className="rounded-full p-2 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5 text-blue-700" />
              </button>
            </div>

            <div className="mt-2 text-center text-[11px] text-gray-400">
              Puedes reservar con hasta {MAX_ADVANCE_DAYS} días de anticipación.
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500">
              {dayNames.map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
              {Array.from({ length: blanks }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {days.map((day) => {
                const isPast = isBefore(day, today) && !isSameDay(day, today);
                const isBeyondMax = isAfter(day, maxDay);
                const dayStr = format(day, "yyyy-MM-dd");
                const selected = formData.date === dayStr;
                const disabled = isPast || isBeyondMax;

                return (
                  <button
                    key={day.toISOString()}
                    disabled={disabled}
                    onClick={() => handleSelectDate(day)}
                    className={`group relative flex flex-col items-center justify-center rounded-xl py-2 text-sm font-medium transition-all ${
                      disabled
                        ? "cursor-not-allowed text-gray-300"
                        : selected
                          ? "bg-blue-600 text-white shadow-md"
                          : "text-gray-800 hover:-translate-y-0.5 hover:bg-blue-100"
                    }`}
                  >
                    <span>{format(day, "d")}</span>
                    {!disabled && (
                      <PawPrint
                        className={`mt-0.5 h-2.5 w-2.5 transition-opacity duration-200 ${
                          selected
                            ? "text-orange-300 opacity-100"
                            : "text-orange-400 opacity-0 group-hover:opacity-70"
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Separador */}
        <div className="h-px w-full bg-[#E7E2D8]" />

        {/* Sección inferior: horarios (condicional) */}
        {formData.date ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="p-4 sm:p-6"
          >
            <p className="mb-4 text-center text-sm font-medium text-gray-600 sm:mb-5 sm:text-base">
              ¡Perfecto! Elige tu horario para el{" "}
              <span className="font-semibold capitalize text-blue-700">
                {selectedDateLabel}
              </span>
              :
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {TIME_SLOTS.map(({ value, label, sub, timeKey, alt, startHour }) => {
                const selected = formData.timeRange === value;
                const blocked = formData.date === todayKey && nowHour >= startHour;
                const image = `/images/pickUpTime/${petType}/${timeKey}.webp`;
                return (
                  <button
                    key={value}
                    onClick={() => handleSelectTime(value)}
                    disabled={blocked}
                    title={blocked ? "Esta franja ya inició el día de hoy" : undefined}
                    className={`group relative flex cursor-pointer flex-row items-stretch overflow-hidden rounded-2xl text-left transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                      blocked
                        ? "cursor-not-allowed border-2 border-gray-200 bg-gray-50 opacity-60"
                        : selected
                          ? "border-2 border-blue-500 bg-white shadow-lg shadow-blue-100 -translate-y-1"
                          : "border-2 border-gray-200 bg-white shadow-sm hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl"
                    }`}
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden sm:h-24 sm:w-24">
                      <LazyImage
                        src={image}
                        alt={alt}
                        onError={(e) => {
                          if (petType !== "dog") {
                            e.currentTarget.src = `/images/pickUpTime/dog/${timeKey}.webp`;
                          }
                        }}
                        className={`h-full w-full object-cover transition-transform duration-500 ease-out ${
                          blocked ? "" : "group-hover:scale-105"
                        }`}
                      />
                    </div>
                    <div className={`flex flex-1 flex-col justify-center gap-1 px-3 py-2 sm:px-4 ${
                      blocked ? "hidden sm:flex" : ""
                    }`}>
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          selected ? "text-orange-600" : "text-gray-500"
                        }`}
                      >
                        {blocked ? "Ya no disponible" : sub}
                      </span>
                      <span
                        className={`text-base font-semibold sm:text-lg ${
                          selected ? "text-blue-700" : "text-gray-800"
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                    {selected && !blocked && (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
                        <CheckCircle className="h-4 w-4 fill-white text-blue-600" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <div className="p-4 sm:p-6">
            <p className="text-center text-sm text-gray-400">
              Primero selecciona un día en el calendario para ver los horarios disponibles.
            </p>
          </div>
        )}

        {/* Separador */}
        <div className="h-px w-full bg-[#E7E2D8]" />

        {/* Botón Continuar */}
        <div className="p-4 sm:p-6">
          <button
            onClick={onNext}
            disabled={!canContinue}
            className={`w-full rounded-xl py-3 text-lg font-semibold text-white transition-all ${
              canContinue
                ? "cursor-pointer bg-blue-600 shadow-md hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200/50 active:scale-[0.98]"
                : "cursor-not-allowed bg-gray-300"
            }`}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}