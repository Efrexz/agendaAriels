import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShowerHead, Scissors, Wind, Upload, Trash2, Sparkles, BriefcaseMedical, Droplets, Syringe, ShieldCheck, ChevronRight, Lock, Pill, PawPrint, ArrowRight } from "lucide-react";
import type { FormData } from "../BookingWizard";
import { ErrorModal } from "../ErrorModal";
import { LazyImage } from "../LazyImage";
import { EXTRA_VARIANT_LABELS } from "../../data/labels";

interface PetInfoStepProps {
  formData: FormData;
  update: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext: () => void;
}

const DOG_SERVICE_OPTIONS = [
  { value: "bath" as const, label: "Baño", icon: ShowerHead, image: "/images/servicios/dog/bath.webp", alt: "Mascota recibiendo baño" },
  {
    value: "bath_cut" as const,
    label: "Baño y Corte",
    icon: Scissors,
    image: "/images/servicios/dog/bath-cut.webp",
    alt: "Mascota con corte de pelaje de estilo",
  },
];

const CAT_SERVICE_OPTIONS = [
  { value: "bath" as const, label: "Baño", icon: ShowerHead, image: "/images/servicios/cat/bath.webp", alt: "Mascota recibiendo baño" },
  {
    value: "bath_deslanado" as const,
    label: "Baño y Deslanado",
    icon: Wind,
    image: "/images/servicios/cat/bath-deslanado.webp",
    alt: "Mascota recibiendo baño y deslanado",
  },
];

const BATH_OPTIONS = [
  { value: "hidratado_premium" as const, label: "Hidratado Premium", description: "Hidratación intensa con productos premium para un pelaje sedoso y brillante.", icon: Sparkles },
  { value: "medicado" as const, label: "Baño Medicado", description: "Tratamiento con shampoo medicado para pieles sensibles o con afecciones dermatológicas.", icon: BriefcaseMedical },
  { value: "tradicional" as const, label: "Baño Tradicional", description: "Limpieza general con productos estándar, ideal para mascotas sin condiciones especiales.", icon: Droplets },
];

const EXTRA_OPTIONS = [
  { value: "deworming", label: "Desparasitación", icon: Pill },
  { value: "antiflea", label: "Antipulgas", icon: ShieldCheck },
  { value: "vaccine", label: "Vacuna", icon: Syringe },
];

const CORTE_OPTIONS = [
  { value: "rapado" as const, label: "Corte Rapado" },
  { value: "rebaje" as const, label: "Rebaje Comercial (1 cm de largo parejo)" },
  { value: "tijera" as const, label: "Corte con Tijera / Estilo de la raza" },
];

type AntifleaProduct = {
  value: string;
  label: string;
  description: string;
  petTypes: readonly string[];
  requiresBranch?: string;
};

const ANTIFLEA_PRODUCTS_1M = [
  {
    name: "Pipetas",
    products: [
      { value: "1m_pipeta_fipforte", label: "Fip Forte", description: "Pipeta tópica mensual", petTypes: ["dog"] as const },
      {
        value: "1m_pipeta_xelamec",
        label: "Xelamec",
        description: "Pipeta tópica mensual. Solo para mascotas menores de 10 kg.",
        petTypes: ["dog", "cat"] as const,
      },
    ] satisfies AntifleaProduct[],
  },
  {
    name: "Pastillas",
    products: [
      { value: "1m_pastilla_atrevia", label: "Atrevia", description: "Comprimido oral mensual", petTypes: ["dog"] as const },
      { value: "1m_pastilla_simparica", label: "Simparica", description: "Comprimido oral mensual", petTypes: ["dog"] as const, requiresBranch: "san_miguel" },
    ] satisfies AntifleaProduct[],
  },
];

const VACCINE_OPTIONS_DOG = [
  { value: "sextuple", label: "Séxtuple", description: "Moquillo, parvovirus, hepatitis, parainfluenza, leptospira (2 serovares) y adenovirus." },
  { value: "rabia", label: "Antirrábica", description: "Protección obligatoria contra la rabia. Esquema anual." },
  { value: "kc", label: "KC (Tos de las perreras)", description: "Bordetella + parainfluenza. Recomendada si asiste a guardería o convive con otros." },
  { value: "leptospira", label: "Leptospira", description: "Refuerzo contra leptospirosis, relevante en zonas húmedas o con roedores." },
];

const VACCINE_OPTIONS_CAT = [
  { value: "triple_felina", label: "Triple Felina", description: "Calcivirus, panleucopenia y rinotraqueítis felina (herpesvirus)." },
  { value: "rabia", label: "Antirrábica", description: "Protección obligatoria contra la rabia. Esquema anual." },
];

