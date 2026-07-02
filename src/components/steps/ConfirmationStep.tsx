import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle, MapPin, ExternalLink } from "lucide-react";
import type { FormData, PetData } from "../BookingWizard";

interface ConfirmationStepProps {
  formData: FormData;
  onBack?: () => void;
  update?: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onNext?: () => void;
  onAddAnother?: () => void;
  onContinue?: () => void;
}

const PET_TYPE_LABELS: Record<string, string> = { dog: "Perro", cat: "Gato" };
  const SERVICE_LABELS: Record<string, string> = { bath: "Baño", bath_cut: "Baño + Corte", bath_deslanado: "Baño + Deslanado" };
const SIZE_LABELS: Record<string, string> = { small: "Pequeño", medium: "Mediano", large: "Grande" };
const TIME_LABELS: Record<string, string> = { "9-11": "9:00 am – 11:00 am", "11-14": "11:00 am – 2:00 pm" };
const EXTRA_LABELS: Record<string, string> = { deworming: "Desparasitación", antiflea: "Antipulgas", vaccine: "Vacuna" };
const CORTE_LABELS: Record<string, string> = {
  rapado: "Corte Rapado",
  rebaje: "Rebaje Comercial (1 cm de largo parejo)",
  tijera: "Corte con Tijera / Estilo de la raza",
};
const BATH_LABELS: Record<string, string> = {
  hidratado_premium: "Hidratado Premium",
  medicado: "Baño Medicado",
  tradicional: "Baño Tradicional",
};
const PERFUME_LABELS: Record<string, string> = {
  fruital: "🍓 Frutal",
  floral: "🌸 Floral",
  fresco: "🍃 Fresco",
};
const BRANCH_LABELS: Record<string, string> = {
  san_martin: "San Martín de Porres",
  los_olivos: "Los Olivos",
  san_miguel: "San Miguel",
};

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
            {pet.extraServices.map((s) => EXTRA_LABELS[s] || s).join(", ")}
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
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-6 py-10">
        <CheckCircle className="h-24 w-24 text-green-500" />
        <h2 className="text-3xl font-bold tracking-tight text-gray-800">
          ¡Solicitud enviada con éxito!
        </h2>
        <p className="text-center text-gray-500">
          Su mascotita ya fue agendada. Estaremos en contacto con usted cuando pasen por su domicilio. Recordarle que la movilidad sólo podrá esperar fuera de su domicilio 5 minutos luego de la primera llamada 🐾🐶🐱
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6 text-center text-2xl font-bold tracking-tight text-gray-800">
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
        <div className="flex justify-between">
          <span className="text-gray-500">Fecha</span>
          <span className="font-medium text-gray-800">{formData.date ? formatDate(formData.date) : "-"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Horario</span>
          <span className="font-medium text-gray-800">{TIME_LABELS[formData.timeRange ?? ""] ?? "-"}</span>
        </div>
      </div>

      <div className="mb-6 space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <p className="text-sm font-semibold text-gray-700">Datos del cliente</p>
        <div className="flex justify-between">
          <span className="text-gray-500">Nombre</span>
          <span className="font-medium text-gray-800">{formData.ownerName || "-"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Teléfono</span>
          <span className="font-medium text-gray-800">{formData.ownerPhone || "-"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Dirección</span>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-800">{formData.ownerAddress || "-"}</span>
            {formData.ownerLat && formData.ownerLng && (
              <a
                href={`https://www.google.com/maps?q=${formData.ownerLat},${formData.ownerLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
        {formData.mobilityPhoneDifferent && formData.mobilityPhone && (
          <div className="flex justify-between">
            <span className="text-gray-500">Tel. movilidad</span>
            <span className="font-medium text-gray-800">{formData.mobilityPhone}</span>
          </div>
        )}
      </div>

      <button
        onClick={() => setSubmitted(true)}
        className="w-full cursor-pointer rounded-xl bg-blue-600 py-4 text-lg font-bold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200/50 active:scale-[0.98]"
      >
        Confirmar Solicitud
      </button>
    </div>
  );
}