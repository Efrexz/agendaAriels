import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PawPrint,
  UserRound,
  MapPin,
  Trash2,
  Scissors,
  Check,
  Plus,
  CalendarCheck,
  ArrowRight,
  UserPlus,
  Pencil,
  LogIn,
  ShieldCheck,
  X,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { FormData, PetData } from "../BookingWizard";
import { PET_TYPE_LABELS, SIZE_LABELS, SERVICE_LABELS, BRANCH_LABELS } from "../../data/labels";
import { BRANCHES, MAX_PICKUP_DISTANCE_KM } from "../../data/branches";
import { haversineKm } from "../../utils/geo";

interface WelcomeBackStepProps {
  formData: FormData;
  /** Todas las mascotas guardadas del perfil (no solo las de esta reserva). */
  savedPets: PetData[];
  update: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  onUseProfile: (pets: PetData[]) => void;
  onRemoveSavedPet: (index: number) => void;
  onAddPet: () => void;
  onStartBooking: () => void;
  onStartFresh: () => void;
  onEditOwner: () => void;
}

function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  return first || "";
}

function petKey(pet: PetData): string {
  return `${pet.petType}:${pet.petName.trim().toLowerCase()}`;
}

/**_distancia redondeada con 1 decimal entre la dirección guardada y una sede. */
function distanceToBranch(
  ownerCoords: { lat: number | null; lng: number | null },
  branchCoords: { lat: number; lng: number },
): number | null {
  if (ownerCoords.lat === null || ownerCoords.lng === null) return null;
  return haversineKm(branchCoords, { lat: ownerCoords.lat, lng: ownerCoords.lng });
}

