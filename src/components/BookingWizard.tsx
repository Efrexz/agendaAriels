import { useState, useRef, useEffect } from "react";

export interface ExtraService {
  service: string;
  variant?: string;
}
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, PawPrint, Pencil } from "lucide-react";
import { BranchSelectionStep } from "./steps/BranchSelectionStep";
import { ServiceTypeStep } from "./steps/ServiceTypeStep";
import { PetInfoStep } from "./steps/PetInfoStep";
import { OwnerInfoStep } from "./steps/OwnerInfoStep";
import { MascotaAgregadaStep } from "./steps/MascotaAgregadaStep";
import { ScheduleStep } from "./steps/ScheduleStep";
import { ReviewStep } from "./steps/ReviewStep";
import { ConfirmationStep } from "./steps/ConfirmationStep";

export interface PetData {
  petType: "dog" | "cat";
  service: "bath" | "bath_cut" | "bath_deslanado";
  extraServices: ExtraService[];
  size: "small" | "medium" | "large" | "giant" | null;
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
  service: "bath" | "bath_cut" | "bath_deslanado" | null;
  extraServices: ExtraService[];
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
  service: null as "bath" | "bath_cut" | "bath_deslanado" | null,
  extraServices: [] as ExtraService[],
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
  ReviewStep,
  ConfirmationStep,
] as const;

const STEP_LABELS = [
  "Sede",
  "Tipo de mascota",
  "Servicio",
  "Tamaño",
  "Mascota Agregada",
  "Fecha y horario",
  "Tus datos",
  "Resumen",
];

export function BookingWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [addFromConfirm, setAddFromConfirm] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentStep]);

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
    const isCat = formData.petType === "cat";
    if (!formData.petType || !formData.service || (!isCat && !formData.size)) return;
    const pet: PetData = {
      petType: formData.petType,
      service: formData.service,
      extraServices: formData.extraServices,
      size: isCat ? null : formData.size,
      coat: formData.coat,
      petNotes: formData.petNotes,
      petName: formData.petName,
      corteType: formData.corteType,
      corteSpecs: formData.corteSpecs,
      corteImage: formData.corteImage,
      bathType: formData.bathType,
      perfume: formData.perfume,
    };
    setFormData((prev) => ({
      ...prev,
      pets:
        editIndex !== null
          ? prev.pets.map((p, i) => (i === editIndex ? pet : p))
          : [...prev.pets, pet],
    }));
  };

  const handleNext = () => {
    setCurrentStep((prev) => {
      // Skip size step (3) for cats: from PetInfoStep (2) jump to MascotaAgregadaStep (4)
      if (prev === 2 && formData.petType === "cat") {
        return 4;
      }
      return Math.min(prev + 1, totalSteps - 1);
    });
  };

  const handleBack = () => {
    // Si estaba agregando o editando una mascota desde el resumen, cancelar el modo:
    // descartar cambios y volver directamente al resumen (paso 8).
    if (addFromConfirm) {
      setAddFromConfirm(false);
      setEditIndex(null);
      setFormData((f) => ({ ...f, ...INITIAL_PET_FIELDS }));
      setCurrentStep(7);
      return;
    }
    setCurrentStep((prev) => {
      if (prev === 5) {
        setFormData((f) => ({ ...f, pets: f.pets.slice(0, -1) }));
        // From ScheduleStep (5) go back to size (3) for dogs, or to PetInfoStep (2) for cats
        return formData.petType === "cat" ? 2 : 3;
      }
      // From MascotaAgregadaStep (4) back to size (3) for dogs, or to PetInfoStep (2) for cats
      if (prev === 4 && formData.petType === "cat") {
        return 2;
      }
      const next = Math.max(prev - 1, 0);
      if (next <= 1) {
        setFormData((f) => ({ ...f, ...INITIAL_PET_FIELDS }));
      }
      return next;
    });
  };

  const handleContinue = () => {
    saveCurrentPet();
    if (addFromConfirm) {
      // Venía agregando o editando una mascota desde el resumen: volver directo al resumen.
      setAddFromConfirm(false);
      setEditIndex(null);
      setCurrentStep(7);
    } else {
      setCurrentStep(5);
    }
  };

  const handleAddAnother = () => {
    saveCurrentPet();
    setFormData((prev) => ({ ...prev, ...INITIAL_PET_FIELDS }));
    setEditIndex(null);
    setCurrentStep(1);
  };

  const handleAddAnotherFromConfirmation = () => {
    setFormData((prev) => ({ ...prev, ...INITIAL_PET_FIELDS }));
    setAddFromConfirm(true);
    setEditIndex(null);
    setCurrentStep(1);
  };

  const handleEditPet = (index: number) => {
    const pet = formData.pets[index];
    if (!pet) return;
    setFormData((prev) => ({
      ...prev,
      ...INITIAL_PET_FIELDS,
      petType: pet.petType,
      service: pet.service,
      extraServices: pet.extraServices,
      size: pet.size,
      coat: pet.coat,
      petNotes: pet.petNotes,
      petName: pet.petName,
      corteType: pet.corteType,
      corteSpecs: pet.corteSpecs,
      corteImage: pet.corteImage,
      bathType: pet.bathType,
      perfume: pet.perfume,
    }));
    setEditIndex(index);
    setAddFromConfirm(true);
    setCurrentStep(2);
  };

  const handleRemovePet = (index: number) => {
    setFormData((prev) => ({ ...prev, pets: prev.pets.filter((_, i) => i !== index) }));
    if (editIndex === index) setEditIndex(null);
  };

  const update = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-2 sm:p-4">
      <div ref={cardRef} className="w-full max-w-2xl lg:max-w-5xl 2xl:max-w-6xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="h-3 bg-gradient-to-r from-blue-500 to-orange-400" />
        <div className="p-4 sm:p-6 lg:p-10">
          {/* Brand Header */}
          <div className="mb-1">
            <div className="flex items-center justify-between">
              <img
                src="/logo.webp"
                alt="Veterinaria Ariel"
                className="h-16 sm:h-20 lg:h-24"
              />
              <div className="hidden items-center gap-3 rounded-xl bg-[#FBF8F4] px-4 py-2.5 sm:flex">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  <PawPrint className="h-5 w-5 text-orange-500" />
                </span>
                <div className="text-right text-xs leading-snug text-gray-700">
                  <span className="font-semibold">Más de 10 años</span>
                  <br />
                  cuidando la salud de tu mascota
                </div>
              </div>
            </div>
            <div className="mt-3 sm:mt-4 h-px w-full bg-[#E7E2D8]" />
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-500">
              <span className="flex items-center gap-2 font-medium text-gray-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {currentStep + 1}
                </span>
                <span>Paso {currentStep + 1} de {totalSteps}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                <Pencil className="h-3 w-3" />
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
                  onAddAnother={currentStep === 7 ? handleAddAnotherFromConfirmation : handleAddAnother}
                  onContinue={handleContinue}
                  onRemovePet={currentStep === 7 ? handleRemovePet : undefined}
                  onEditPet={currentStep === 7 ? handleEditPet : undefined}
                  {...(addFromConfirm ? { continueLabel: editIndex !== null ? "Finalizar edición" : "Finalizar y volver al resumen", isEditing: editIndex !== null } : {})}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {currentStep > 0 && (
            <button
              onClick={handleBack}
              className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-all hover:border-gray-300 hover:text-gray-800 hover:shadow-md"
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
