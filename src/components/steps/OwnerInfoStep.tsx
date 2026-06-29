import type { FormData } from "../BookingWizard";

interface OwnerInfoStepProps {
  formData: FormData;
  update: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext: () => void;
  onBack: () => void;
  onAddAnother?: () => void;
  onContinue?: () => void;
}

const OPTIONS = [
  {
    value: "small" as const,
    label: "Pequeño",
    weight: "2 – 10 kg",
    image: "/images/size-small.png",
    alt: "Mascota de raza pequeña",
  },
  {
    value: "medium" as const,
    label: "Mediano",
    weight: "10 – 20 kg",
    image: "/images/size-medium.png",
    alt: "Mascota de raza mediana",
  },
  {
    value: "large" as const,
    label: "Grande",
    weight: "20 – 30 kg",
    image: "/images/size-large.png",
    alt: "Mascota de raza grande",
  },
  {
    value: "giant" as const,
    label: "Gigante",
    weight: "30 – 50 kg",
    image: "/images/size-giant.png",
    alt: "Mascota de raza gigante",
  },
];

export function OwnerInfoStep({ formData, update, onNext }: OwnerInfoStepProps) {
  const handleSelect = (value: "small" | "medium" | "large" | "giant") => {
    update("size", value);
    onNext();
  };

  return (
    <div>
      <div className="mb-8 text-center">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
          Tamaño
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-[#1A2238]">
          ¿Qué tamaño tiene tu mascota?
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5">
        {OPTIONS.map(({ value, label, weight, image, alt }) => {
          const selected = formData.size === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleSelect(value)}
              aria-pressed={selected}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98] ${
                selected
                  ? "border-blue-500 shadow-lg shadow-blue-100"
                  : "border-[#E7E2D8] shadow-sm hover:border-blue-300"
              }`}
            >
              <div className="relative aspect-square w-full overflow-hidden bg-[#FBF8F4]">
                <img
                  src={image}
                  alt={alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div
                  className={`absolute inset-0 transition-opacity duration-300 ${
                    selected ? "bg-blue-900/10" : "bg-transparent"
                  }`}
                />
                {selected && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-md">
                    ✓
                  </span>
                )}
              </div>

              <div className="flex flex-col items-center gap-0.5 p-3 sm:p-4">
                <span
                  className={`text-sm font-semibold tracking-tight sm:text-base ${
                    selected ? "text-blue-700" : "text-[#1A2238]"
                  }`}
                >
                  {label}
                </span>
                <span className="text-[11px] leading-snug text-gray-500 sm:text-xs">
                  {weight}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
