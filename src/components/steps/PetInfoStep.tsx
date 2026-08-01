import { useState } from "react";
import { motion } from "framer-motion";
import { ShowerHead, Scissors, Wind, ChevronRight, Lock, PawPrint, ArrowRight } from "lucide-react";
import type { FormData } from "../BookingWizard";
import { ErrorModal } from "../ErrorModal";
import { LazyImage } from "../LazyImage";
import { uploadFile } from "../../services/uploadImage";
import { validatePetDraft } from "../../state/schemas";
import { BathTypePicker } from "./petInfo/BathTypePicker";
import { ExtraServicesPicker } from "./petInfo/ExtraServicesPicker";
import { CorteSection } from "./petInfo/CorteSection";
import { PerfumePicker } from "./petInfo/PerfumePicker";

interface PetInfoStepProps {
  formData: FormData;
  update: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext: () => void;
}

const DOG_SERVICE_OPTIONS = [
  { value: "bath" as const, label: "Baño", icon: ShowerHead, image: "/images/servicios/dog/bath.webp", alt: "Mascota recibiendo baño" },
  { value: "bath_cut" as const, label: "Baño y Corte", icon: Scissors, image: "/images/servicios/dog/bath-cut.webp", alt: "Mascota con corte de pelaje de estilo" },
];

const CAT_SERVICE_OPTIONS = [
  { value: "bath" as const, label: "Baño", icon: ShowerHead, image: "/images/servicios/cat/bath.webp", alt: "Mascota recibiendo baño" },
  { value: "bath_deslanado" as const, label: "Baño y Deslanado", icon: Wind, image: "/images/servicios/cat/bath-deslanado.webp", alt: "Mascota recibiendo baño y deslanado" },
];

