interface PerfumePickerProps {
  value: "fruital" | "floral" | "fresco" | null;
  onSelect: (value: "fruital" | "floral" | "fresco") => void;
}

const LABELS: Record<string, string> = { fruital: "🍓 Frutal", floral: "🌸 Floral", fresco: "🍃 Fresco" };

export function PerfumePicker({ value, onSelect }: PerfumePickerProps) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <div className="h-1 w-6 rounded-full bg-orange-500" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-orange-600">
          Aroma del perfume
        </h3>
      </div>
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4 lg:gap-6">
        {(["fruital", "floral", "fresco"] as const).map((key) => {
          const selected = value === key;
          return (
            <button key={key} type="button"
              onClick={() => onSelect(key)}
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
              {LABELS[key]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
