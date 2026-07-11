import { CheckCircle } from "lucide-react";
import type { FormData } from "../BookingWizard";

interface AddonsStepProps {
  formData: FormData;
  update: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext: () => void;
  onBack: () => void;
  onAddAnother?: () => void;
  onContinue?: () => void;
}

const OPTIONS = [
  {
    value: "9-11" as const,
    label: "9:00 am – 11:00 am",
    sub: "Turno mañana",
    timeKey: "morning" as const,
    alt: "Horario de mañana",
  },
  {
    value: "11-14" as const,
    label: "11:00 am – 2:00 pm",
    sub: "Turno mediodía",
    timeKey: "noon" as const,
    alt: "Horario de mediodía",
  },
];

export function AddonsStep({ formData, update, onNext }: AddonsStepProps) {
  const handleSelect = (value: "9-11" | "11-14") => {
    update("timeRange", value);
    onNext();
  };

  const petType = formData.petType === "cat" ? "cat" : "dog";

  return (
    <div>
      <h2 className="mb-6 sm:mb-8 text-center text-[var(--text-step-title)] font-display font-bold tracking-tight text-gray-800">
        Elige un horario de recojo
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        {OPTIONS.map(({ value, label, sub, timeKey, alt }) => {
          const selected = formData.timeRange === value;
          const image = `/images/pickUpTime/${petType}/${timeKey}.webp`;
          return (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98] ${
                selected
                  ? "border-blue-500 shadow-lg shadow-blue-100"
                  : "border-gray-200 shadow-sm hover:border-blue-300"
              }`}
            >
              <div className="relative aspect-[5/4] w-full overflow-hidden">
                <img
                  src={image}
                  alt={alt}
                  loading="lazy"
                  onError={(e) => {
                    if (petType !== "dog") {
                      e.currentTarget.src = `/images/pickUpTime/dog/${timeKey}.webp`;
                    }
                  }}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div className={`absolute inset-0 transition-colors duration-300 ${
                  selected ? "bg-blue-500/20" : "bg-gradient-to-t from-black/40 to-transparent"
                }`} />
                {selected && (
                  <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
                    <CheckCircle className="h-5 w-5 fill-white text-blue-600" />
                  </span>
                )}
              </div>
              <div className="flex flex-col items-center gap-2 px-5 py-5 sm:px-6 sm:py-6">
                <span
                  className={`text-lg font-semibold sm:text-xl ${
                    selected ? "text-blue-700" : "text-gray-700"
                  }`}
                >
                  {label}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    selected
                      ? "bg-orange-100 text-orange-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {sub}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}