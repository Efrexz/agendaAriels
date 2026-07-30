import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pill, ShieldCheck, Syringe } from "lucide-react";
import type { ExtraService } from "../../BookingWizard";
import { EXTRA_VARIANT_LABELS } from "../../../data/labels";

type AntifleaProduct = {
  value: string;
  label: string;
  description: string;
  petTypes: readonly string[];
  requiresBranch?: string;
};

const EXTRA_OPTIONS = [
  { value: "deworming", label: "Desparasitación", icon: Pill },
  { value: "antiflea", label: "Antipulgas", icon: ShieldCheck },
  { value: "vaccine", label: "Vacuna", icon: Syringe },
];

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

interface ExtraServicesPickerProps {
  extraServices: ExtraService[];
  petType: "dog" | "cat" | null;
  branch: string | null;
  onToggle: (service: string) => void;
  onSelectVariant: (service: string, variant: string, exclusive: boolean) => void;
}

export function ExtraServicesPicker({ extraServices, petType, branch, onToggle, onSelectVariant }: ExtraServicesPickerProps) {
  const [antifleaDuration, setAntifleaDuration] = useState<string | null>(null);
  const isCat = petType === "cat";
  const isSanMiguel = branch === "san_miguel";
  const VACCINE_OPTIONS = isCat ? VACCINE_OPTIONS_CAT : VACCINE_OPTIONS_DOG;

  const isServiceActive = (service: string) =>
    extraServices.some((s) => s.service === service);

  const isVariantSelected = (service: string, variant: string) =>
    extraServices.some((s) => s.service === service && s.variant === variant);

  const antifleaVariant = extraServices.find((s) => s.service === "antiflea")?.variant;
  const hasAntifleaProduct = !!antifleaVariant;

  const filtered1mSections = ANTIFLEA_PRODUCTS_1M
    .map((section) => ({
      name: section.name,
      products: section.products.filter((p: AntifleaProduct) => {
        if (p.requiresBranch && p.requiresBranch !== branch) return false;
        return p.petTypes.includes(petType!);
      }),
    }))
    .filter((section) => section.products.length > 0);

  const handleToggle = (service: string) => {
    if (service === "antiflea" && isCat) {
      onSelectVariant("antiflea", "1m_pipeta_xelamec", true);
    } else {
      onToggle(service);
      setAntifleaDuration(null);
    }
  };

  const handleVariant = (service: string, variant: string, exclusive: boolean) => {
    onSelectVariant(service, variant, exclusive);
  };

  return (
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
            <button key={value} type="button" onClick={() => handleToggle(value)}
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
                        onToggle("antiflea");
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
                      handleVariant("antiflea", "3m_bravecto", true);
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
                            onClick={() => handleVariant("antiflea", product.value, true)}
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
                onClick={() => handleVariant("vaccine", value, false)}
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
  );
}
