import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle, MapPin, ExternalLink, Loader2, AlertCircle, Phone } from "lucide-react";
import type { FormData, PetData } from "../BookingWizard";
import { BRANCH_BY_VALUE } from "../../data/branches";
import {
  PET_TYPE_LABELS,
  SERVICE_LABELS,
  SIZE_LABELS,
  TIME_LABELS,
  formatExtraLabel,
  CORTE_LABELS,
  BATH_LABELS,
  PERFUME_LABELS,
  BRANCH_LABELS,
} from "../../data/labels";
import { submitBooking } from "../../services/submitBooking";

interface ConfirmationStepProps {
  formData: FormData;
  onBack?: () => void;
  update?: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext?: () => void;
  onAddAnother?: () => void;
  onContinue?: () => void;
}

type SubmitState = "idle" | "loading" | "success" | "error";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return format(d, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
}

function PetCard({ pet, index }: { pet: PetData; index: number }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
      <p className="mb-2 text-sm font-semibold text-blue-700">
        {pet.petName || `Mascota ${index + 1}`}
      </p>
      <div className="space-y-1 text-sm text-gray-600">
        <p><span className="font-medium text-gray-700">Tipo:</span> {PET_TYPE_LABELS[pet.petType]}</p>
        <p><span className="font-medium text-gray-700">Servicio:</span> {SERVICE_LABELS[pet.service]}</p>
        <p><span className="font-medium text-gray-700">Tipo de baño:</span> {BATH_LABELS[pet.bathType ?? ""] ?? "-"}</p>
        {pet.service === "bath_cut" && (
          <>
            <p><span className="font-medium text-gray-700">Tipo de corte:</span> {CORTE_LABELS[pet.corteType ?? ""] ?? "-"}</p>
            {pet.corteSpecs && (
              <p><span className="font-medium text-gray-700">Especificaciones:</span> {pet.corteSpecs}</p>
            )}
            {pet.corteImage && (
              <div>
                <span className="font-medium text-gray-700">Imagen referencial:</span>
                <img
                  src={pet.corteImage}
                  alt="Referencia de corte"
                  className="mt-1 h-20 w-20 rounded-lg border border-gray-300 object-cover"
                />
              </div>
            )}
          </>
        )}
        {pet.extraServices && pet.extraServices.length > 0 && (
          <p>
            <span className="font-medium text-gray-700">Servicios adicionales:</span>{" "}
            {pet.extraServices.map(formatExtraLabel).join(", ")}
          </p>
        )}
        {pet.size && (
          <p><span className="font-medium text-gray-700">Tamaño:</span> {SIZE_LABELS[pet.size]}</p>
        )}
        {pet.perfume && (
          <p><span className="font-medium text-gray-700">Aroma:</span> {PERFUME_LABELS[pet.perfume]}</p>
        )}
        {pet.petNotes && (
          <p><span className="font-medium text-gray-700">Notas:</span> {pet.petNotes}</p>
        )}
      </div>
    </div>
  );
}

