import type { FormData } from "../BookingWizard";

interface ServiceTypeStepProps {
  formData: FormData;
  update: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext: () => void;
  onBack?: () => void;
  onAddAnother?: () => void;
  onContinue?: () => void;
}

const OPTIONS = [
  {
    value: "dog" as const,
    label: "Canino",
    blurb: "Estilismo canino completo",
    image: "/images/petType/dog.webp",
    alt: "Perro recién bañado y cepillado",
  },
  {
    value: "cat" as const,
    label: "Felino",
    blurb: "Estilismo felino a bajo estrés",
    image: "/images/petType/cat.webp",
    alt: "Gato con pelaje brillante tras el baño",
  },
];

export function ServiceTypeStep({ formData, update, onNext }: ServiceTypeStepProps) {
  const handleSelect = (value: "dog" | "cat") => {
    update("petType", value);
    onNext();
  };

  return (
    <div>
      <div className="mb-6 sm:mb-8 text-center">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
          Selecciona a tu peludito
        </p>
        <h2 className="text-[var(--text-step-title)] font-display font-bold tracking-tight text-[#1A2238]">
          ¿Qué tipo de mascota es?
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        {OPTIONS.map(({ value, label, blurb, image, alt }) => {
          const selected = formData.petType === value;
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
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#FBF8F4]">
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
                  <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-md">
                    ✓
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1 p-5">
                <span
                  className={`text-lg font-semibold tracking-tight ${
                    selected ? "text-blue-700" : "text-[#1A2238]"
                  }`}
                >
                  {label}
                </span>
                <span className="text-xs leading-snug text-gray-500">{blurb}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
