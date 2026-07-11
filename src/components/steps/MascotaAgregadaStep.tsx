import { CheckCircle, PawPrint, Scissors, Wind, Ruler, Droplets } from "lucide-react";
import type { FormData, PetData } from "../BookingWizard";
import { formatExtraLabel } from "../../data/labels";

interface MascotaAgregadaStepProps {
  formData: FormData;
  update?: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext?: () => void;
  onBack?: () => void;
  onAddAnother: () => void;
  onContinue: () => void;
}

const PET_TYPE_LABELS: Record<string, string> = { dog: "Perro", cat: "Gato" };
const SERVICE_LABELS: Record<string, string> = { bath: "Baño", bath_cut: "Baño + Corte", bath_deslanado: "Baño + Deslanado" };
const SIZE_LABELS: Record<string, string> = { small: "Pequeño", medium: "Mediano", large: "Grande" };
const PERFUME_LABELS: Record<string, string> = { fruital: "🍓 Frutal", floral: "🌸 Floral", fresco: "🍃 Fresco" };

export function MascotaAgregadaStep({ formData, onAddAnother, onContinue }: MascotaAgregadaStepProps) {
  const currentPet: PetData = {
    petType: formData.petType ?? "dog",
    service: formData.service ?? "bath",
    extraServices: formData.extraServices ?? [],
    size: formData.petType === "cat" ? null : (formData.size ?? "small"),
    coat: formData.coat ?? "normal",
    petNotes: formData.petNotes,
    petName: formData.petName,
    corteType: formData.corteType,
    corteSpecs: formData.corteSpecs,
    corteImage: formData.corteImage,
    bathType: formData.bathType,
    perfume: formData.perfume,
  };

  const extraSummary =
    currentPet.extraServices.length > 0
      ? currentPet.extraServices.map(formatExtraLabel).join(", ")
      : null;

  const sizeSegment = currentPet.petType === "cat" || !currentPet.size ? null : SIZE_LABELS[currentPet.size];

  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-blue-100/60" />
        <CheckCircle className="relative h-20 w-20 text-blue-600 sm:h-24 sm:w-24" />
      </div>
      <h2 className="text-center text-[var(--text-step-title)] font-display font-bold tracking-tight text-gray-800">
        ¡Mascota agregada!
      </h2>
      <p className="text-center text-lg font-semibold text-gray-700">
        {currentPet.petName || "Mascota"}
      </p>

      <div className="flex w-full flex-wrap justify-center gap-2 sm:gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:text-sm">
          <PawPrint className="h-3.5 w-3.5" />
          {PET_TYPE_LABELS[currentPet.petType]}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:text-sm">
          {currentPet.service === "bath" ? <Droplets className="h-3.5 w-3.5" /> : currentPet.service === "bath_deslanado" ? <Wind className="h-3.5 w-3.5" /> : <Scissors className="h-3.5 w-3.5" />}
          {SERVICE_LABELS[currentPet.service]}
        </span>
        {sizeSegment && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 sm:text-sm">
            <Ruler className="h-3.5 w-3.5" />
            {sizeSegment}
          </span>
        )}
        {currentPet.perfume && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-700 sm:text-sm">
            {PERFUME_LABELS[currentPet.perfume]}
          </span>
        )}
        {extraSummary && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-700 sm:text-sm">
            {extraSummary}
          </span>
        )}
      </div>

      <div className="mt-2 flex w-full flex-col gap-4">
        <button
          onClick={onAddAnother}
          className="w-full cursor-pointer rounded-xl border-2 border-orange-500 bg-white py-4 text-lg font-semibold text-orange-600 shadow-sm transition-all hover:bg-orange-50 hover:shadow-md active:scale-[0.98]"
        >
          Agregar otra mascota
        </button>
        <button
          onClick={onContinue}
          className="w-full cursor-pointer rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200/50 active:scale-[0.98]"
        >
          Continuar con el recojo
        </button>
      </div>
    </div>
  );
}