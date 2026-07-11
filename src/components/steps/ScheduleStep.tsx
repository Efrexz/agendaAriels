import { useState, useMemo } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isBefore, startOfDay, addMonths, subMonths,
  getDay
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FormData } from "../BookingWizard";

interface ScheduleStepProps {
  formData: FormData;
  update: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext: () => void;
  onBack: () => void;
  onAddAnother?: () => void;
  onContinue?: () => void;
}

export function ScheduleStep({ formData, update, onNext }: ScheduleStepProps) {
  const today = startOfDay(new Date());
  const [currentMonth, setCurrentMonth] = useState(today);

  const { days, blanks } = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const monthDays = eachDayOfInterval({ start, end });
    const firstDay = getDay(start);
    return { days: monthDays, blanks: firstDay };
  }, [currentMonth]);

  const prevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const nextMonth = () => setCurrentMonth((m) => addMonths(m, 1));

  const handleSelect = (day: Date) => {
    update("date", format(day, "yyyy-MM-dd"));
    onNext();
  };

  const dayNames = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

  return (
    <div>
      <h2 className="mb-6 text-center text-[var(--text-step-title)] font-display font-bold tracking-tight text-gray-800">
        Selecciona una fecha
      </h2>

      <div className="mx-auto max-w-sm">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="rounded-full p-2 transition-colors hover:bg-gray-100"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <span className="text-lg font-semibold text-gray-800">
              {format(currentMonth, "MMMM yyyy", { locale: es })}
            </span>
            <button
              onClick={nextMonth}
              className="rounded-full p-2 transition-colors hover:bg-gray-100"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-gray-500">
            {dayNames.map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
            {Array.from({ length: blanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map((day) => {
              const isPast = isBefore(day, today) && !isSameDay(day, today);
              const selected = formData.date === format(day, "yyyy-MM-dd");

              return (
                <button
                  key={day.toISOString()}
                  disabled={isPast}
                  onClick={() => handleSelect(day)}
                  className={`rounded-lg py-3 text-sm font-medium transition-all ${
                    isPast
                      ? "cursor-not-allowed text-gray-300"
                      : selected
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-gray-800 hover:bg-blue-100"
                  }`}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}