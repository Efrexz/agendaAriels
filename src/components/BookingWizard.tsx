import { useReducer, useEffect, useRef } from "react";
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
import type { FormData } from "../state/wizardReducer";
import {
  wizardReducer,
  INITIAL_STATE,
  type StepId,
} from "../state/wizardReducer";
export type { ExtraService, PetData, FormData } from "../state/wizardReducer";

const STEP_ORDER: StepId[] = [
  "branch", "petType", "petInfo", "size", "petAdded", "schedule", "owner", "review",
];

const STEP_COMPONENTS = {
  branch: BranchSelectionStep,
  petType: ServiceTypeStep,
  petInfo: PetInfoStep,
  size: OwnerInfoStep,
  petAdded: MascotaAgregadaStep,
  schedule: ScheduleStep,
  owner: ReviewStep,
  review: ConfirmationStep,
} as const;

const STEP_LABELS: Record<StepId, string> = {
  branch: "Sede",
  petType: "Tipo de mascota",
  petInfo: "Servicio",
  size: "Tamaño",
  petAdded: "Mascota Agregada",
  schedule: "Fecha y horario",
  owner: "Tus datos",
  review: "Resumen",
};

export function BookingWizard() {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state.step]);

  const StepComponent = STEP_COMPONENTS[state.step];
  const stepIndex = STEP_ORDER.indexOf(state.step);
  const totalSteps = STEP_ORDER.length;
  const progress = ((stepIndex + 1) / totalSteps) * 100;

  const update = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    dispatch({ type: "UPDATE_FIELD", field, value });
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
                  {stepIndex + 1}
                </span>
                <span>Paso {stepIndex + 1} de {totalSteps}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                <Pencil className="h-3 w-3" />
                {STEP_LABELS[state.step]}
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
                key={state.step}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <StepComponent
                  formData={state.formData}
                  update={update}
                  onNext={() => dispatch({ type: "NEXT" })}
                  onBack={() => dispatch({ type: "BACK" })}
                  onAddAnother={state.step === "review" ? () => dispatch({ type: "ADD_FROM_CONFIRMATION" }) : () => dispatch({ type: "ADD_ANOTHER" })}
                  onContinue={() => dispatch({ type: "CONTINUE" })}
                  onRemovePet={state.step === "review" ? (index: number) => dispatch({ type: "REMOVE_PET", index }) : undefined}
                  onEditPet={state.step === "review" ? (index: number) => dispatch({ type: "EDIT_PET", index }) : undefined}
                  {...(state.mode !== "initial" ? { continueLabel: state.mode === "editing" ? "Finalizar edición" : "Finalizar y volver al resumen", isEditing: state.mode === "editing" } : {})}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {state.step !== "branch" && (
            <button
              onClick={() => dispatch({ type: "BACK" })}
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
