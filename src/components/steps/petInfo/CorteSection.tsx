import { useRef } from "react";
import { motion } from "framer-motion";
import { Upload, Trash2, Loader2 } from "lucide-react";

const CORTE_OPTIONS = [
  { value: "rapado" as const, label: "Corte Rapado" },
  { value: "rebaje" as const, label: "Rebaje Comercial (1 cm de largo parejo)" },
  { value: "tijera" as const, label: "Corte con Tijera / Estilo de la raza" },
];

interface CorteSectionProps {
  corteType: "rapado" | "rebaje" | "tijera" | null;
  corteSpecs: string;
  corteImage: string;
  hasError: boolean;
  isUploading: boolean;
  uploadError: string | null;
  onSelectCorte: (value: "rapado" | "rebaje" | "tijera") => void;
  onSpecsChange: (value: string) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
}

export function CorteSection({
  corteType, corteSpecs, corteImage, hasError,
  isUploading, uploadError,
  onSelectCorte, onSpecsChange, onImageUpload, onRemoveImage,
}: CorteSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm lg:p-8">
      <h3 className="mb-6 text-center text-xl font-bold text-[#1A2238] lg:text-2xl">Detalles del Corte</h3>
      <div className="mb-6">
        <p className="mb-3 text-sm font-semibold text-gray-700">Tipo de corte</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CORTE_OPTIONS.map(({ value, label }) => {
            const selected = corteType === value;
            return (
              <motion.button
                key={value} type="button"
                animate={hasError ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                onClick={() => onSelectCorte(value)}
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
        <textarea value={corteSpecs}
          onChange={(e) => onSpecsChange(e.target.value)}
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
        <div className="flex flex-wrap items-center gap-4">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
            className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-white px-5 py-3 text-sm font-medium transition-all hover:border-blue-500 hover:text-blue-600 ${
              isUploading ? "cursor-wait opacity-60" : ""
            }`}>
            {isUploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Subiendo...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" /> Subir foto
              </>
            )}
          </button>
          {uploadError && (
            <span className="text-xs text-red-500">{uploadError}</span>
          )}
          {corteImage && (
            <div className="relative">
              <img src={corteImage} alt="Referencia de corte" className="h-16 w-16 rounded-lg border border-gray-300 object-cover" />
              <button type="button" onClick={onRemoveImage}
                className="absolute -right-2 -top-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
