import { MapPin, Check, Clock, Phone, ArrowRight, CalendarDays, ShieldCheck, Heart, Car } from "lucide-react";
import type { FormData } from "../BookingWizard";
import { BRANCHES, isBranchOpen } from "../../data/branches";
import { LazyImage } from "../LazyImage";

interface BranchSelectionStepProps {
  formData: FormData;
  update: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext: () => void;
}

const TRUST_BADGES = [
  {
    icon: ShieldCheck,
    title: "Atención profesional",
    description: "Veterinarios altamente capacitados",
    color: "text-blue-600",
  },
  {
    icon: Heart,
    title: "Amor y cuidado",
    description: "Tratamos a tu mascota como parte de la familia",
    color: "text-orange-500",
  },
  {
    icon: Car,
    title: "Movilidad segura",
    description: "Recojo y traslado seguro de tu mascota",
    color: "text-blue-600",
  },
];

export function BranchSelectionStep({ formData, update, onNext }: BranchSelectionStepProps) {
  const selected = formData.branch;

  return (
    <div>
      <h2 className="mb-2 text-center text-[var(--text-step-title)] font-display font-bold tracking-tight text-gray-800">
        Selecciona tu sede{" "}
        <span className="text-blue-600 underline decoration-orange-400 decoration-2 underline-offset-[3px]">
          más cercana
        </span>
      </h2>
      <p className="mb-6 sm:mb-8 text-center text-sm text-gray-500">
        Elige la veterinaria donde atenderemos a tu mascota
      </p>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
        {BRANCHES.map((branch) => {
          const isSelected = selected === branch.value;
          const open = isBranchOpen(branch);
          const district = branch.label.replace("Sede ", "");

          return (
            <button
              key={branch.value}
              type="button"
              onClick={() => update("branch", branch.value)}
              aria-pressed={isSelected}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98] ${
                isSelected
                  ? "border-blue-500 shadow-lg shadow-blue-200/50"
                  : "border-gray-200 shadow-sm hover:border-blue-300"
              }`}
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <LazyImage
                  src={branch.image}
                  alt={branch.label}
                  className="transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div
                  className={`absolute inset-0 transition-opacity duration-300 ${
                    isSelected ? "bg-blue-900/10" : "bg-transparent"
                  }`}
                />
                <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur-sm">
                  <MapPin className="h-3 w-3 text-blue-600" />
                  {district}
                </div>
                <div
                  className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-colors ${
                    isSelected ? "bg-blue-600 text-white" : "bg-white/80 backdrop-blur-sm text-gray-300"
                  }`}
                >
                  {isSelected && <Check className="h-4 w-4" strokeWidth={3} />}
                </div>
              </div>

              <div className="flex flex-col gap-2 px-4 py-3 sm:px-5 sm:py-4">
                <span
                  className={`text-lg font-bold leading-tight transition-colors ${
                    isSelected ? "text-blue-700" : "text-gray-800"
                  }`}
                >
                  {branch.label}
                </span>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-sm text-gray-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    <span className="truncate">{branch.address}</span>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${
                      open ? "text-green-600" : "text-gray-400"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${open ? "bg-green-500" : "bg-gray-300"}`} />
                    {open ? "Abierto ahora" : "Cerrado"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  {branch.hours}
                </div>

                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  {branch.phone}
                </div>

                <span
                  className={`mt-2 flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                    isSelected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-blue-200 text-blue-700 group-hover:border-blue-400 group-hover:bg-blue-50"
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check className="h-4 w-4" strokeWidth={3} />
                      Sede seleccionada
                    </>
                  ) : (
                    <>
                      Seleccionar sede
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="relative mt-6">
        <div className="rounded-2xl bg-[#E9EDF9] p-3 sm:p-5 sm:pr-36 md:pr-44">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:divide-x sm:divide-[#CBD4E8]">
            {TRUST_BADGES.map(({ icon: Icon, title, description, color }) => (
              <div key={title} className="flex items-center gap-3 rounded-xl px-3 py-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  <Icon className={`h-5 w-5 ${color}`} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                  <p className="text-xs text-gray-500">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-end justify-end sm:absolute sm:-bottom-8 sm:right-0 sm:mt-0">
          <div className="relative mb-10 max-w-[160px] rounded-2xl bg-white px-3 py-2 text-xs font-medium leading-snug text-gray-600 shadow-md">
            ¿Elige tu sede mas cercana?
            <span className="absolute -right-1.5 bottom-5 h-3 w-3 rotate-45 bg-white" />
          </div>
          <img
            src="/images/vetMascot/copy.png"
            alt="Asistente veterinario"
            className="h-24 sm:h-28 lg:h-32 select-none"
          />
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!selected}
        className={`mt-6 sm:mt-8 flex w-full items-center rounded-2xl p-4 text-left transition-all ${
          selected
            ? "cursor-pointer bg-gradient-to-r from-blue-600 to-orange-400 shadow-md hover:shadow-lg active:scale-[0.98]"
            : "cursor-not-allowed bg-gray-300"
        }`}
      >
        <span
          className={`mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            selected ? "bg-white/20" : "bg-white/30"
          }`}
        >
          <CalendarDays className={`h-5 w-5 ${selected ? "text-white" : "text-gray-400"}`} />
        </span>
        <div className="flex-1 text-left">
          <span className={`text-lg font-bold ${selected ? "text-white" : "text-gray-500"}`}>
            Iniciar Reserva
          </span>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
            selected ? "bg-white text-blue-600 shadow" : "bg-gray-400 text-white"
          }`}
        >
          <ArrowRight className="h-5 w-5" />
        </span>
      </button>
    </div>
  );
}
