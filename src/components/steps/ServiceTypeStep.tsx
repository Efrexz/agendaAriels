import type { FormData } from "../BookingWizard";
import { LazyImage } from "../LazyImage";
import { Dog, Cat, ChevronRight, ArrowRight } from "lucide-react";

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
    icon: Dog,
  },
  {
    value: "cat" as const,
    label: "Felino",
    blurb: "Estilismo felino a bajo estrés",
    image: "/images/petType/cat.webp",
    alt: "Gato con pelaje brillante tras el baño",
    icon: Cat,
  },
];

export function ServiceTypeStep({ formData, update, onNext }: ServiceTypeStepProps) {
  const handleSelect = (value: "dog" | "cat") => {
    update("petType", value);
  };

  return (
    <div>
      <div className="mb-6 sm:mb-8 text-center">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
          Selecciona a tu peludito
        </p>
        <h2 className="text-step-title font-display font-bold tracking-tight text-[#1A2238]">
          ¿Qué tipo de mascota es?
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Esto nos ayuda a brindarle una mejor atención personalizada
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        {OPTIONS.map(({ value, label, blurb, image, alt, icon: Icon }) => {
          const selected = formData.petType === value;
          const isDog = value === "dog";

          return (
            <button
              key={value}
              type="button"
              onClick={() => handleSelect(value)}
              aria-pressed={selected}
              className={`group relative flex flex-col overflow-hidden rounded-3xl bg-white text-left shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98] ${
                selected
                  ? isDog
                    ? "ring-2 ring-blue-500 ring-offset-2 shadow-lg"
                    : "ring-2 ring-orange-500 ring-offset-2 shadow-lg"
                  : isDog
                    ? "hover:shadow-blue-200/50"
                    : "hover:shadow-orange-200/50"
              } ${isDog ? "focus-visible:ring-blue-500" : "focus-visible:ring-orange-500"}`}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <LazyImage
                  src={image}
                  alt={alt}
                  className="transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div
                  className={`absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-colors duration-300 ${
                    selected
                      ? isDog
                        ? "bg-blue-600"
                        : "bg-orange-500"
                      : "bg-white"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 transition-colors duration-300 ${
                      selected
                        ? "text-white"
                        : isDog
                          ? "text-blue-600"
                          : "text-orange-500"
                    }`}
                  />
                </div>
              </div>

              <div
                className={`flex items-center gap-3 p-5 ${
                  isDog ? "bg-[#EAF2FB]" : "bg-[#FBF3E4]"
                }`}
              >
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-lg font-semibold tracking-tight text-[#1A2238]">
                    {label}
                  </span>
                  <span className="text-xs leading-snug text-gray-500">{blurb}</span>
                </div>
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                    selected
                      ? isDog
                        ? "bg-blue-600 text-white"
                        : "bg-orange-500 text-white"
                      : `bg-white text-gray-400 ${isDog ? "group-hover:bg-blue-600 group-hover:text-white" : "group-hover:bg-orange-500 group-hover:text-white"}`
                  }`}
                >
                  <ChevronRight
                    className={`h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5`}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end sm:mt-6">
        <button
          onClick={onNext}
          disabled={!formData.petType}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-bold shadow-md transition-all ${
            formData.petType
              ? "cursor-pointer bg-gradient-to-r from-blue-600 to-orange-400 text-white hover:shadow-lg active:scale-[0.97]"
              : "cursor-not-allowed bg-gray-200 text-gray-400"
          }`}
        >
          Continuar
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
