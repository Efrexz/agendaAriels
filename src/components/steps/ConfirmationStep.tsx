import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  MapPin,
  ExternalLink,
  Loader2,
  Phone,
  PhoneCall,
  Calendar,
  CalendarClock,
  Clock,
  LockKeyholeOpen,
  User,
  ShieldCheck,
  CircleCheck,
  Scissors,
  Droplets,
  StickyNote,
  Pill,
  Bug,
  Syringe,
  FlaskConical,
  Sparkles,
  PawPrint,
  Ruler,
  Plus,
  Trash2,
  Pencil,
  type LucideIcon,
} from "lucide-react";
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
  onRemovePet?: (index: number) => void;
  onEditPet?: (index: number) => void;
}

type SubmitState = "idle" | "loading" | "success" | "error";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return format(d, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
}

function stripEmoji(s: string): string {
  return s.replace(/^[^\wáéíóúÁÉÍÓÚñÑ]+/, "").trim();
}

function getInitials(name: string, fallback: string): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const EXTRA_ICON: Record<string, LucideIcon> = {
  deworming: Pill,
  antiflea: Bug,
  vaccine: Syringe,
};

function ServiceItem({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-sm text-gray-700">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="leading-snug">{children}</span>
    </li>
  );
}

function PetCard({ pet, index, onRemove, onEdit }: { pet: PetData; index: number; onRemove?: (index: number) => void; onEdit?: (index: number) => void }) {
  const name = pet.petName || `Mascota ${index + 1}`;
  const subtitle = [
    PET_TYPE_LABELS[pet.petType],
    pet.size ? SIZE_LABELS[pet.size] : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group relative flex flex-col gap-5 rounded-[22px] border border-gray-100/80 bg-white p-6 shadow-[0_10px_30px_-12px_rgba(29,78,216,0.15)] transition-all duration-250 ease-out hover:-translate-y-1 hover:shadow-[0_18px_40px_-12px_rgba(29,78,216,0.22)] sm:p-7"
    >
      {(onRemove || onEdit) && (
        <div className="absolute -right-2 -top-2 z-20 flex gap-1.5">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(index); }}
              aria-label={`Editar a ${name}`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-400 shadow-md transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(index); }}
              aria-label={`Eliminar a ${name}`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-400 shadow-md transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0">
          <img
            src={pet.petType === "cat" ? "/images/petType/cat.webp" : "/images/petType/dog.webp"}
            alt={pet.petType === "cat" ? "Gato" : "Perro"}
            className="h-16 w-16 rounded-full object-cover ring-2 ring-blue-100 shadow-md shadow-blue-200/50"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tracking-tight text-gray-900">{name}</p>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>

      <ul className="space-y-3">
        <ServiceItem icon={Sparkles}>{SERVICE_LABELS[pet.service]}</ServiceItem>
        {pet.bathType && BATH_LABELS[pet.bathType] && (
          <ServiceItem icon={Droplets}>{BATH_LABELS[pet.bathType]}</ServiceItem>
        )}
        {pet.service === "bath_cut" && pet.corteType && CORTE_LABELS[pet.corteType] && (
          <ServiceItem icon={Scissors}>{CORTE_LABELS[pet.corteType]}</ServiceItem>
        )}
        {pet.service === "bath_cut" && pet.corteSpecs && (
          <ServiceItem icon={Ruler}>{pet.corteSpecs}</ServiceItem>
        )}
        {pet.service === "bath_cut" && pet.corteImage && (
          <li className="mt-1">
            <img
              src={pet.corteImage}
              alt="Referencia de corte"
              className="h-20 w-20 rounded-2xl border border-gray-100 object-cover"
            />
          </li>
        )}
        {pet.extraServices && pet.extraServices.length > 0 && (
          <>
            {pet.extraServices.map((extra, i) => {
              const Icon = EXTRA_ICON[extra.service] ?? Pill;
              return (
                <ServiceItem key={i} icon={Icon}>
                  {formatExtraLabel(extra)}
                </ServiceItem>
              );
            })}
          </>
        )}
        {pet.perfume && PERFUME_LABELS[pet.perfume] && (
          <ServiceItem icon={FlaskConical}>{stripEmoji(PERFUME_LABELS[pet.perfume])}</ServiceItem>
        )}
        {pet.petNotes && (
          <ServiceItem icon={StickyNote}>{pet.petNotes}</ServiceItem>
        )}
      </ul>
    </motion.div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-[#E8EEF7] bg-white p-6 shadow-[0_1px_3px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.06)] sm:p-7">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue text-white">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function ConfirmationStep({ formData, onBack: _onBack, onAddAnother, onRemovePet, onEditPet }: ConfirmationStepProps) {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string>("");
  const [petToRemove, setPetToRemove] = useState<{ index: number; name: string } | null>(null);

  const branch = formData.branch ? BRANCH_BY_VALUE[formData.branch] : null;
  const branchPhone = branch?.phone ?? null;
  const hasNoPets = formData.pets.length === 0;

  const handleRemoveRequest = (index: number) => {
    const pet = formData.pets[index];
    const name = pet?.petName || `Mascota ${index + 1}`;
    setPetToRemove({ index, name });
  };

  const confirmRemove = () => {
    if (petToRemove) {
      onRemovePet?.(petToRemove.index);
    }
    setPetToRemove(null);
  };

  const cancelRemove = () => setPetToRemove(null);

  useEffect(() => {
    if (!petToRemove) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelRemove();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [petToRemove]);

  const handleSubmit = async () => {
    if (submitState === "loading" || hasNoPets) return;
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
      <div className="flex flex-col items-center gap-4 py-6">
        <motion.img
          src="/images/vetMascot/agendado.png"
          alt="Bulldog feliz manejando la movilidad"
          className="h-auto w-72 object-contain sm:w-[28rem]"
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
        <h2 className="text-center text-step-title font-display font-bold tracking-tight text-green-700">
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
      <div className="flex flex-col items-center gap-4 py-6">
        <motion.img
          src="/images/vetMascot/errorAgenda.png"
          alt="Bulldog mirando con cara preocupada"
          className="h-auto w-72 object-contain sm:w-[28rem]"
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
        <h2 className="text-2xl font-bold tracking-tight text-red-600">
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
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <h2 className="mb-2 text-step-title font-display font-bold tracking-tight text-gray-900">
          Revisa y confirma tu reserva
        </h2>
        <p className="mx-auto max-w-md text-sm text-gray-500">
          Verifica que toda la información sea correcta antes de confirmar la reserva.
        </p>
      </motion.div>

      {branch && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="relative min-h-[180px] overflow-hidden rounded-[20px] shadow-xl shadow-blue-900/20 sm:min-h-[190px]"
        >
          <img
            src={branch.image}
            alt={branch.label}
            className="absolute inset-0 h-full w-full scale-105 object-cover blur-[2px] saturate-[0.6]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-950/80 via-blue-900/65 to-blue-900/30" />
          <div className="relative flex h-full min-h-[180px] flex-col justify-center p-5 sm:min-h-[190px] sm:p-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
              <MapPin className="h-3.5 w-3.5" />
              Sede seleccionada
            </span>
            <h3 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {BRANCH_LABELS[formData.branch!]}
            </h3>
            <div className="mt-4 flex flex-col gap-3 text-sm text-blue-50">
              <p className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-white" />
                {branch.address}
              </p>
              <p className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-white" />
                {branch.phone}
              </p>
            </div>
          </div>
        </motion.section>
      )}

      <SectionCard title="Mascotas Agendadas" icon={PawPrint}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {formData.pets.map((pet, i) => (
            <PetCard key={i} pet={pet} index={i} onRemove={onRemovePet ? handleRemoveRequest : undefined} onEdit={onEditPet} />
          ))}
          {onAddAnother && (
            <button
              type="button"
              onClick={onAddAnother}
              className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed border-gray-300 bg-white/50 transition-all duration-250 ease-out cursor-pointer hover:border-[#2563EB] hover:bg-[#F7FBFF] hover:-translate-y-1 hover:shadow-[0_14px_34px_-12px_rgba(29,78,216,0.15)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                <Plus className="h-6 w-6" />
              </span>
              <span className="text-sm font-medium text-gray-600">
                Agregar otra mascota
              </span>
            </button>
          )}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
        <SectionCard title="Agenda" icon={CalendarClock}>
        <div className="grid grid-cols-1 gap-1">
          <div className="flex items-start gap-4 rounded-[14px] border border-[#DCEBFF] bg-[#F7FBFF] p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
              <Calendar className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Fecha</p>
              <p className="mt-1 text-base font-semibold text-[#0F172A]">
                {formData.date ? formatDate(formData.date) : "-"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-[14px] border border-[#DCEBFF] bg-[#F7FBFF] p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
              <Clock className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Horario</p>
              <p className="mt-1 text-base font-semibold text-[#0F172A]">
                {TIME_LABELS[formData.timeRange ?? ""] ?? "-"}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Datos del cliente" icon={User}>
        <div className="flex items-start gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-blue text-lg font-semibold text-white shadow-md shadow-blue-200/50">
            {getInitials(formData.ownerName, "--")}
          </div>
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            <div className="flex items-start gap-3">
              <span className="h-8 w-8 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Nombre</p>
                <p className="mt-1 truncate text-sm font-semibold text-[#0F172A]">{formData.ownerName || "-"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                <Phone className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Teléfono</p>
                <p className="mt-1 truncate text-sm font-semibold text-[#0F172A]">{formData.ownerPhone || "-"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 sm:col-span-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                <MapPin className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Dirección</p>
                <div className="mt-1 flex items-start gap-2">
                  <p className="text-sm font-semibold text-[#0F172A]">{formData.ownerAddress || "-"}</p>
                  {formData.ownerLat && formData.ownerLng && (
                    <a
                      href={`https://www.google.com/maps?q=${formData.ownerLat},${formData.ownerLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 flex shrink-0 items-center gap-1 text-[#2563EB] transition-colors hover:text-[#1d4ed8]"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            {formData.mobilityPhoneDifferent && formData.mobilityPhone && (
              <div className="flex items-start gap-3 sm:col-span-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                  <PhoneCall className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Tel. movilidad</p>
                  <p className="mt-1 truncate text-sm font-semibold text-[#0F172A]">{formData.mobilityPhone}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative mb-4 flex items-center gap-3 overflow-visible rounded-[18px] border border-[#CFE2FF] bg-[#F3F8FF] p-4"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="flex-1 pr-24 sm:pr-28">
          <p className="text-sm font-medium text-[#0F172A]">
            Tu reserva quedará confirmada al presionar el botón.
          </p>
          <p className="mt-0.5 text-sm text-gray-500">
            Te enviaremos una confirmación por WhatsApp con todos los detalles.
          </p>
        </div>
        <div className="absolute right-0 top-1/2 z-10 -translate-y-[70%] translate-x-[10%]">
          <motion.img
            src="/images/vetMascot/copy.png"
            alt="Asistente mascota"
            className="h-28 w-28 object-contain drop-shadow-md sm:h-32 sm:w-32"
            initial={{ opacity: 0, scale: 0.85, x: 12 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          />
        </div>
      </motion.div>

      <button
        onClick={handleSubmit}
        disabled={submitState === "loading" || hasNoPets}
        className={`flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl text-lg font-bold text-white transition-all ${
          submitState === "loading"
            ? "cursor-wait bg-blue-400"
            : hasNoPets
              ? "cursor-not-allowed bg-gray-300"
              : "cursor-pointer bg-brand-blue hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200/50 hover:-translate-y-0.5 active:scale-[0.98]"
        }`}
      >
        {submitState === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Enviando...
          </span>
        ) : (
          <>
            <CircleCheck className="h-7 w-7" />
            Confirmar Reserva
          </>
        )}
      </button>
      {hasNoPets ? (
        <p className="text-center text-xs text-gray-500">
          Agrega al menos una mascota para continuar.
        </p>
      ) : (
        <p className="flex justify-center items-center gap-1.5 text-center text-xs text-gray-500">
          <LockKeyholeOpen className="h-4 w-4" />
          No se realizará ningún cobro en este momento.
        </p>
      )}

      <AnimatePresence>
        {petToRemove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={cancelRemove}
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
                <h3 className="text-lg font-semibold text-gray-900">¿Eliminar mascota?</h3>
                <p className="mt-1.5 text-sm text-gray-500">
                  ¿Seguro que quieres eliminar a <span className="font-semibold text-gray-700">{petToRemove.name}</span> de tu reserva?
                </p>
                <div className="mt-6 flex w-full gap-3">
                  <button
                    type="button"
                    onClick={cancelRemove}
                    className="flex-1 cursor-pointer rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmRemove}
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
