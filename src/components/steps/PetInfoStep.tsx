import { useState, useRef } from "react";
import { ShowerHead, Scissors, Wind, Upload, Trash2, Sparkles, BriefcaseMedical, Droplets, Syringe, ShieldCheck } from "lucide-react";
import type { FormData } from "../BookingWizard";

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
  { value: "deworming", label: "Desparasitación" },
  { value: "antiflea", label: "Antipulgas" },
  { value: "vaccine", label: "Vacuna" },
];

const CORTE_OPTIONS = [
  { value: "rapado" as const, label: "Corte Rapado" },
  { value: "rebaje" as const, label: "Rebaje Comercial (1 cm de largo parejo)" },
  { value: "tijera" as const, label: "Corte con Tijera / Estilo de la raza" },
];

const ANTIFLEA_OPTIONS = [
  { value: "1m", label: "1 mes", description: "Pipeta tópica de acción rápida. Repetir mensualmente." },
  { value: "3m", label: "3 meses", description: "Comprimido de acción prolongada. Cobertura trimestral." },
  { value: "6m", label: "6 meses", description: "Collar/inyectable de larga duración. Máxima comodidad." },
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
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCat = formData.petType === "cat";
  const SERVICE_OPTIONS = isCat ? CAT_SERVICE_OPTIONS : DOG_SERVICE_OPTIONS;
  const VACCINE_OPTIONS = isCat ? VACCINE_OPTIONS_CAT : VACCINE_OPTIONS_DOG;

  const showCorte = formData.service === "bath_cut";

  const handleContinue = () => {
    if (!formData.petName || formData.petName.trim().length < 3) {
      setError("El nombre de la mascota debe tener al menos 3 caracteres.");
      return;
    }
    if (!formData.service) {
      setError("Selecciona un servicio principal.");
      return;
    }
    if (!formData.bathType) {
      setError("Selecciona un tipo de baño.");
      return;
    }
    if (showCorte && !formData.corteType) {
      setError("Selecciona un tipo de corte.");
      return;
    }
    setError(null);
    onNext();
  };

  const isServiceActive = (service: string) =>
    (formData.extraServices || []).some((s) => s.service === service);

  const isVariantSelected = (service: string, variant: string) =>
    (formData.extraServices || []).some((s) => s.service === service && s.variant === variant);

  const toggleExtra = (service: string) => {
    const current = formData.extraServices || [];
    if (isServiceActive(service)) {
      update("extraServices", current.filter((s) => s.service !== service));
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
        <input type="text" value={formData.petName || ""}
          onChange={(e) => { if (error) setError(null); update("petName", e.target.value); }}
          placeholder="Ej: Firulais"
          className={`w-full rounded-xl border px-4 py-3 text-lg text-gray-800 outline-none transition-colors focus:ring-2 lg:px-5 lg:py-4 ${
            error && !formData.petName?.trim() ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                  : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
          }`} />
        {error && !formData.petName?.trim() && <p className="mt-2 text-sm text-red-600 font-medium">{error}</p>}
      </div>

      {/* Service Selection: Bath or Bath+Cut */}
      <div className="mb-6 sm:mb-8 text-center">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
          Servicio principal
        </p>
        <h2 className="text-[var(--text-step-title)] font-display font-bold tracking-tight text-[#1A2238]">
          ¿Qué servicio necesita?
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        {SERVICE_OPTIONS.map(({ value, label, icon: Icon, image, alt }) => {
          const selected = formData.service === value;
          return (
            <button key={value} type="button"
              onClick={() => {
                setError(null);
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
                  : "border-[#E7E2D8] shadow-sm hover:border-blue-300"
              }`}
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#FBF8F4]">
                <img
                  src={image}
                  alt={alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-blue-900/40 via-blue-800/5 to-transparent" />
                {selected && (
                  <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-md">
                    ✓
                  </span>
                )}
              </div>

              <div className="flex flex-1 items-center gap-3 p-5 lg:gap-4 lg:p-7">
                <Icon className={`h-6 w-6 shrink-0 transition-colors lg:h-7 lg:w-7 ${
                  selected ? "text-blue-600" : "text-gray-500"
                }`} />
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
              </div>
            </button>
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
              return (
                <button key={value} type="button"
                  onClick={() => { setError(null); update("bathType", value); }}
                  className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] sm:p-5 lg:gap-4 lg:p-7 ${
                    selected
                      ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                      : "border-gray-200 bg-white shadow-sm hover:border-blue-300 hover:shadow-md hover:shadow-gray-200"
                  }`}
                >
                  <Icon className={`h-10 w-10 transition-colors lg:h-12 lg:w-12 ${selected ? "text-blue-600" : "text-gray-600"}`} />
                  <span className={`text-center text-sm font-semibold leading-tight lg:text-base ${selected ? "text-blue-700" : "text-gray-700"}`}>
                    {label}
                  </span>
                  <span className="text-center text-xs leading-tight text-gray-500 lg:text-sm">
                    {description}
                  </span>
                </button>
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
            {EXTRA_OPTIONS.map(({ value, label }) => {
              const checked = isServiceActive(value);
              return (
                <button key={value} type="button" onClick={() => toggleExtra(value)}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 text-sm font-medium transition-all duration-200 lg:gap-3 lg:px-6 lg:py-5 lg:text-base ${
                    checked ? "border-blue-500 bg-blue-50 text-blue-800 shadow-md"
                            : "border-slate-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-md border-2 text-xs font-bold transition-all lg:h-6 lg:w-6 ${
                    checked ? "border-blue-500 bg-blue-500 text-white" : "border-slate-200 bg-white text-transparent"
                  }`}>✓</span>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Antiflea variants */}
          <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
            isServiceActive("antiflea") ? "mt-6 max-h-128 opacity-100" : "max-h-0 opacity-0"
          }`}>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-1 w-4 rounded-full bg-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Elige la duración del antipulgas
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 px-1 py-1 sm:grid-cols-3 sm:gap-4">
              {ANTIFLEA_OPTIONS.map(({ value, label, description }) => {
                const selected = isVariantSelected("antiflea", value);
                return (
                  <button key={value} type="button"
                    onClick={() => selectExtraVariant("antiflea", value, true)}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] sm:p-4 ${
                      selected
                        ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                        : "border-gray-200 bg-white shadow-sm hover:border-blue-300 hover:shadow-md hover:shadow-gray-200"
                    }`}
                  >
                    <ShieldCheck className={`h-7 w-7 ${selected ? "text-blue-600" : "text-gray-400"}`} />
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
                return (
                  <button key={value} type="button"
                    onClick={() => { setError(null); update("corteType", value); }}
                    className={`cursor-pointer rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all duration-200 lg:px-6 lg:py-4 lg:text-base ${
                      selected ? "border-blue-500 bg-blue-100 text-blue-800 shadow-md"
                               : "border-blue-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >{label}</button>
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

      {/* Perfume Aroma */}
      <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm lg:p-8">
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
                className={`cursor-pointer rounded-xl border-2 px-6 py-3 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] lg:px-8 lg:py-4 lg:text-base ${
                  selected
                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md"
                    : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                {labels[value]}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="mt-4 text-center text-sm text-red-600 font-medium">{error}</p>
      )}

      <button onClick={handleContinue}
        className="mt-10 w-full cursor-pointer rounded-xl bg-blue-600 py-4 text-lg font-bold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200/50 active:scale-[0.98] lg:py-5 lg:text-xl">
        Continuar
      </button>
    </div>
  );
}
