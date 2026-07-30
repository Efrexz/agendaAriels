import { motion, useReducedMotion } from "framer-motion";
import { PawPrint, ShieldCheck, ArrowRight } from "lucide-react";
import type { FormData } from "../BookingWizard";
import { LazyImage } from "../LazyImage";

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
    image: "/images/petBreed/yorkshire.webp",
    alt: "Mascota de raza pequeña",
  },
  {
    value: "medium" as const,
    label: "Mediano",
    weight: "10 – 20 kg",
    image: "/images/petBreed/schnauzer.webp",
    alt: "Mascota de raza mediana",
  },
  {
    value: "large" as const,
    label: "Grande",
    weight: "20 – 30 kg",
    image: "/images/petBreed/samoyedo.webp",
    alt: "Mascota de raza grande",
  },
  {
    value: "giant" as const,
    label: "Gigante",
    weight: "30 – 50 kg",
    image: "/images/petBreed/pastorAleman.webp",
    alt: "Mascota de raza gigante",
  },
];

export function OwnerInfoStep({ formData, update, onNext }: OwnerInfoStepProps) {
  const prefersReduced = useReducedMotion();

  const handleSelect = (value: "small" | "medium" | "large" | "giant") => {
    update("size", value);
  };

  return (
    <div>
      <div className="mb-6 sm:mb-8 text-center">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
          Tamaño
        </p>
        <h2 className="text-step-title font-display font-bold tracking-tight text-[#1A2238]">
          ¿Qué tamaño tiene tu peludito?
        </h2>
        <p className="mt-3 text-sm text-gray-500 sm:text-base">
          Esto nos ayuda a adaptar el servicio ideal para su comodidad y bienestar
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
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
              <div className="relative aspect-[4/5] w-full overflow-hidden">
                <LazyImage
                  src={image}
                  alt={alt}
                  className="transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div
                  className={`absolute inset-0 transition-opacity duration-300 ${
                    selected ? "bg-blue-900/10" : "bg-transparent"
                  }`}
                />
                {selected && (
                  <motion.span
                    key={`paw-${value}`}
                    initial={prefersReduced ? { opacity: 1 } : { scale: 0, rotate: -15 }}
                    animate={prefersReduced ? { opacity: 1 } : { scale: 1, rotate: 0 }}
                    transition={
                      prefersReduced
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 400, damping: 15 }
                    }
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white shadow-md"
                  >
                    <PawPrint className="h-4 w-4" />
                  </motion.span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 bg-[#EAF1F8] p-3 sm:p-4">
                <div className="flex flex-col gap-0.5 text-left">
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
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    selected
                      ? "border-blue-600 bg-blue-600"
                      : "border-gray-300 bg-transparent"
                  }`}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end sm:mt-6">
        <button
          onClick={onNext}
          disabled={!formData.size}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-bold shadow-md transition-all ${
            formData.size
              ? "cursor-pointer bg-gradient-to-r from-blue-600 to-orange-400 text-white hover:shadow-lg active:scale-[0.97]"
              : "cursor-not-allowed bg-gray-200 text-gray-400"
          }`}
        >
          Continuar
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      <div className="relative mt-6">
        <div className="rounded-2xl bg-[#E9EDF9] p-4 pr-28 sm:p-5 sm:pr-40">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                El tamaño de tu peludito importa
              </p>
              <p className="text-xs text-gray-500">
                Nos ayuda a calcular el costo exacto del servicio, ya que varía según el peso y el tipo de pelaje.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-end sm:absolute sm:-bottom-6 sm:right-0 sm:mt-0">
          <div className="relative mb-10 max-w-44 rounded-2xl bg-white px-3 py-2 text-xs font-medium leading-snug text-gray-600 shadow-md">
            ¡Yo te ayudo!
            <span className="absolute -right-1.5 bottom-5 h-3 w-3 rotate-45 bg-white" />
          </div>
          <img
            src="/images/vetMascot/pesoMascota.png"
            alt="Asistente veterinario"
            className="h-24 sm:h-28 lg:h-32 select-none"
          />
        </div>
      </div>
    </div>
  );
}