export function PetInfoStep({ formData, update, onNext }: PetInfoStepProps) {
  const [errors, setErrors] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isCat = formData.petType === "cat";
  const SERVICE_OPTIONS = isCat ? CAT_SERVICE_OPTIONS : DOG_SERVICE_OPTIONS;
  const showCorte = formData.service === "bath_cut";

  const invalidPetName = !formData.petName || formData.petName.trim().length < 3;
  const invalidService = !formData.service;
  const invalidBathType = !formData.bathType;
  const invalidCorteType = showCorte && !formData.corteType;

  const clearErrors = () => {
    if (showModal) setShowModal(false);
    if (errors.length > 0) setErrors([]);
  };

  const handleContinue = () => {
    const validationErrors = validatePetDraft({
      petName: formData.petName,
      service: formData.service,
      bathType: formData.bathType,
      corteType: formData.corteType,
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setShowModal(true);
      return;
    }
    setErrors([]);
    onNext();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    setIsUploading(true);
    setUploadError(null);

    uploadFile(file).then((url) => {
      setIsUploading(false);
      if (url) {
        update("corteImage", url);
      } else {
        setUploadError("No se pudo subir la imagen. Intenta de nuevo.");
      }
    });
  };

  const handleRemoveImage = () => {
    update("corteImage", "");
    setUploadError(null);
    setIsUploading(false);
  };

  const toggleExtra = (service: string) => {
    const current = formData.extraServices || [];
    if (current.some((s) => s.service === service)) {
      update("extraServices", current.filter((s) => s.service !== service));
    } else {
      update("extraServices", [...current, { service }]);
    }
  };

  const selectExtraVariant = (service: string, variant: string, exclusive: boolean) => {
    const current = formData.extraServices || [];
    if (exclusive) {
      update("extraServices", current.map((s) => (s.service === service ? { service, variant } : s)));
    } else {
      const exists = current.some((s) => s.service === service && s.variant === variant);
      if (exists) {
        const filtered = current.filter((s) => !(s.service === service && s.variant === variant));
        update("extraServices", filtered.length === 0 ? current.filter((s) => s.service !== service) : filtered);
      } else {
        update("extraServices", [...current, { service, variant }]);
      }
    }
  };

  return (
    <div>
      {/* Pet Name Input */}
      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium text-[#1A2238]">
          Nombre de la mascota
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500">
            <PawPrint className="h-5 w-5" />
          </span>
          <motion.input
            type="text"
            value={formData.petName || ""}
            onChange={(e) => { clearErrors(); update("petName", e.target.value); }}
            placeholder="Ej: Firulais"
            animate={invalidPetName && errors.length > 0 ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            className={`w-full rounded-xl border py-3 pl-12 pr-4 text-lg text-gray-800 outline-none transition-colors focus:ring-2 lg:py-4 ${
              invalidPetName && errors.length > 0 ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
            }`} />
        </div>
      </div>

      {/* Service Selection: Bath or Bath+Cut */}
      <div className="mb-6 sm:mb-8 text-center">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
          Servicio principal
        </p>
        <h2 className="text-step-title font-display font-bold tracking-tight text-[#1A2238]">
          ¿Qué servicio necesita?
        </h2>
        <p className="mt-2 text-sm text-gray-500 sm:text-base">
          Elige el servicio principal que deseas para tu mascota
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        {SERVICE_OPTIONS.map(({ value, label, icon: Icon, image, alt }) => {
          const selected = formData.service === value;
          const hasErr = invalidService && errors.length > 0;
          return (
            <motion.button
              key={value} type="button"
              animate={hasErr ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              onClick={() => {
                clearErrors();
                update("service", value);
                if (value !== "bath_cut") {
                  update("corteType", null);
                  update("corteSpecs", "");
                  update("corteImage", "");
                }
              }}
              aria-pressed={selected}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98] ${
                selected
                  ? "border-blue-500 shadow-lg shadow-blue-100"
                  : hasErr ? "border-red-500 shadow-sm"
                  : "border-[#E7E2D8] shadow-sm hover:border-blue-300"
              }`}
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden">
                <LazyImage src={image} alt={alt}
                  className="transition-transform duration-500 ease-out group-hover:scale-105" />
                <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md">
                  <Icon className="h-5 w-5 text-blue-600" />
                </span>
              </div>

              <div className="flex flex-1 items-center justify-between gap-3 p-5 lg:gap-4 lg:p-7">
                <div className="flex flex-col">
                  <span className={`text-base font-semibold tracking-tight lg:text-lg ${selected ? "text-blue-700" : "text-[#1A2238]"}`}>
                    {label}
                  </span>
                  <span className="text-xs leading-snug text-gray-500 lg:text-sm">
                    {value === "bath_cut"
                      ? "Estilismo con corte de pelaje a elección"
                      : "Limpieza profunda con productos especializados"}
                  </span>
                </div>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  selected
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300 text-gray-400 group-hover:border-blue-300 group-hover:text-blue-400"
                }`}>
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Services detail card: Bath type + Extras + Perfume */}
      <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm lg:p-8">
        <BathTypePicker
          value={formData.bathType}
          onSelect={(v) => { clearErrors(); update("bathType", v); }}
          hasError={invalidBathType && errors.length > 0}
        />

        <div className="my-6 border-t border-slate-200" />

        <ExtraServicesPicker
          extraServices={formData.extraServices || []}
          petType={formData.petType}
          branch={formData.branch}
          onToggle={toggleExtra}
          onSelectVariant={selectExtraVariant}
        />

        <div className="my-6 border-t border-slate-200" />

        <PerfumePicker
          value={formData.perfume}
          onSelect={(v) => update("perfume", v)}
        />
      </div>

      {/* Corte Details (collapsible) */}
      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
        showCorte ? "mt-10 max-h-250 opacity-100" : "max-h-0 opacity-0"
      }`}>
        <CorteSection
          corteType={formData.corteType}
          corteSpecs={formData.corteSpecs}
          corteImage={formData.corteImage}
          hasError={invalidCorteType && errors.length > 0}
          isUploading={isUploading}
          uploadError={uploadError}
          onSelectCorte={(v) => { clearErrors(); update("corteType", v); }}
          onSpecsChange={(v) => update("corteSpecs", v)}
          onImageUpload={handleImageUpload}
          onRemoveImage={handleRemoveImage}
        />
      </div>

      {/* Observaciones de la mascota */}
      <div className="mt-10">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Observaciones de la mascota
        </label>
        <textarea
          rows={4}
          value={formData.petNotes}
          onChange={(e) => update("petNotes", e.target.value)}
          placeholder={isCat ? "Ej: Mi gato se pone nervioso con la secadora..." : "Ej: Mi perro se pone nervioso con la secadora..."}
          className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <button onClick={handleContinue}
        className="mt-10 w-full cursor-pointer rounded-xl bg-gradient-to-r from-blue-600 to-orange-400 py-4 text-lg font-bold text-white shadow-md transition-all hover:shadow-lg hover:shadow-blue-200/50 active:scale-[0.98] inline-flex items-center justify-center gap-2 lg:py-5 lg:text-xl">
        Continuar <ArrowRight className="h-5 w-5 lg:h-6 lg:w-6" />
      </button>
      <p className="mt-3 text-center text-xs text-gray-400">
        <Lock className="mr-1 inline-block h-3 w-3" />
        Tu información está segura con nosotros
      </p>

      <ErrorModal
        open={showModal}
        onClose={() => setShowModal(false)}
        errors={errors}
      />
    </div>
  );
}
