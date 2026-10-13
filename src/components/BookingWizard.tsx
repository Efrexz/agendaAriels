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
import { WelcomeBackStep } from "./steps/WelcomeBackStep";
import { WhatsAppButton } from "./WhatsAppButton";
import { BRANCH_BY_VALUE } from "../data/branches";
import type { FormData } from "../state/wizardReducer";
import {
  wizardReducer,
  createInitialState,
  type StepId,
} from "../state/wizardReducer";
import { INITIAL_FORM_DATA } from "../state/wizardReducer";
import {
  loadClientProfile,
  overwriteClientProfile,
} from "../services/clientProfile";
export type { ExtraService, PetData, FormData } from "../state/wizardReducer";

/** Steps que muestran la barra de progreso ("Paso X de Y"). */
const PROGRESS_STEPS: StepId[] = [
  "welcome", "branch", "petType", "petInfo", "size", "petAdded", "schedule", "owner", "review",
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
  welcome: "Bienvenida",
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
  const [state, dispatch] = useReducer(wizardReducer, undefined, () => createInitialState(loadClientProfile));
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state.step]);

  const StepComponent = state.step === "welcome" ? null : STEP_COMPONENTS[state.step];
  const progressIndex = PROGRESS_STEPS.indexOf(state.step);
  const totalSteps = PROGRESS_STEPS.length;
  const progress = progressIndex >= 0 ? ((progressIndex + 1) / totalSteps) * 100 : 0;

  const update = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    dispatch({ type: "UPDATE_FIELD", field, value });
  };

  /**
   * Candado anti doble-click: si el usuario golpea "Continuar/Siguiente/Volver"
   * en milésimas, solo la primera transición pasa (evita saltarse pasos).
   */
  const transitionLock = useRef(0);
  const guardTransition = (action: Parameters<typeof dispatch>[0]) => {
    const now = Date.now();
    if (now - transitionLock.current < 400) return;
    transitionLock.current = now;
    dispatch(action);
  };

  const branch = state.formData.branch ? BRANCH_BY_VALUE[state.formData.branch] : null;

  return (
    <div className="flex min-h-screen items-center justify-center p-2 pb-24 sm:p-4 sm:pb-28">
      <div ref={cardRef} className="w-full max-w-2xl lg:max-w-5xl 2xl:max-w-6xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="h-3 bg-gradient-to-r from-blue-500 to-orange-400" />
        <div className="p-4 sm:p-6 lg:p-10">
          {/* Brand Header */}
          <div className="mb-1">
            <div className="flex items-center justify-between">
              <img
                src="/logo.webp"
                alt="Veterinaria Ariel"
                className="h-12 sm:h-14 lg:h-16"
              />
              <div className="hidden items-center gap-3 rounded-2xl bg-gradient-to-r from-[#FFF7ED] to-[#FFFDF8] py-2 pl-2.5 pr-4 shadow-sm ring-1 ring-orange-200/70 sm:flex">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-orange-100">
                <PawPrint className="h-5 w-5 text-orange-500" />
              </span>
              <div className="text-left leading-tight">
                <p className="text-[13px] font-bold text-[#475AAB]">Más de 10 años</p>
                <p className="text-[11px] text-[#546A8E]">cuidando la salud de tu mascota</p>
              </div>
            </div>
            </div>
            <div className="mt-3 sm:mt-4 h-px w-full bg-[#E7E2D8]" />
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-500">
              <span className="flex items-center gap-2 font-medium text-gray-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {progressIndex + 1}
                </span>
                <span>Paso {progressIndex + 1} de {totalSteps}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                <Pencil className="h-3 w-3" />
                {STEP_LABELS[state.step]}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-orange-400 transition-all duration-300 ease-out"
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
                {StepComponent ? (
                  <StepComponent
                    formData={state.formData}
                    update={update}
                    onNext={() => guardTransition({ type: "NEXT" })}
                    onBack={() => guardTransition({ type: "BACK" })}
                    onAddAnother={
                      state.step === "review"
                        ? () => guardTransition({ type: "ADD_FROM_CONFIRMATION" })
                        : () => guardTransition({ type: "ADD_ANOTHER" })
                    }
                    onContinue={() => guardTransition({ type: "CONTINUE" })}
                    onRemovePet={state.step === "review" ? (index: number) => dispatch({ type: "REMOVE_PET", index }) : undefined}
                    onEditPet={state.step === "review" ? (index: number) => dispatch({ type: "EDIT_PET", index }) : undefined}
                    {...(state.mode === "editing"
                      ? { continueLabel: "Finalizar edición", isEditing: true }
                      : state.mode === "addingFromSummary"
                        ? { continueLabel: "Finalizar y volver al resumen" }
                        : {})}
                  />
                ) : (
                  <WelcomeBackStep
                    formData={state.formData}
                    savedPets={state.profilePets.length > 0 ? state.profilePets : state.formData.pets}
                    update={update}
                    onUseProfile={(pets) => dispatch({ type: "USE_PROFILE", pets })}
                    onAddPet={() => dispatch({ type: "ADD_PET_FROM_WELCOME" })}
                    onEditOwner={() => guardTransition({ type: "EDIT_OWNER" })}
                    onStartBooking={() => dispatch({ type: "START_BOOKING" })}
                    onStartFresh={() => dispatch({ type: "START_FRESH", formData: INITIAL_FORM_DATA })}
                    onRemoveSavedPet={(index) => {
                      const remaining = state.profilePets.filter((_, i) => i !== index);
                      // El borrado se persiste de inmediato: aunque recargue o
                      // cierre, la mascota no reaparece.
                      overwriteClientProfile(state.formData, remaining);
                      dispatch({ type: "DELETE_SAVED_PET", index });
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {state.step !== "branch" && state.step !== "welcome" && (
            <button
              onClick={() => guardTransition({ type: "BACK" })}
              className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-all hover:border-gray-300 hover:text-gray-800 hover:shadow-md"
            >
              <ChevronLeft className="h-4 w-4" />
              Volver atrás
            </button>
          )}
        </div>
      </div>

      {branch && <WhatsAppButton phone={branch.phone} />}
    </div>
  );
}
