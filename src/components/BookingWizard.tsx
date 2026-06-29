import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { BranchSelectionStep } from "./steps/BranchSelectionStep";
import { ServiceTypeStep } from "./steps/ServiceTypeStep";
import { PetInfoStep } from "./steps/PetInfoStep";
import { OwnerInfoStep } from "./steps/OwnerInfoStep";
import { MascotaAgregadaStep } from "./steps/MascotaAgregadaStep";
import { ScheduleStep } from "./steps/ScheduleStep";
import { AddonsStep } from "./steps/AddonsStep";
import { ReviewStep } from "./steps/ReviewStep";
import { ConfirmationStep } from "./steps/ConfirmationStep";

export interface PetData {
  petType: "dog" | "cat";
  service: "bath" | "bath_cut";
  extraServices: string[];
  size: "small" | "medium" | "large" | "giant";
  coat: "normal" | "knotted";
  petNotes: string;
  petName: string;
  corteType: "rapado" | "rebaje" | "tijera" | null;
  corteSpecs: string;
  corteImage: string;
  bathType: "hidratado_premium" | "medicado" | "tradicional" | null;
  perfume: "fruital" | "floral" | "fresco" | null;
}

export interface FormData {
  branch: "san_martin" | "los_olivos" | "san_miguel" | null;
  petType: "dog" | "cat" | null;
  service: "bath" | "bath_cut" | null;
  extraServices: string[];
  size: "small" | "medium" | "large" | "giant" | null;
  coat: "normal" | "knotted";
  petNotes: string;
  petName: string;
  corteType: "rapado" | "rebaje" | "tijera" | null;
  corteSpecs: string;
  corteImage: string;
  bathType: "hidratado_premium" | "medicado" | "tradicional" | null;
  perfume: "fruital" | "floral" | "fresco" | null;
  pets: PetData[];
  date: string | null;
  timeRange: "9-11" | "11-14" | null;
  ownerName: string;
  ownerPhone: string;
  ownerAddress: string;
  ownerLat: number | null;
  ownerLng: number | null;
  hasHistory: boolean | null;
  ownerDni: string;
  registeredPetName: string;
  registeredPhone: string;
  petBirthDate: string;
  petSpecies: "dog" | "cat" | null;
  petBreed: string;
  petCastrated: boolean;
  mobilityPhoneDifferent: boolean;
  mobilityPhone: string;
}

const INITIAL_PET_FIELDS = {
  petType: null as "dog" | "cat" | null,
  service: null as "bath" | "bath_cut" | null,
  extraServices: [] as string[],
  size: null as "small" | "medium" | "large" | "giant" | null,
  coat: "normal" as "normal" | "knotted",
  petNotes: "",
  petName: "",
  corteType: null as "rapado" | "rebaje" | "tijera" | null,
  corteSpecs: "",
  corteImage: "",
  bathType: null as "hidratado_premium" | "medicado" | "tradicional" | null,
  perfume: null as "fruital" | "floral" | "fresco" | null,
};

const STEPS = [
  BranchSelectionStep,
  ServiceTypeStep,
  PetInfoStep,
  OwnerInfoStep,
  MascotaAgregadaStep,
  ScheduleStep,
  AddonsStep,
  ReviewStep,
  ConfirmationStep,
] as const;

const STEP_LABELS = [
  "Sede",
  "Tipo de mascota",
  "Servicio",
  "Tamaño",
  "Mascota Agregada",
  "Fecha",
  "Horario",
  "Tus datos",
  "Resumen",
];

export function BookingWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    ...INITIAL_PET_FIELDS,
    branch: null,
    corteType: null,
    corteSpecs: "",
    corteImage: "",
    bathType: null,
    perfume: null,
    pets: [],
    date: null,
    timeRange: null,
    ownerName: "",
    ownerPhone: "",
    ownerAddress: "",
    ownerLat: null,
    ownerLng: null,
    hasHistory: null,
    ownerDni: "",
    registeredPetName: "",
    registeredPhone: "",
    petBirthDate: "",
    petSpecies: null,
    petBreed: "",
    petCastrated: false,
    mobilityPhoneDifferent: false,
    mobilityPhone: "",
  });

  const StepComponent = STEPS[currentStep];
  const totalSteps = STEPS.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const saveCurrentPet = () => {
    if (!formData.petType || !formData.service || !formData.size) return;
    const pet: PetData = {
      petType: formData.petType,
      service: formData.service,
      extraServices: formData.extraServices,
      size: formData.size,
      coat: formData.coat,
      petNotes: formData.petNotes,
      petName: formData.petName,
      corteType: formData.corteType,
      corteSpecs: formData.corteSpecs,
      corteImage: formData.corteImage,
      bathType: formData.bathType,
      perfume: formData.perfume,
    };
    setFormData((prev) => ({ ...prev, pets: [...prev.pets, pet] }));
  };

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => {
      if (prev === 5) {
        setFormData((f) => ({ ...f, pets: f.pets.slice(0, -1) }));
        return 3;
      }
      return Math.max(prev - 1, 0);
    });
  };

  const handleAddAnother = () => {
    saveCurrentPet();
    setFormData((prev) => ({ ...prev, ...INITIAL_PET_FIELDS }));
    setCurrentStep(1);
  };

  const handleContinue = () => {
    saveCurrentPet();
    setCurrentStep(5);
  };

  const update = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border-t-4 border-t-orange-500 bg-white shadow-xl">
        <div className="p-6 sm:p-8">
          {/* Brand Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-lg font-bold text-white shadow-sm shadow-orange-200">
                AC
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight tracking-tight text-[#1A2238]">
                  Ariels Clinics
                </h1>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-orange-500">
                  Estilismo &amp; Bienestar
                </p>
              </div>
            </div>
            <div className="mt-4 h-px w-full bg-[#E7E2D8]" />
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-500">
              <span className="flex items-center gap-2 font-medium text-gray-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {currentStep + 1}
                </span>
                <span>Paso {currentStep + 1} de {totalSteps}</span>
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {STEP_LABELS[currentStep]}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-orange-400 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <StepComponent
                  formData={formData}
                  update={update}
                  onNext={handleNext}
                  onBack={handleBack}
                  onAddAnother={handleAddAnother}
                  onContinue={handleContinue}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {currentStep > 0 && (
            <button
              onClick={handleBack}
              className="mt-8 flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-orange-600"
            >
              <ChevronLeft className="h-4 w-4" />
              Volver atrás
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