function BranchPicker({
  currentBranch,
  ownerCoords,
  onSelect,
}: {
  currentBranch: FormData["branch"];
  ownerCoords: { lat: number | null; lng: number | null };
  onSelect: (branch: FormData["branch"]) => void;
}) {
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-[#DCEBFF] bg-[#F7FBFF] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#546A8E]">
        Sede para esta reserva — según tu dirección guardada:
      </p>
      {BRANCHES.map((branch) => {
        const selected = currentBranch === branch.value;
        const distance = distanceToBranch(ownerCoords, branch.coords);
        const outOfRange = distance !== null && distance > MAX_PICKUP_DISTANCE_KM;
        return (
          <button
            key={branch.value}
            type="button"
            disabled={outOfRange}
            onClick={() => !outOfRange && onSelect(branch.value)}
            aria-pressed={selected}
            title={outOfRange ? `Tu dirección queda a ${distance?.toFixed(1)} km: fuera del radio de recojo` : undefined}
            className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
              outOfRange
                ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-70"
                : selected
                  ? "cursor-pointer border-orange-400 bg-orange-50 shadow-sm"
                  : "cursor-pointer border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/50"
            }`}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={`truncate font-semibold ${selected ? "text-orange-700" : "text-[#1A2238]"}`}>
                {branch.label.replace("Sede ", "")}
                {selected && <span className="ml-1.5 text-[11px] font-medium text-orange-600">(tu sede)</span>}
              </span>
              {outOfRange && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-red-600">
                  <TriangleAlert className="h-3 w-3 shrink-0" />
                  Fuera de cobertura de recojo ({MAX_PICKUP_DISTANCE_KM} km máx.)
                </span>
              )}
            </span>
            {distance !== null && (
              <span
                className={`shrink-0 text-[11px] font-semibold ${
                  outOfRange ? "text-red-500" : "text-emerald-600"
                }`}
              >
                a {distance.toFixed(1)} km
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Ilustración completa de la familia (perrito + gatito + mancha + rayitas
 *  + letrita integrados en la imagen vetMascot/DogAndCat.webp). */
function MascotIllustration({ className = "" }: { className?: string }) {
  return (
    <img
      src="/images/vetMascot/DogAndCat.webp"
      alt="Perrito y gatito: ellos también son familia"
      className={`h-44 rounded-[28px] object-contain sm:h-48 lg:h-52 ${className}`}
    />
  );
}

function ServiceItem({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#546A8E]">
      <Icon className="h-3.5 w-3.5 shrink-0 text-orange-500" />
      {children}
    </p>
  );
}

function PetCard({
  pet,
  index,
  selected,
  onToggle,
  onRemove,
}: {
  pet: PetData;
  index: number;
  selected: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const subtitle = [PET_TYPE_LABELS[pet.petType], pet.size ? SIZE_LABELS[pet.size] : null]
    .filter(Boolean)
    .join(" • ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 * index }}
      className="relative"
    >
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className={`flex w-full cursor-pointer items-center gap-4 rounded-2xl border-2 bg-white py-4 pl-4 pr-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
          selected
            ? "border-orange-400 shadow-md shadow-orange-100"
            : "border-gray-200 hover:border-orange-200"
        }`}
      >
        <div className="relative shrink-0">
          <img
            src={pet.petType === "cat" ? "/images/petType/cat.webp" : "/images/petType/dog.webp"}
            alt={PET_TYPE_LABELS[pet.petType]}
            className={`h-16 w-16 rounded-full object-cover transition-all ${
              selected ? "ring-2 ring-orange-300" : "ring-2 ring-gray-200 opacity-90"
            }`}
          />
          <span className="absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-white shadow-md ring-2 ring-white">
            <PawPrint className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold tracking-tight text-[#475AAB] sm:text-lg">
            {pet.petName || `Mascota ${index + 1}`}
          </p>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          <ServiceItem icon={Scissors}>{SERVICE_LABELS[pet.service]}</ServiceItem>
        </div>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
            selected
              ? "bg-orange-500 text-white shadow-md shadow-orange-200"
              : "border-2 border-gray-300 bg-white text-transparent"
          }`}
        >
          <Check className="h-5 w-5" strokeWidth={3} />
        </span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Eliminar a ${pet.petName || `mascota ${index + 1}`} de tus mascotas guardadas`}
        className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-red-50 hover:text-red-500"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

export function WelcomeBackStep({
  formData,
  savedPets,
  update,
  onUseProfile,
  onRemoveSavedPet,
  onAddPet,
  onStartBooking,
  onStartFresh,
  onEditOwner,
}: WelcomeBackStepProps) {
  const [petToRemove, setPetToRemove] = useState<{ index: number; name: string } | null>(null);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set(savedPets.map(petKey)));
  const name = firstName(formData.ownerName);
  const hasPets = savedPets.length > 0;
  const selectedPets = savedPets.filter((pet) => selectedKeys.has(petKey(pet)));
  const selectedCount = selectedPets.length;
  const branchLabel = formData.branch ? BRANCH_LABELS[formData.branch] : null;

  const togglePet = (pet: PetData) => {
    const key = petKey(pet);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!hasPets) {
    return (
      <div>
        <div className="mb-6 text-center sm:mb-8">
          <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 shadow-sm">
            <PawPrint className="h-6 w-6 text-orange-500" />
          </span>
          <h2 className="text-step-title font-display font-bold tracking-tight text-[#475AAB]">
            ¿Es tu primera vez agendando{" "}
            <span className="text-orange-500">grooming</span> aquí?
          </h2>
          <p className="mt-3 max-w-lg text-sm text-[#546A8E] sm:text-base lg:max-w-xl">
            Solo la primera vez te pediremos tus datos. Quedarán guardados en tu navegador para
            que tus próximas reservas tarden menos de un minuto.
          </p>
        </div>

        <MascotIllustration className="mx-auto mb-6 block w-fit sm:mb-8" />

        <div className="mb-6 rounded-2xl border border-[#DCEBFF] bg-[#F7FBFF] p-4 sm:p-5">
          <ul className="space-y-2.5 text-sm text-gray-600">
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
              </span>
              Tu primera reserva toma el flujo completo: sede → mascota → fecha → tus datos.
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
              </span>
              La próxima vez verás aquí tus mascotas y solo eliges fecha y horario.
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
              </span>
              Tus datos no salen de tu navegador.
            </li>
          </ul>
        </div>

        <button
          onClick={onStartBooking}
          className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-orange-400 px-6 py-4 text-lg font-bold text-white shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
        >
          <LogIn className="h-5 w-5" />
          Comenzar mi reserva
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Saludo + ilustración con decoración estilo mockup (blob, rayitas, corazón).
          En pantallas medianas se apila: solo en escritorio va el texto a la izquierda. */}
      <div className="mb-6 flex flex-col sm:mb-8 lg:flex-row lg:items-center lg:gap-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 shadow-sm sm:h-12 sm:w-12">
              <PawPrint className="h-5 w-5 text-orange-500 sm:h-6 sm:w-6" />
            </span>
            <div className="min-w-0">
              <h2 className="text-step-title font-display font-bold leading-tight tracking-tight text-[#475AAB]">
                ¡Qué gusto verte{name ? "," : ""}{" "}
                {name && <span className="text-orange-500">{name}!</span>}
              </h2>
              <p className="mt-2 max-w-md text-sm text-[#546A8E] sm:text-base">
                Guardamos los datos de tu última reserva. Toca a{" "}
                {savedPets.length === 1 ? "tu peludito" : "los peluditos"} que van esta vez —
                puedes cambiar el servicio o la dirección en el resumen.
              </p>
            </div>
          </div>
        </div>
        <MascotIllustration className="mx-auto mt-4 w-fit max-w-full self-center lg:mx-0 lg:mt-0 lg:shrink-0" />
      </div>

      <div className="mb-5 space-y-3">
        {savedPets.map((pet, index) => (
          <PetCard
            key={`${petKey(pet)}-${index}`}
            pet={pet}
            index={index}
            selected={selectedKeys.has(petKey(pet))}
            onToggle={() => togglePet(pet)}
            onRemove={() =>
              setPetToRemove({ index, name: pet.petName || `Mascota ${index + 1}` })
            }
          />
        ))}

        <button
          type="button"
          onClick={onAddPet}
          className="flex w-full cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 px-4 py-4 text-left transition-all duration-200 hover:border-blue-400 hover:bg-[#F7FBFF]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
            <Plus className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#475AAB]">Registrar nueva mascota</span>
            <span className="block text-xs text-gray-500">
              Si esta vez reservas para una mascota que aún no conocemos
            </span>
          </span>
        </button>
      </div>

      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="min-w-0 break-words text-sm font-semibold text-[#475AAB]">
                {formData.ownerName}
                <span className="font-normal text-gray-400"> · {formData.registeredPhone || formData.ownerPhone}</span>
              </p>
              <p className="mt-1 flex items-start gap-1.5 text-xs text-gray-500">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2563EB]" />
                <span className="leading-snug">{formData.ownerAddress}</span>
              </p>
              {branchLabel && !showBranchPicker && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Sede de tu última reserva: {branchLabel}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:mt-0">
            <button
              type="button"
              onClick={() => setShowBranchPicker((v) => !v)}
              aria-expanded={showBranchPicker}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                showBranchPicker
                  ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
                  : "border border-blue-100 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              } sm:flex-none sm:px-2 sm:py-1.5 sm:border-0`}
            >
              {showBranchPicker ? <X className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
              Cambiar sede
            </button>
            <button
              type="button"
              onClick={onEditOwner}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-blue-100 px-2 py-2 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 sm:flex-none sm:border-0 sm:px-2 sm:py-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar datos
            </button>
          </div>
        </div>
        {showBranchPicker && (
          <BranchPicker
            currentBranch={formData.branch}
            ownerCoords={{ lat: formData.ownerLat, lng: formData.ownerLng }}
            onSelect={(branch) => {
              update("branch", branch);
              setShowBranchPicker(false);
            }}
          />
        )}
      </div>

      <button
        onClick={() => onUseProfile(selectedPets)}
        disabled={selectedCount === 0}
        className={`flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-lg font-bold text-white shadow-md transition-all ${
          selectedCount === 0
            ? "cursor-not-allowed bg-gray-200 text-gray-400"
            : "cursor-pointer bg-gradient-to-r from-blue-600 to-orange-400 hover:shadow-lg active:scale-[0.98]"
        }`}
      >
        <CalendarCheck className="h-5 w-5" />
        {selectedCount === 0
          ? "Selecciona al menos una mascota"
          : `Agendar con ${selectedCount === 1 ? "1 mascota" : `${selectedCount} mascotas`}`}
        {selectedCount > 0 && <ArrowRight className="h-5 w-5" />}
      </button>

      <button
        onClick={onStartFresh}
        className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 transition-all hover:border-blue-300 hover:text-gray-800 active:scale-[0.98]"
      >
        <UserPlus className="h-4 w-4" />
        Reservar con otros datos
      </button>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        Tus datos se guardan solo en este navegador, nunca salen de tu dispositivo.
      </p>

      <AnimatePresence>
        {petToRemove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setPetToRemove(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center">
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <Trash2 className="h-6 w-6" />
                </span>
                <h3 className="text-lg font-semibold text-gray-900">
                  ¿Eliminar a {petToRemove.name} de tus mascotas guardadas?
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                  Ya no aparecerá en este listado para tus próximas reservas. Si solo no va hoy,
                  simplemente desmárcala. Tus reservas ya agendadas no se ven afectadas.
                </p>
                <div className="mt-6 flex w-full gap-3">
                  <button
                    type="button"
                    onClick={() => setPetToRemove(null)}
                    className="flex-1 cursor-pointer rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRemoveSavedPet(petToRemove.index);
                      setPetToRemove(null);
                    }}
                    className="flex-1 cursor-pointer rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-red-700 active:scale-[0.98]"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
