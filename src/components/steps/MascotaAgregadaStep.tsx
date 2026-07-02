import { CheckCircle } from "lucide-react";
import type { FormData, PetData } from "../BookingWizard";

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
const EXTRA_LABELS: Record<string, string> = { deworming: "Desparasitación", antiflea: "Antipulgas", vaccine: "Vacuna" };
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
      ? currentPet.extraServices.map((s) => EXTRA_LABELS[s] || s).join(", ")
      : null;

  const sizeSegment = currentPet.petType === "cat" || !currentPet.size ? null : SIZE_LABELS[currentPet.size];

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-blue-100/60" />
        <CheckCircle className="relative h-24 w-24 text-blue-600" />
      </div>
      <h2 className="text-center text-3xl font-bold tracking-tight text-gray-800">
        ¡Mascota agregada!
      </h2>
      <p className="max-w-md text-center text-gray-500">
        {currentPet.petName || "Mascota"} — {PET_TYPE_LABELS[currentPet.petType]} | {SERVICE_LABELS[currentPet.service]}
        {sizeSegment && <> | {sizeSegment}</>}
        {currentPet.perfume && <> | {PERFUME_LABELS[currentPet.perfume]}</>}
        {extraSummary && <> | {extraSummary}</>}
      </p>

      <div className="mt-4 flex w-full flex-col gap-4">
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