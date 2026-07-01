import { MapPin, CheckCircle } from "lucide-react";
import type { FormData } from "../BookingWizard";

interface BranchSelectionStepProps {
  formData: FormData;
  update: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext: () => void;
}

const BRANCHES = [
  {
    value: "san_martin" as const,
    label: "Sede San Martín de Porres",
    image: "/images/sedes/sanMartin.webp",
    address: "Av. Proceres 115",
  },
  {
    value: "los_olivos" as const,
    label: "Sede Los Olivos",
    image: "/images/sedes/olivos.webp",
    address: "Av. Beta Mz Ñ lote 1",
  },
  {
    value: "san_miguel" as const,
    label: "Sede San Miguel",
    image: "/images/sedes/sanMiguel.webp",
    address: "Av. Brigida Silva 272",
  },
];

export function BranchSelectionStep({ formData, update, onNext }: BranchSelectionStepProps) {
  const selected = formData.branch;

  return (
    <div>
      <h2 className="mb-2 text-center text-2xl font-bold text-gray-800">
        Seleccione su sede más cercana
      </h2>
      <p className="mb-8 text-center text-sm text-gray-500">
        Elige la veterinaria donde atenderemos a tu mascota
      </p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {BRANCHES.map(({ value, label, image, address }) => {
          const isSelected = selected === value;
          return (
            <button
              key={value}
              onClick={() => update("branch", value)}
              className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-all duration-300 ${
                isSelected
                  ? "border-blue-500 shadow-lg shadow-blue-200/50"
                  : "border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md"
              }`}
            >
              <div className="relative h-40 overflow-hidden">
                <img
                  src={image}
                  alt={label}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className={`absolute inset-0 transition-colors duration-300 ${
                  isSelected ? "bg-blue-500/20" : "bg-gradient-to-t from-black/40 to-transparent"
                }`} />
                {isSelected && (
                  <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
                    <CheckCircle className="h-5 w-5 fill-white text-blue-600" />
                  </div>
                )}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow-sm backdrop-blur-sm">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  {address}
                </div>
              </div>
              <div className="flex flex-col gap-1 px-5 py-4">
                <span
                  className={`text-base font-bold leading-tight transition-colors ${
                    isSelected ? "text-blue-700" : "text-gray-800"
                  }`}
                >
                  {label}
                </span>
                <span className="text-xs text-gray-400">
                  {isSelected ? "Sede seleccionada" : "Haz clic para elegir"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <button
        onClick={onNext}
        disabled={!selected}
        className={`mt-10 w-full cursor-pointer rounded-xl py-4 text-lg font-bold text-white shadow-md transition-all ${
          selected
            ? "bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200/50 active:scale-[0.98]"
            : "cursor-not-allowed bg-blue-300"
        }`}
      >
        Iniciar Reserva
      </button>
    </div>
  );
}