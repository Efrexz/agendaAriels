import { motion } from "framer-motion";
import { Sparkles, BriefcaseMedical, Droplets } from "lucide-react";

const OPTIONS = [
  { value: "hidratado_premium" as const, label: "Hidratado Premium", description: "Hidratación intensa con productos premium para un pelaje sedoso y brillante.", icon: Sparkles },
  { value: "medicado" as const, label: "Baño Medicado", description: "Tratamiento con shampoo medicado para pieles sensibles o con afecciones dermatológicas.", icon: BriefcaseMedical },
  { value: "tradicional" as const, label: "Baño Tradicional", description: "Limpieza general con productos estándar, ideal para mascotas sin condiciones especiales.", icon: Droplets },
];

interface BathTypePickerProps {
  value: "hidratado_premium" | "medicado" | "tradicional" | null;
  onSelect: (value: "hidratado_premium" | "medicado" | "tradicional") => void;
  hasError: boolean;
}

export function BathTypePicker({ value, onSelect, hasError }: BathTypePickerProps) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <div className="h-1 w-6 rounded-full bg-blue-500" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          Tipo de baño
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {OPTIONS.map(({ value: opt, label, description, icon: Icon }) => {
          const selected = value === opt;
          return (
            <motion.button
              key={opt} type="button"
              animate={hasError ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              onClick={() => onSelect(opt)}
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
  );
}
