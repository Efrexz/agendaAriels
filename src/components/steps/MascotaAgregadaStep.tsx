import { motion } from "framer-motion";
import { CheckCircle, Heart, PawPrint, Scissors, Wind, Ruler, Droplets, Pencil, Plus, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import type { FormData, PetData } from "../BookingWizard";
import { formatExtraLabel } from "../../data/labels";

interface MascotaAgregadaStepProps {
  formData: FormData;
  update?: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext?: () => void;
  onBack?: () => void;
  onAddAnother: () => void;
  onContinue: () => void;
  continueLabel?: string;
  isEditing?: boolean;
}

const PET_TYPE_LABELS: Record<string, string> = { dog: "Perro", cat: "Gato" };
const SERVICE_LABELS: Record<string, string> = { bath: "Baño", bath_cut: "Baño + Corte", bath_deslanado: "Baño + Deslanado" };
const SIZE_LABELS: Record<string, string> = { small: "Pequeño", medium: "Mediano", large: "Grande" };
const PERFUME_LABELS: Record<string, string> = { fruital: "🍓 Frutal", floral: "🌸 Floral", fresco: "🍃 Fresco" };

export function MascotaAgregadaStep({ formData, onAddAnother, onContinue, onBack, continueLabel, isEditing }: MascotaAgregadaStepProps) {
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
    <div className="flex flex-col items-center gap-7 py-6">
      <div className="relative flex items-center justify-center">
        <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-amber-100/80 to-orange-200/50 blur-sm sm:h-56 sm:w-56" />
        <motion.span
          className="absolute left-0 top-2 text-orange-300/70 sm:left-2 sm:top-0"
          initial={{ y: 0 }}
          animate={{ y: [-3, 3, -3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Heart className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" />
        </motion.span>
        <motion.span
          className="absolute right-1 top-4 text-orange-200/80 sm:right-3"
          initial={{ y: 0 }}
          animate={{ y: [3, -3, 3] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
        </motion.span>
        <motion.span
          className="absolute bottom-3 left-3 text-orange-300/60 sm:bottom-2 sm:left-4"
          initial={{ y: 0 }}
          animate={{ y: [-2, 4, -2] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="currentColor" />
        </motion.span>
        <motion.span
          className="absolute bottom-5 right-4 text-orange-200/60 sm:bottom-4 sm:right-5"
          initial={{ y: 0 }}
          animate={{ y: [4, -4, 4] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <PawPrint className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </motion.span>
        <motion.img
          src="/images/vetMascot/copy.png"
          alt="Mascota agregada a la lista"
          className="relative z-10 h-48 w-48 object-contain sm:h-64 sm:w-64"
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
        <div className="absolute -bottom-1 -right-1 z-20 grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-green-500 shadow">
          <CheckCircle className="h-5 w-5 text-white" />
        </div>
      </div>
      <div className="text-center">
        <h2 className="text-step-title font-display font-bold tracking-tight text-gray-800">
          {isEditing ? "¡Mascota actualizada!" : "¡Mascota agregada!"}
        </h2>
        {!isEditing && (
          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            Hemos guardado la información de tu peludito correctamente.
          </p>
        )}
      </div>

      <div className="mx-auto flex w-fit max-w-full items-center gap-6 rounded-xl bg-gray-50 px-6 py-3 shadow-sm">
        <span className="inline-flex items-center gap-2 text-gray-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
            <PawPrint className="h-4 w-4 text-blue-600" />
          </span>
          <span className="text-base font-semibold sm:text-lg">
            {currentPet.petName || "Mascota"}
          </span>
        </span>
        {!isEditing && onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar información
          </button>
        )}
      </div>

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

      <div className="mt-4 flex w-full flex-col items-center gap-4">
        {!isEditing && (
          <button
            onClick={onAddAnother}
            className="w-full max-w-md cursor-pointer rounded-xl border-2 border-orange-500 bg-white py-4 text-base font-semibold text-orange-600 shadow-sm transition-all hover:bg-orange-50 hover:shadow-md active:scale-[0.98] inline-flex items-center justify-center gap-2"
          >
            <Plus className="h-5 w-5" /> Agregar otra mascota
          </button>
        )}
        <button
          onClick={onContinue}
          className="w-full max-w-md cursor-pointer rounded-xl bg-gradient-to-r from-blue-600 to-orange-400 py-4 text-base font-semibold text-white shadow-md transition-all hover:shadow-lg hover:shadow-blue-200/50 active:scale-[0.98] inline-flex items-center justify-center gap-2"
        >
          {continueLabel ?? "Continuar con el recojo"} <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      <div className="flex w-full items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50 px-6 py-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
        </span>
        <div>
          <p className="text-base font-semibold text-gray-800">Tu mascota está en buenas manos</p>
          <p className="mt-0.5 text-sm leading-relaxed text-gray-500">
            Contamos con un equipo profesional comprometido con el bienestar y cuidado de tu mejor amigo.
          </p>
        </div>
      </div>
    </div>
  );
}