export function ConfirmationStep({ formData, onBack: _onBack }: ConfirmationStepProps) {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string>("");

  const branchPhone = formData.branch ? BRANCH_BY_VALUE[formData.branch]?.phone : null;

  const handleSubmit = async () => {
    if (submitState === "loading") return;
    setSubmitState("loading");
    setSubmitError("");
    const result = await submitBooking(formData);
    if (result.ok) {
      setSubmitState("success");
    } else {
      setSubmitState("error");
      setSubmitError(result.error ?? "Ocurrió un error inesperado");
    }
  };

  if (submitState === "success") {
    return (
      <div className="flex flex-col items-center gap-6 py-10">
        <CheckCircle className="h-20 w-20 text-green-500 sm:h-24 sm:w-24" />
        <h2 className="text-center text-[var(--text-step-title)] font-display font-bold tracking-tight text-gray-800">
          ¡Solicitud enviada con éxito!
        </h2>
        <p className="text-center text-gray-500">
          Su mascotita ya fue agendada. Estaremos en contacto con usted cuando pasen por su domicilio. Recordarle que la movilidad sólo podrá esperar fuera de su domicilio 5 minutos luego de la primera llamada 🐾🐶🐱
        </p>
      </div>
    );
  }

  if (submitState === "error") {
    return (
      <div className="flex flex-col items-center gap-6 py-10">
        <AlertCircle className="h-20 w-20 text-red-500" />
        <h2 className="text-2xl font-bold tracking-tight text-gray-800">
          No se pudo enviar la solicitud
        </h2>
        <p className="text-center text-sm text-gray-500">
          {submitError}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => setSubmitState("idle")}
            className="cursor-pointer rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg active:scale-[0.98]"
          >
            Reintentar
          </button>
          {branchPhone && (
            <a
              href={`tel:${branchPhone.replace(/\s/g, "")}`}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-white px-6 py-3 text-base font-semibold text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-50 active:scale-[0.98]"
            >
              <Phone className="h-5 w-5" />
              Llámanos
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-center text-[var(--text-step-title)] font-display font-bold tracking-tight text-gray-800">
        Resumen de tu solicitud
      </h2>

      {formData.branch && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <MapPin className="h-6 w-6 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-500">Sede seleccionada</p>
              <p className="text-lg font-bold text-blue-800">
                {BRANCH_LABELS[formData.branch]}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <p className="text-sm font-semibold text-gray-700">Mascotas Agendadas</p>
        {formData.pets.length === 0 ? (
          <p className="text-sm text-gray-500">No hay mascotas registradas.</p>
        ) : (
          <div className="space-y-3">
            {formData.pets.map((pet, i) => (
              <PetCard key={i} pet={pet} index={i} />
            ))}
          </div>
        )}
      </div>

      <div className="mb-6 space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <p className="text-sm font-semibold text-gray-700">Agenda</p>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <span className="text-xs text-gray-500 sm:text-sm">Fecha</span>
          <span className="text-sm font-medium text-gray-800 sm:text-right">{formData.date ? formatDate(formData.date) : "-"}</span>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <span className="text-xs text-gray-500 sm:text-sm">Horario</span>
          <span className="text-sm font-medium text-gray-800 sm:text-right">{TIME_LABELS[formData.timeRange ?? ""] ?? "-"}</span>
        </div>
      </div>

      <div className="mb-6 space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <p className="text-sm font-semibold text-gray-700">Datos del cliente</p>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <span className="text-xs text-gray-500 sm:text-sm">Nombre</span>
          <span className="text-sm font-medium text-gray-800 sm:text-right">{formData.ownerName || "-"}</span>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
          <span className="text-xs text-gray-500 sm:text-sm">Teléfono</span>
          <span className="text-sm font-medium text-gray-800 sm:text-right">{formData.ownerPhone || "-"}</span>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
          <span className="text-xs text-gray-500 sm:text-sm">Dirección</span>
          <div className="flex items-start gap-2 sm:max-w-[60%] sm:justify-end">
            <span className="text-sm font-medium text-gray-800 sm:text-right">{formData.ownerAddress || "-"}</span>
            {formData.ownerLat && formData.ownerLng && (
              <a
                href={`https://www.google.com/maps?q=${formData.ownerLat},${formData.ownerLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 flex shrink-0 items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
        {formData.mobilityPhoneDifferent && formData.mobilityPhone && (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <span className="text-xs text-gray-500 sm:text-sm">Tel. movilidad</span>
            <span className="text-sm font-medium text-gray-800 sm:text-right">{formData.mobilityPhone}</span>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitState === "loading"}
        className={`w-full rounded-xl py-4 text-lg font-bold text-white shadow-md transition-all ${
          submitState === "loading"
            ? "cursor-wait bg-blue-400"
            : "cursor-pointer bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200/50 active:scale-[0.98]"
        }`}
      >
        {submitState === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Enviando...
          </span>
        ) : (
          "Confirmar Solicitud"
        )}
      </button>
    </div>
  );
}