export function PetInfoStep({ formData, update, onNext }: PetInfoStepProps) {
  const [errors, setErrors] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [antifleaDuration, setAntifleaDuration] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCat = formData.petType === "cat";
  const isSanMiguel = formData.branch === "san_miguel";
  const SERVICE_OPTIONS = isCat ? CAT_SERVICE_OPTIONS : DOG_SERVICE_OPTIONS;
  const VACCINE_OPTIONS = isCat ? VACCINE_OPTIONS_CAT : VACCINE_OPTIONS_DOG;

  const antifleaVariant = (formData.extraServices || []).find((s) => s.service === "antiflea")?.variant;
  const hasAntifleaProduct = !!antifleaVariant;

  const filtered1mSections = ANTIFLEA_PRODUCTS_1M
    .map((section) => ({
      name: section.name,
      products: section.products.filter((p: AntifleaProduct) => {
        if (p.requiresBranch && p.requiresBranch !== formData.branch) return false;
        return p.petTypes.includes(formData.petType!);
      }),
    }))
    .filter((section) => section.products.length > 0);

  const showCorte = formData.service === "bath_cut";

  const invalidPetName = !formData.petName || formData.petName.trim().length < 3;
  const invalidService = !formData.service;
  const invalidBathType = !formData.bathType;
  const invalidCorteType = showCorte && !formData.corteType;

  const handleContinue = () => {
    const found: string[] = [];
    if (invalidPetName) found.push("El nombre de la mascota necesita al menos 3 letras");
    if (invalidService) found.push("Elige un servicio principal (Baño o Baño y Corte)");
    if (invalidBathType) found.push("Elige un tipo de baño");
    if (invalidCorteType) found.push("Elige un tipo de corte");

    if (found.length > 0) {
      setErrors(found);
      setShowModal(true);
      return;
    }
    setErrors([]);
    onNext();
  };

  const clearErrors = () => {
    if (showModal) setShowModal(false);
    if (errors.length > 0) setErrors([]);
  };

  const isServiceActive = (service: string) =>
    (formData.extraServices || []).some((s) => s.service === service);

  const isVariantSelected = (service: string, variant: string) =>
    (formData.extraServices || []).some((s) => s.service === service && s.variant === variant);

  const toggleExtra = (service: string) => {
    const current = formData.extraServices || [];
    if (isServiceActive(service)) {
      update("extraServices", current.filter((s) => s.service !== service));
      setAntifleaDuration(null);
    } else if (service === "antiflea" && isCat) {
      update("extraServices", [...current, { service: "antiflea", variant: "1m_pipeta_xelamec" }]);
    } else {
      update("extraServices", [...current, { service }]);
    }
  };

  const selectExtraVariant = (service: string, variant: string, exclusive: boolean) => {
    const current = formData.extraServices || [];
    if (exclusive) {
      update(
        "extraServices",
        current.map((s) => (s.service === service ? { service, variant } : s))
      );
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      update("corteImage", reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    update("corteImage", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
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
          const hasError = invalidService && errors.length > 0;
          return (
            <motion.button
              key={value} type="button"
              animate={hasError ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
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
                  : hasError
                    ? "border-red-500 shadow-sm"
                    : "border-[#E7E2D8] shadow-sm hover:border-blue-300"
              }`}
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden">
                <LazyImage
                  src={image}
                  alt={alt}
                  className="transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md">
                  <Icon className="h-5 w-5 text-blue-600" />
                </span>
              </div>

              <div className="flex flex-1 items-center justify-between gap-3 p-5 lg:gap-4 lg:p-7">
                <div className="flex flex-col">
                  <span className={`text-base font-semibold tracking-tight lg:text-lg ${
                    selected ? "text-blue-700" : "text-[#1A2238]"
                  }`}>
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

      {/* Services detail card: Bath type + Extras */}
      <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm lg:p-8">
        {/* Bath Type Selection */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="h-1 w-6 rounded-full bg-blue-500" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Tipo de baño
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {BATH_OPTIONS.map(({ value, label, description, icon: Icon }) => {
              const selected = formData.bathType === value;
              const hasError = invalidBathType && errors.length > 0;
              return (
                <motion.button
                  key={value} type="button"
                  animate={hasError ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
                  transition={{ duration: 0.4 }}
                  onClick={() => { clearErrors(); update("bathType", value); }}
                  className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] sm:p-5 lg:gap-4 lg:p-7 ${
                    selected
                      ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                      : hasError
                        ? "border-red-500 bg-white shadow-sm"
                        : "border-gray-200 bg-white shadow-sm hover:border-blue-300 hover:shadow-md hover:shadow-gray-200"
                  }`}
                >
                  <span className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                    selected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 bg-white"
                  }`}>
                    {selected && <span className="text-[10px] font-bold leading-none">✓</span>}
                  </span>
                  <Icon className={`h-10 w-10 transition-colors lg:h-12 lg:w-12 ${selected ? "text-blue-600" : "text-gray-600"}`} />
                  <span className={`text-center text-sm font-semibold leading-tight lg:text-base ${selected ? "text-blue-700" : "text-gray-700"}`}>
                    {label}
                  </span>
                  <span className="text-center text-xs leading-tight text-gray-500 lg:text-sm">
                    {description}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="my-6 border-t border-slate-200" />

        {/* Extra Services */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="h-1 w-6 rounded-full bg-blue-500" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Servicios adicionales
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:gap-6">
            {EXTRA_OPTIONS.map(({ value, label, icon: Icon }) => {
              const checked = isServiceActive(value);
              return (
                <button key={value} type="button" onClick={() => toggleExtra(value)}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 text-sm font-medium transition-all duration-200 lg:gap-3 lg:px-6 lg:py-5 lg:text-base ${
                    checked ? "border-blue-500 bg-blue-50 text-blue-800 shadow-md"
                            : "border-slate-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  <Icon className={`h-5 w-5 lg:h-6 lg:w-6 ${checked ? "text-blue-600" : "text-gray-400"}`} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Antiflea variants */}
          <AnimatePresence>
            {isServiceActive("antiflea") && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="mt-6 overflow-hidden p-1"
              >
                {hasAntifleaProduct ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-semibold text-blue-800">
                            {EXTRA_VARIANT_LABELS[antifleaVariant] || antifleaVariant}
                          </p>
                          <p className="text-xs text-blue-500">Antipulgas seleccionado</p>
                        </div>
                      </div>
                      {!isCat && (
                        <button
                          type="button"
                          onClick={() => {
                            const curr = formData.extraServices || [];
                            update("extraServices", curr.map((s) => (s.service === "antiflea" ? { service: "antiflea" } : s)));
                            setAntifleaDuration(null);
                          }}
                          className="cursor-pointer text-xs font-medium text-blue-600 underline hover:text-blue-800"
                        >
                          Cambiar
                        </button>
                      )}
                    </div>
                  </div>
                ) : isCat ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-semibold text-blue-800">Pipeta Xelamec — 1 mes</p>
                        <p className="text-xs text-blue-500">Única opción disponible para gatos</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="h-1 w-4 rounded-full bg-blue-500" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        ¿Qué duración prefieres?
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setAntifleaDuration("1m")}
                          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all hover:scale-[1.02] active:scale-[0.97] ${
                            antifleaDuration === "1m"
                              ? "border-blue-500 bg-blue-50 shadow-md"
                              : "border-gray-200 bg-white shadow-sm hover:border-blue-300 hover:shadow-md"
                          }`}
                        >
                          <ShieldCheck className={`h-7 w-7 ${antifleaDuration === "1m" ? "text-blue-600" : "text-gray-400"}`} />
                          <span className="text-center text-sm font-semibold text-gray-700">1 mes</span>
                          <span className="text-center text-xs text-gray-500">Pipeta o pastilla mensual</span>
                        </button>

                        <button
                          type="button"
                          disabled={!isSanMiguel}
                          onClick={() => {
                            setAntifleaDuration("3m");
                            selectExtraVariant("antiflea", "3m_bravecto", true);
                          }}
                          className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all hover:scale-[1.02] active:scale-[0.97] ${
                            !isSanMiguel
                              ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-50"
                              : antifleaDuration === "3m"
                                ? "border-blue-500 bg-blue-50 shadow-md"
                                : "border-gray-200 bg-white shadow-sm hover:border-blue-300 hover:shadow-md"
                          }`}
                        >
                          <ShieldCheck className={`h-7 w-7 ${antifleaDuration === "3m" && isSanMiguel ? "text-blue-600" : "text-gray-400"}`} />
                          <span className="text-center text-sm font-semibold text-gray-700">3 meses</span>
                          <span className="text-center text-xs text-gray-500">Bravecto trimestral</span>
                          {!isSanMiguel && (
                            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                              Solo San Miguel
                            </span>
                          )}
                        </button>
                      </div>
                  </>
                )}

                {/* Product selection (1 mes, dogs only) */}
                {antifleaDuration === "1m" && !hasAntifleaProduct && !isCat && filtered1mSections.length > 0 && (
                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-4 rounded-full bg-blue-500" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                          Elige el producto — 1 mes
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAntifleaDuration(null)}
                        className="cursor-pointer text-xs text-gray-400 hover:text-gray-600"
                      >
                        ← Cambiar duración
                      </button>
                    </div>

                    <div className="space-y-4">
                      {filtered1mSections.map((section) => (
                        <div key={section.name}>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            {section.name}
                          </p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {section.products.map((product) => (
                              <button
                                key={product.value}
                                type="button"
                                onClick={() => selectExtraVariant("antiflea", product.value, true)}
                                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-gray-200 bg-white p-3 shadow-sm transition-all hover:scale-[1.02] hover:border-blue-300 hover:shadow-md active:scale-[0.97] sm:p-4"
                              >
                                <ShieldCheck className="h-7 w-7 text-gray-400" />
                                <span className="text-center text-sm font-semibold text-gray-700">{product.label}</span>
                                <span className="text-center text-xs leading-tight text-gray-500">{product.description}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Vaccine variants */}
          <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
            isServiceActive("vaccine") ? "mt-6 max-h-160 opacity-100" : "max-h-0 opacity-0"
          }`}>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-1 w-4 rounded-full bg-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Seleccioná la(s) vacuna(s)
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 px-1 py-1 sm:grid-cols-2 sm:gap-4 lg:gap-5">
              {VACCINE_OPTIONS.map(({ value, label, description }) => {
                const selected = isVariantSelected("vaccine", value);
                return (
                  <button key={value} type="button"
                    onClick={() => selectExtraVariant("vaccine", value, false)}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] sm:p-4 ${
                      selected
                        ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                        : "border-gray-200 bg-white shadow-sm hover:border-blue-300 hover:shadow-md hover:shadow-gray-200"
                    }`}
                  >
                    <Syringe className={`h-7 w-7 ${selected ? "text-blue-600" : "text-gray-400"}`} />
                    <span className={`text-center text-sm font-semibold leading-tight ${selected ? "text-blue-700" : "text-gray-700"}`}>
                      {label}
                    </span>
                    <span className="text-center text-xs leading-tight text-gray-500">
                      {description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="my-6 border-t border-slate-200" />

        {/* Perfume Aroma */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="h-1 w-6 rounded-full bg-orange-500" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-orange-600">
              Aroma del perfume
            </h3>
          </div>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 lg:gap-6">
            {(["fruital", "floral", "fresco"] as const).map((value) => {
              const labels: Record<string, string> = { fruital: "🍓 Frutal", floral: "🌸 Floral", fresco: "🍃 Fresco" };
              const selected = formData.perfume === value;
              return (
                <button key={value} type="button"
                  onClick={() => update("perfume", value)}
                  className={`relative cursor-pointer rounded-xl border-2 px-6 py-3 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] lg:px-8 lg:py-4 lg:text-base ${
                    selected
                      ? "border-orange-500 bg-orange-50 text-orange-700 shadow-md"
                      : "border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50"
                  }`}
                >
                  {selected && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white shadow">
                      ✓
                    </span>
                  )}
                  {labels[value]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Corte Details (collapsible, only when bath_cut) */}
      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
        showCorte ? "mt-10 max-h-250 opacity-100" : "max-h-0 opacity-0"
      }`}>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm lg:p-8">
          <h3 className="mb-6 text-center text-xl font-bold text-[#1A2238] lg:text-2xl">Detalles del Corte</h3>
          <div className="mb-6">
            <p className="mb-3 text-sm font-semibold text-gray-700">Tipo de corte</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {CORTE_OPTIONS.map(({ value, label }) => {
                const selected = formData.corteType === value;
                const hasError = invalidCorteType && errors.length > 0;
                return (
                  <motion.button
                    key={value} type="button"
                    animate={hasError ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
                    transition={{ duration: 0.4 }}
                    onClick={() => { clearErrors(); update("corteType", value); }}
                    className={`cursor-pointer rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all duration-200 lg:px-6 lg:py-4 lg:text-base ${
                      selected ? "border-blue-500 bg-blue-100 text-blue-800 shadow-md"
                               : hasError
                                 ? "border-red-500 bg-white text-red-700"
                                 : "border-blue-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >{label}</motion.button>
                );
              })}
            </div>
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Especificaciones del corte</label>
            <textarea value={formData.corteSpecs || ""}
              onChange={(e) => update("corteSpecs", e.target.value)}
              placeholder="Ej: Dejar punta de cola tipo pompón, no tocar bigotes, no cortar mucho las orejas..."
              rows={4}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-800 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-200" />
          </div>
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
            ⚠️ Importante: Si su mascota presenta nudos o el pelaje muy motado, por salud y bienestar dermatológico, el estilista podría recomendar obligatoriamente un corte rapado. Los nudos severos atrapan la humedad, impiden un secado correcto y pueden generar hongos o infecciones en la piel.
                Asimismo, el precio final y el tiempo del servicio podrían variar según el estado real del manto al momento de la evaluación en clínica.
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Foto referencial</label>
            <div className="flex items-center gap-4">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition-all hover:border-blue-500 hover:text-blue-600">
                <Upload className="h-5 w-5" /> Subir foto
              </button>
              {formData.corteImage && (
                <div className="relative">
                  <img src={formData.corteImage} alt="Referencia de corte" className="h-16 w-16 rounded-lg border border-gray-300 object-cover" />
                  <button type="button" onClick={handleRemoveImage}
                    className="absolute -right-2 -top-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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
