import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, CalendarDays, CheckCircle2, Check, ChevronLeft, ChevronRight,
  ClipboardList, Clock, FileCheck2, FileX2, Heart, Info, Loader2, MapPin, Microscope, Phone,
  ScanLine, ShieldCheck, Stethoscope, Sunrise, Sunset, UserRound, type LucideIcon,
} from "lucide-react";
import { CalendarCard } from "./CalendarCard";
import { clearMedProfile, loadMedProfile, saveMedProfile } from "./clientProfileMed";
import { createAppointment, fetchDoctors, fetchSlots, fetchSpecialties,
  MED_BRANCH_PHONES, MED_BRANCHES, type MedBranch, type MedDoctor, type MedSlot, type MedSpecialty,
} from "./api";
import { BRANCHES, isBranchOpen } from "../data/branches";
import { LazyImage } from "../components/LazyImage";
import { WhatsAppButton } from "../components/WhatsAppButton";

// Wizard de citas médicas: sede → servicio → especialidad/doctor → fecha/hora → datos → CM-XXXXX.
// Presentación con el sistema Ariel del wizard grooming (BookingWizard): card grande,
// logo, biombo, framer-motion (0.4s easeOut, reduced-motion) y mascota webp en hitos.
// NO cambia lógica ni APIs — mismos handlers/estados queProduction probados.

type ServiceType = "general" | "rayos" | "eco" | "especializada";
type Step = "sede" | "servicio" | "orden" | "sin_orden" | "especialidad" | "doctor" | "agenda" | "datos" | "enviado";

interface FormData {
  branch: MedBranch | null;
  serviceType: ServiceType | null;
  specialtyId: string | null;
  specialtyName: string | null;
  specialtyCost: number | null;
  doctorId: string | null;
  doctorName: string | null;
  date: string | null;
  startMinute: number | null;
  hasOrder: boolean | null;
  petName: string;
  petType: string;
  petNotes: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
}

const INITIAL: FormData = {
  branch: null, serviceType: null, specialtyId: null, specialtyName: null, specialtyCost: null,
  doctorId: null, doctorName: null, date: null, startMinute: null, hasOrder: null,
  petName: "", petType: "Perro", petNotes: "", ownerName: "", ownerPhone: "", ownerEmail: "",
};

// Rutas FINALES de imágenes (placeholders actuales = copias de vetMascot/grooming;
// reemplazar los archivos webp cuando lleguen los definitivos — sin tocar código).
const MASCOT = {
  orden: "/images/vetMascot/orden.webp",
  doctor: "/images/vetMascot/doctor.webp",
  esperando: "/images/vetMascot/esperando.webp",
  pago: "/images/vetMascot/pago.webp",
  agendado: "/images/vetMascot/agendado.webp",
  errorAgenda: "/images/vetMascot/errorAgenda.webp",
};

const SERVICE_IMAGE: Record<ServiceType, { src: string; alt: string }> = {
  general: { src: "/images/medical/servicio/general.webp", alt: "Consulta general veterinaria" },
  rayos: { src: "/images/medical/servicio/rayos.webp", alt: "Radiografía veterinaria" },
  eco: { src: "/images/medical/servicio/eco.webp", alt: "Ecografía veterinaria" },
  especializada: { src: "/images/medical/servicio/especializada.webp", alt: "Consulta especializada veterinaria" },
};

function todayMinPlus(): string {
  const max = new Date();
  max.setDate(max.getDate() + 30);
  return max.toISOString().slice(0, 10);
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d)).toLocaleDateString("es-PE", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long",
  });
}

function hora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

const SERVICES: Array<{ id: ServiceType; label: string; desc: string; icon: typeof Stethoscope }> = [
  { id: "general", label: "Consulta General", desc: "Revisión y diagnóstico general", icon: Stethoscope },
  { id: "rayos", label: "Radiografía", desc: "Requiere orden médica con sello", icon: ScanLine },
  { id: "eco", label: "Ecografía", desc: "Requiere orden médica con sello", icon: ClipboardList },
  { id: "especializada", label: "Consulta Especializada", desc: "Cardiología, dermatología y más", icon: Microscope },
];

// Grupos del progreso (4): sede / servicio / agenda / datos
const PROGRESS_GROUPS: Array<{ label: string; steps: Step[] }> = [
  { label: "Sede", steps: ["sede"] },
  { label: "Servicio", steps: ["servicio", "orden", "sin_orden", "especialidad", "doctor"] },
  { label: "Agenda", steps: ["agenda"] },
  { label: "Datos", steps: ["datos"] },
];

export default function App() {
  const [step, setStep] = useState<Step>("sede");
  const [form, setForm] = useState<FormData>(INITIAL);
  const [doctors, setDoctors] = useState<MedDoctor[] | null>(null);
  const [specialties, setSpecialtyList] = useState<MedSpecialty[] | null>(null);
  const [slots, setSlots] = useState<MedSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [copia, setCopia] = useState(false);
  // Idea 1: ¿estamos mostrando datos guardados del navegador del cliente?
  const [recordados, setRecordados] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  // Candado anti doble-click (400ms): solo la primera transición pasa.
  const transitionLock = useRef(0);
  const go = useCallback((s: Step) => {
    if (Date.now() - transitionLock.current < 400) return;
    transitionLock.current = Date.now();
    setStep(s);
  }, []);

  const update = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
  }, []);

  const back = () => {
    setError(null);
    const prev: Record<Step, Step> = {
      sede: "sede", servicio: "sede", orden: "servicio", sin_orden: "servicio",
      especialidad: "servicio", doctor: "servicio", agenda: "doctor", datos: "agenda", enviado: "sede",
    };
    // Especializada ("interconsulta") no pasa por el calendario: su fecha la
    // fija el counter después del pago. El back de datos/agenda regresa a la
    // especialidad — igual al paso que llamó a go() — y NUNCA recrea el bucle
    // datos ⇄ agenda que atrapaba al usuario.
    if (form.serviceType === "especializada" && (step === "datos" || step === "agenda")) {
      go("especialidad");
    } else {
      go(prev[step]);
    }
  };

  // Paso servicio → carga: doctores (general/rayos/eco) o especialidades
  async function chooseService(t: ServiceType) {
    setError(null);
    update("serviceType", t);
    if (t === "general" || t === "rayos" || t === "eco") {
      if (t !== "general") {
        go("orden");
        return;
      }
      go("doctor");
    } else {
      go("especialidad");
    }
  }

  async function loadSlots(date: string, doctorId: string) {
    await Promise.resolve();
    setSlotsLoading(true);
    setError(null);
    try {
      setSlots(await fetchSlots(doctorId, date));
    } catch (err) {
      setSlots([]);
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setSlotsLoading(false);
    }
  }

  // Carga diferida según el paso: patrón IIFE (setState tras await)
  useEffect(() => {
    if (step !== "especialidad" && step !== "doctor") return;
    let active = true;
    (async () => {
      try {
        if (step === "especialidad") {
          const list = await fetchSpecialties(form.branch!);
          if (active) {
            setSpecialtyList(list);
            setError(null);
          }
        } else {
          const all = await fetchDoctors(form.branch!);
          if (active) {
            setDoctors(all.filter((d) => d.kind === "general"));
            setError(null);
          }
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Error de conexión");
      }
    })();
    return () => {
      active = false;
    };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-consultar slots al ENTRAR al paso de agenda (si ya había fecha elegida):
  // evita guardar una hora desactualizada al volver desde "datos".
  useEffect(() => {
    if (step !== "agenda" || !form.date || !form.doctorId) return;
    let active = true;
    (async () => {
      try {
        const fresh = await fetchSlots(form.doctorId!, form.date!);
        if (active) {
          setSlots(fresh);
          setError(null);
        }
      } catch {
        /* conserva los slots ya cargados */
      }
    })();
    return () => {
      active = false;
    };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Idea 1: al ENTRAR a datos, si hay perfil guardado del navegador (una cita
  // anterior registrada con éxito) y el dueño aún no escribió nada, se
  // rellenan los campos + un aviso con botón para olvidarlos.
  useEffect(() => {
    if (step !== "datos") return;
    let active = true;
    (async () => {
      // Frontera async: los setState ocurren tras await (regla react-hooks).
      await Promise.resolve();
      if (!active) return;
      const profile = loadMedProfile();
      if (!profile) return;
      setForm((f) => {
        if (f.ownerName.trim() || f.ownerPhone.trim()) return f; // ya escribió: no tocar
        return {
          ...f,
          ownerName: f.ownerName || profile.ownerName,
          ownerPhone: f.ownerPhone || profile.ownerPhone,
          ownerEmail: f.ownerEmail || profile.ownerEmail,
        };
      });
      if (active) setRecordados(true);
    })();
    return () => {
      active = false;
    };
  }, [step]);

  // Olvidar: borra el perfil del navegador y limpia los campos del dueño.
  function olvidarDatos() {
    clearMedProfile();
    setForm((f) => ({ ...f, ownerName: "", ownerPhone: "", ownerEmail: "" }));
    setRecordados(false);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createAppointment({
        branch: form.branch!,
        serviceType: form.serviceType!,
        specialtyId: form.serviceType === "especializada" ? form.specialtyId : null,
        doctorId: form.serviceType === "especializada" ? null : form.doctorId,
        date: form.serviceType === "especializada" ? null : form.date,
        startMinute: form.serviceType === "especializada" ? null : form.startMinute,
        hasOrder:
          form.serviceType === "rayos" || form.serviceType === "eco"
            ? form.hasOrder === true
            : null,
        petName: form.petName.trim(),
        petType: form.petType,
        petNotes: form.petNotes.trim() || "-",
        ownerName: form.ownerName.trim(),
        ownerPhone: form.ownerPhone.trim(),
        ownerEmail: form.ownerEmail.trim() || "-",
      });
      // Idea 1: el dueño se recuerda en SU navegador al lograr registrar la
      // cita (mismo espíritu que el grooming — nunca sale del dispositivo).
      saveMedProfile({
        ownerName: form.ownerName,
        ownerPhone: form.ownerPhone,
        ownerEmail: form.ownerEmail.trim() || "",
      });
      setCode(result.appointmentCode);
      go("enviado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la cita");
    } finally {
      setSubmitting(false);
    }
  }

  const branch = MED_BRANCHES.find((b) => b.value === form.branch) ?? null;
  const groupIndex = PROGRESS_GROUPS.findIndex((g) => g.steps.includes(step));
  const canSubmit =
    form.petName.trim().length >= 2 &&
    form.ownerName.trim().length >= 3 &&
    form.ownerPhone.trim().length >= 6;

  return (
    <div className="flex min-h-screen items-center justify-center p-2 pb-24 sm:p-4 sm:pb-28">
      <div ref={cardRef} className="w-full max-w-2xl lg:max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="h-3 bg-gradient-to-r from-blue-500 to-orange-400" />
        <div className="p-4 sm:p-6 lg:p-10">
          {/* Brand header (idéntico al grooming) */}
          <div className="mb-1">
            <div className="flex items-center justify-between">
              <a href="/" aria-label="Veterinaria Ariel — inicio">
                <img
                  src="/logo.webp"
                  alt="Veterinaria Ariel"
                  className="h-12 sm:h-14 lg:h-16"
                />
              </a>
              <div className="hidden items-center gap-3 rounded-2xl bg-gradient-to-r from-[#FFF7ED] to-[#FFFDF8] py-2 pl-2.5 pr-4 shadow-sm ring-1 ring-orange-200/70 sm:flex">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-orange-100">
                  <span className="text-lg">🩺</span>
                </span>
                <div className="text-left leading-tight">
                  <p className="text-[13px] font-bold text-[#475AAB]">Más de 10 años</p>
                  <p className="text-[11px] text-[#546A8E]">cuidando la salud de tu mascota</p>
                </div>
              </div>
            </div>
            <div className="mt-3 sm:mt-4 h-px w-full bg-[#DCEBFF]" />
          </div>

          {/* Progreso con puntos numerados + etiquetas (maqueta "Confirma tu cita") */}
          {groupIndex >= 0 && <StepProgress groups={PROGRESS_GROUPS} current={groupIndex} />}

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-2.5 text-center text-sm font-medium text-red-700"
            >
              {error}
            </motion.p>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: reduceMotion ? 0 : 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduceMotion ? 0 : -30 }}
              transition={{ duration: reduceMotion ? 0.2 : 0.4, ease: "easeOut" }}
            >
          {/* ── Paso: sede ── */}
          {step === "sede" && (
            <SedeStep
              selected={form.branch}
              onPick={(b) => update("branch", b)}
              onContinue={() => go("servicio")}
            />
          )}

              {/* ── Paso: servicio ── */}
              {step === "servicio" && (
                <section>
                  <StepHeading kicker={`Sede ${branch?.short ?? ""}`}>
                    ¿Qué <span className="text-orange-500">necesita tu mascota</span>?
                  </StepHeading>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    {SERVICES.map((s) => {
                      const img = SERVICE_IMAGE[s.id];
                      return (
                        <button
                          key={s.id}
                          onClick={() => void chooseService(s.id)}
                          className="group flex flex-col overflow-hidden rounded-3xl bg-white text-left shadow-md ring-1 ring-[#DCEBFF] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98]"
                        >
                          <div className="relative aspect-[16/10] w-full overflow-hidden">
                            <LazyImage
                              src={img.src}
                              alt={img.alt}
                              className="transition-transform duration-500 ease-out group-hover:scale-105"
                            />
                            <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-blue-600 shadow-lg">
                              <s.icon className="h-5 w-5" />
                            </span>
                          </div>
                          <div className="flex items-center gap-3 bg-[#EAF2FB] px-5 py-4">
                            <div className="flex flex-1 flex-col gap-0.5">
                              <span className="text-[15px] font-semibold tracking-tight text-[#1A2238]">{s.label}</span>
                              <span className="text-xs leading-snug text-[#546A8E]">{s.desc}</span>
                            </div>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-gray-400 transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white">
                              <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ── Orden médica: pregunta (estilo maqueta: 2 columnas, mascota con rayos/eco/orden) ── */}
              {step === "orden" && (
                <section className="grid items-center gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
                  {/* Columna izquierda: título + nota + opciones */}
                  <div>
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <span className="h-1 w-6 rounded-full bg-orange-500" aria-hidden />
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">Radiografía y ecografía</p>
                    </div>
                    <h2 className="mb-4 font-display text-3xl font-bold leading-[1.12] tracking-tight text-[#475AAB] sm:text-4xl">
                      <span className="block">¿Tu mascota tiene</span>
                      <span className="block">
                        <span className="text-orange-500">orden sellada</span> por un médico?
                      </span>
                    </h2>
                    <motion.div
                      className="mb-5 flex items-start gap-3 rounded-2xl bg-[#EFF5FC] p-4 ring-1 ring-[#DCEBFF]"
                      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: reduceMotion ? 0.2 : 0.35, ease: "easeOut", delay: 0.2 }}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-blue-100">
                        <FileCheck2 className="h-5 w-5" />
                      </span>
                      <p className="pt-1 text-xs leading-relaxed text-[#3B5178]">
                        Necesitamos una orden médica <b>con sello de un médico</b> (de cualquier clínica).
                        Sin orden, primero debe pasar por una consulta general.
                      </p>
                    </motion.div>
                    <div className="flex flex-col gap-3">
                      <motion.button
                        initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduceMotion ? 0.2 : 0.35, ease: "easeOut", delay: 0.3 }}
                        onClick={() => { update("hasOrder", true); go("doctor"); }}
                        className="group flex items-center gap-4 rounded-2xl bg-green-50 px-5 py-4 text-left ring-2 ring-green-300 shadow-sm transition-all hover:-translate-y-1 hover:bg-green-100 hover:shadow-lg hover:shadow-green-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:translate-y-0 active:scale-[0.99]"
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-green-600 ring-1 ring-green-200">
                          <FileCheck2 className="h-6 w-6" />
                        </span>
                        <span className="flex-1 font-display text-xl font-bold text-green-800">Sí, tengo orden</span>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white shadow-md transition-transform group-hover:translate-x-1">
                          <ArrowRight className="h-5 w-5" />
                        </span>
                      </motion.button>
                      <motion.button
                        onClick={() => { setError(null); go("sin_orden"); }}
                        className="group flex items-center gap-4 rounded-2xl bg-white px-5 py-4 text-left ring-1 ring-slate-200 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-100/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:translate-y-0 active:scale-[0.99]"
                        initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduceMotion ? 0.2 : 0.35, ease: "easeOut", delay: 0.4 }}
                      >
                        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600 ring-1 ring-orange-200">
                          <FileX2 className="h-6 w-6" />
                          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white">
                            <span className="text-[9px] font-black leading-none">✕</span>
                          </span>
                        </span>
                        <span className="flex-1 font-display text-xl font-bold text-[#475AAB]">No tengo</span>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition-transform group-hover:translate-x-1">
                          <ArrowRight className="h-5 w-5" />
                        </span>
                      </motion.button>
                    </div>
                  </div>

                  {/* Columna derecha: ilustración completa (orden2.webp ya trae
                      blobs, placa, eco, orden, huellitas y destellos dentro) */}
                  <div className="relative mx-auto flex w-full justify-center">
                    <motion.img
                      src={MASCOT.orden}
                      alt="Mascota con su orden médica, radiografía y ecografía"
                      className="h-56 w-auto select-none object-contain sm:h-64 lg:h-80"
                      draggable={false}
                      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.88, y: reduceMotion ? 0 : 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: reduceMotion ? 0.2 : 0.45, ease: "easeOut", delay: 0.15 }}
                    />
                    {/* Fundido blanco abajo: disimula el corte brusco del arte
                        (mismo patrón que WelcomeBackStep en la agenda) */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white via-white/70 to-transparent sm:h-16"
                    />
                  </div>
                </section>
              )}

              {/* ── Sin orden: dos caminos (mismo aire que la maqueta) ── */}
              {step === "sin_orden" && (
                <section className="mx-auto max-w-2xl">
                  <div className="mb-1.5 flex items-center gap-2.5">
                    <span className="h-1 w-6 rounded-full bg-orange-500" aria-hidden />
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">Sin orden médica</p>
                  </div>
                  <h2 className="mb-3 font-display text-3xl font-bold leading-[1.15] tracking-tight text-[#475AAB] sm:text-4xl">
                    Primero toca <span className="text-orange-500">consulta general</span>
                  </h2>
                  <p className="mb-5 text-sm leading-relaxed text-[#546A8E]">
                    El médico evalúa a tu mascota y, si es necesario, te emite la orden para la
                    radiografía o ecografía el mismo día.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => { update("serviceType", "general"); update("hasOrder", null); go("doctor"); }}
                      className="group flex items-center gap-4 rounded-2xl bg-white px-5 py-4 text-left ring-1 ring-slate-200 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-100/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:translate-y-0 active:scale-[0.99]"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EFF5FC] text-blue-600 ring-1 ring-blue-100">
                        <Stethoscope className="h-6 w-6" />
                      </span>
                      <span className="flex-1 font-display text-xl font-bold text-[#475AAB]">Agendar consulta general ahora</span>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-orange-400 text-white shadow-md transition-transform group-hover:translate-x-1">
                        <ArrowRight className="h-5 w-5" />
                      </span>
                    </button>
                    <a
                      href={`https://wa.me/${MED_BRANCH_PHONES[form.branch!]}`}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-4 rounded-2xl bg-green-50 px-5 py-4 text-left ring-2 ring-green-300 shadow-sm transition-all hover:-translate-y-1 hover:bg-green-100 hover:shadow-lg hover:shadow-green-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 active:translate-y-0 active:scale-[0.99]"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-green-600 ring-1 ring-green-200">
                        <Phone className="h-6 w-6" />
                      </span>
                      <span className="flex-1 font-display text-xl font-bold text-green-800">Hablar con la sede por WhatsApp</span>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white shadow-md transition-transform group-hover:translate-x-1">
                        <ArrowRight className="h-5 w-5" />
                      </span>
                    </a>
                  </div>
                </section>
              )}

              {/* ── Especialidad (especializada) ── */}
              {step === "especialidad" && (
                <section>
                  <StepHeading kicker={`Sede ${branch?.short ?? ""}`}>
                    Elige la <span className="text-orange-500">especialidad</span>
                  </StepHeading>
                  {!specialties && <Loading />}
                  {specialties && specialties.length === 0 && (
                    <p className="rounded-2xl bg-amber-50 p-4 text-center text-sm text-amber-800">
                      Esta sede no tiene especialidades activas por ahora — elige otra sede o comunícate con nosotros.
                    </p>
                  )}
                  <div className="grid gap-3">
                    {specialties?.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          update("specialtyId", s.id);
                          update("specialtyName", s.name);
                          update("specialtyCost", s.cost);
                          go("datos");
                        }}
                        className="flex items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-[#DCEBFF] transition-all hover:-translate-y-0.5 hover:bg-[#F7FBFF] hover:shadow-md hover:ring-blue-300 active:scale-[0.98]"
                      >
                        <span className="font-semibold text-[#1A2238]">🎓 {s.name}</span>
                        <span className="rounded-full bg-brand-orange/10 px-3 py-1 text-sm font-bold text-brand-orange">
                          S/ {s.cost.toFixed(0)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-center text-[11px] text-[#8A97B1]">
                    La consulta se paga por adelantado; después confirmamos fecha, hora y doctor.
                  </p>
                </section>
              )}

              {/* ── Doctor (mismo lenguaje que el paso orden: 2 columnas + título a la izquierda) ── */}
              {step === "doctor" && (
                <section className="grid items-center gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-brand-orange" strokeWidth={2.5} />
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">Sede {branch?.short ?? ""}</p>
                    </div>
                    <h2 className="mb-5 font-display text-3xl font-bold leading-[1.12] tracking-tight text-[#475AAB] sm:text-4xl">
                      <span className="block">Elige al especialista</span>
                      <span className="block">
                        que <span className="text-orange-500">atenderá a tu mascota</span>
                      </span>
                    </h2>
                    {!doctors && <Loading />}
                    {doctors && doctors.length === 0 && (
                      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                        Sin doctores disponibles en esta sede por ahora — elige otra sede o escríbenos por WhatsApp.
                      </p>
                    )}
                    <div className="grid gap-3">
                      {doctors?.map((d, i) => (
                        <motion.button
                          key={d.id}
                          onClick={() => {
                            update("doctorId", d.id);
                            update("doctorName", d.name);
                            go("agenda");
                          }}
                          className="group flex items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-[#DCEBFF] transition-all hover:-translate-y-0.5 hover:bg-[#F7FBFF] hover:shadow-lg hover:shadow-blue-100/50 hover:ring-blue-300 active:translate-y-0 active:scale-[0.99]"
                          initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: reduceMotion ? 0.2 : 0.35, ease: "easeOut", delay: 0.2 + i * 0.08 }}
                        >
                          <DoctorAvatar name={d.name} />
                          <span className="min-w-0 flex-1">
                            <span className="block font-display text-lg font-bold text-[#475AAB]">{d.name}</span>
                            <span className="block text-xs text-[#546A8E]">{d.specialty ?? "Medicina Veterinaria General"}</span>
                          </span>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EFF5FC] text-[#546A8E] transition-all group-hover:bg-brand-blue group-hover:text-white group-hover:shadow-md">
                            <ChevronRight className="h-5 w-5" />
                          </span>
                        </motion.button>
                      ))}
                    </div>
                    {doctors && doctors.length > 0 && (
                      <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-[#546A8E]">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-[#EFF5FC] p-0.5 text-blue-600" />
                        ¿No sabes a quién elegir? Cualquiera de ellos te atenderá muy bien — al pasar se agendará directo.
                      </p>
                    )}
                  </div>

                  {/* Mascota del equipo médico (doctor.webp: en recepción).
                      Si el asset aún no existe, la columna se esconde (sin icono roto). */}
                  <DoctorMascot />
                </section>
              )}

              {/* ── Fecha + hora (calendario completo estilo grooming) ── */}
              {step === "agenda" && (
                <section className="grid gap-5 lg:grid-cols-[1fr_50%] lg:items-start lg:gap-8">
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Stethoscope className="h-4 w-4 text-brand-orange" />
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">
                        Dr(a). {form.doctorName ?? ""}
                      </p>
                    </div>
                    <h2 className="mb-5 font-display text-3xl font-bold leading-[1.12] tracking-tight text-[#475AAB] sm:text-4xl">
                      <span className="block">Elige la fecha</span>
                      <span className="block">
                        y la <span className="text-orange-500">hora que te acomoda</span>
                      </span>
                    </h2>
                    <CalendarCard
                      branch={form.branch ?? ""}
                      date={form.date ?? null}
                      maxDate={todayMinPlus()}
                      onSelect={(d) => {
                        update("date", d);
                        update("startMinute", null);
                        if (form.doctorId) void loadSlots(d, form.doctorId);
                      }}
                    />
                    {!form.date && (
                      <p className="mt-4 text-sm text-[#546A8E]">
                        Toca un día del calendario para ver las horas del médico.
                      </p>
                    )}
                  </div>

                  {/* Horas del doctor: aparecen al elegir fecha (antes: mascota con calendario) */}
                  <div>
                    {!form.date && (
                      <motion.img
                        src={MASCOT.esperando}
                        alt="Mascota revisando el calendario"
                        className="mx-auto h-auto w-48 object-contain sm:w-56 lg:w-64"
                        draggable={false}
                        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.9, y: reduceMotion ? 0 : 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: reduceMotion ? 0.2 : 0.4, ease: "easeOut", delay: 0.15 }}
                      />
                    )}
                    {form.date && slotsLoading && <Loading />}
                    {form.date && !slotsLoading && slots && slots.length === 0 && (
                      <p className="rounded-2xl bg-amber-50 p-4 text-center text-sm text-amber-800">
                        El doctor no tiene horas libres ese día — prueba otro día.
                      </p>
                    )}
                    {form.date && !slotsLoading && slots && slots.length > 0 && (
                      <motion.div layout>
                        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DCEBFF]">
                          <p className="font-display text-xl font-bold text-[#475AAB]">
                            {prettyDate(form.date)}
                          </p>
                          <p className="mt-0.5 text-xs text-[#8A97B1]">
                            Con {form.doctorName} · {branch?.label ?? ""}
                          </p>
                          <div className="my-4 h-px bg-[#DCEBFF]" />
                          <div className="flex flex-col gap-5">
                            {([
                              ["Mañana", slots.filter((s) => s.startMinute < 12 * 60)],
                              ["Tarde", slots.filter((s) => s.startMinute >= 12 * 60)],
                            ] as Array<[string, typeof slots]>).map(([turno, grupo], gi) =>
                              grupo.length > 0 ? (
                                <div key={turno}>
                                  <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-[#546A8E]">
                                    {gi === 0 ? <Sunrise className="h-4 w-4 text-orange-500" /> : <Sunset className="h-4 w-4 text-blue-500" />}
                                    {turno}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {grupo.map((s) => {
                                      const sel = form.startMinute === s.startMinute;
                                      return (
                                        <button
                                          key={s.startMinute}
                                          onClick={() => { update("startMinute", s.startMinute); go("datos"); }}
                                          className={`rounded-full px-5 py-3 text-[15px] font-bold transition-all ${
                                            sel
                                              ? "bg-brand-orange text-white shadow-lg shadow-orange-200"
                                              : "bg-[#F7FBFF] text-[#475AAB] ring-1 ring-[#DCEBFF] hover:-translate-y-0.5 hover:ring-brand-orange hover:text-brand-orange active:translate-y-0"
                                          }`}>
                                          {hora(s.startMinute)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null,
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </section>
              )}

              {/* ── Datos: campos a la izquierda, ticket de resumen a la derecha ── */}
              {step === "datos" && (
                <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-8">
                  <div>
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <span className="h-1 w-6 rounded-full bg-orange-500" aria-hidden />
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">Casi listo</p>
                    </div>
                    <h2 className="mb-5 font-display text-3xl font-bold leading-[1.12] tracking-tight text-[#475AAB] sm:text-4xl">
                      <span className="block">Últimos datos</span>
                      <span className="block">
                        y <span className="text-orange-500">confirmamos tu cita</span>
                      </span>
                    </h2>
                    {(form.serviceType === "rayos" || form.serviceType === "eco") && (
                      <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-[#FFF7EE] p-3 ring-1 ring-orange-200">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm font-black text-white">!</span>
                        <p className="text-xs text-[#7A4E00]">
                          Recuerda traer tu <b>orden médica sellada</b> el día de la cita
                        </p>
                      </div>
                    )}
                    {recordados && (
                      <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-[#EFF5FC] px-3.5 py-2.5 ring-1 ring-blue-200">
                        <span className="text-base leading-none">🧠</span>
                        <p className="flex-1 text-xs leading-relaxed text-[#3B5178]">
                          Rellenamos tu nombre y celular de tu <b>última visita</b> — solo viven en este navegador.
                        </p>
                        <button
                          onClick={olvidarDatos}
                          className="shrink-0 text-[11px] font-semibold text-red-600 underline decoration-dotted transition hover:text-red-500"
                        >
                          Olvidar
                        </button>
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Nombre de la mascota" value={form.petName} onChange={(v) => update("petName", v)} placeholder="Ej: Manolo" />
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-[#546A8E]">Tipo</span>
                        <div className="flex gap-2">
                          {["Perro", "Gato"].map((t) => (
                            <button
                              key={t}
                              onClick={() => update("petType", t)}
                              className={`flex items-center justify-between gap-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                                form.petType === t
                                  ? "bg-brand-orange text-white shadow-md shadow-orange-200"
                                  : "bg-[#F7FBFF] text-[#1A2238] ring-1 ring-[#DCEBFF] hover:ring-blue-300"
                              }`}
                            >
                              {t === "Perro" ? "🐶 Perro" : "🐱 Gato"}
                              {form.petType === t && <Check className="h-4 w-4 shrink-0" strokeWidth={3} />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Field label="Tu nombre completo" value={form.ownerName} onChange={(v) => update("ownerName", v)} placeholder="Ej: Juan Pérez" />
                      <Field label="Tu celular (WhatsApp)" value={form.ownerPhone} onChange={(v) => update("ownerPhone", v)} placeholder="999 111 222" type="tel" />
                      <Field label="Correo (opcional)" value={form.ownerEmail} onChange={(v) => update("ownerEmail", v)} placeholder="tucorreo@ejemplo.com" type="email" />
                    </div>
                    <label className="mt-3 flex flex-col gap-1">
                      <span className="text-xs font-medium text-[#546A8E]">¿Qué le pasa a tu mascota? (opcional)</span>
                      <textarea
                        value={form.petNotes}
                        onChange={(e) => update("petNotes", e.target.value)}
                        maxLength={400}
                        rows={2}
                        placeholder="Síntomas, observaciones…"
                        className="rounded-xl border border-[#DCEBFF] bg-[#F7FBFF] px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="self-end text-[10px] text-slate-400">{form.petNotes.length}/400</span>
                    </label>
                  </div>

                  {/* Ticket de resumen + CTA (primero en móvil, pegote en desktop) */}
                  <aside className="order-first lg:order-none lg:sticky lg:top-24">
                    <Resumen form={form} />
                    {form.serviceType === "especializada" && (
                      <motion.div
                        initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduceMotion ? 0.2 : 0.35, ease: "easeOut", delay: 0.1 }}
                        className="mt-3 flex items-center gap-3 overflow-hidden rounded-2xl border border-orange-100 bg-[#FFF7EE] p-3"
                      >
                        <img
                          src={MASCOT.pago}
                          alt="Mascota con cartera"
                          className="h-16 w-16 shrink-0 object-contain mix-blend-multiply"
                        />
                        <p className="text-xs leading-relaxed text-amber-800">
                          💳 Esta consulta se paga por adelantado: al confirmar recibirás por WhatsApp nuestros
                          métodos de pago y confirmaremos fecha, hora y doctor cuando verifiquemos tu comprobante.
                        </p>
                      </motion.div>
                    )}
                    <button
                      onClick={() => void submit()}
                      disabled={submitting || !canSubmit}
                      className={`mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold text-white transition-all ${
                        submitting || !canSubmit
                          ? "cursor-not-allowed bg-blue-300"
                          : "cursor-pointer bg-gradient-to-r from-blue-600 to-orange-400 shadow-md hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-200/50 active:scale-[0.98]"
                      }`}
                    >
                      {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />}
                      {submitting ? "Registrando…" : "Confirmar cita"}
                    </button>
                    {!canSubmit && !submitting && (
                      <p className="mt-2 text-center text-[11px] text-[#8A97B1]">
                        Completa el nombre de la mascota, tu nombre y tu celular para confirmar.
                      </p>
                    )}
                  </aside>
                </section>
              )}

              {/* ── Enviado: éxito con resumen de la cita + código copiable ── */}
              {step === "enviado" && (
                <section className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-4 text-center">
                  <motion.img
                    src={MASCOT.agendado}
                    alt="Mascota celebrando su cita agendada"
                    className="h-auto w-56 object-contain mix-blend-multiply sm:w-72"
                    draggable={false}
                    initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.8, y: reduceMotion ? 0 : 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0.2 : 0.45, ease: "easeOut" }}
                  />
                  <h2 className="font-display text-3xl font-bold tracking-tight text-green-700 sm:text-4xl">
                    ¡Cita registrada! 🎉
                  </h2>
                  <div className="rounded-2xl border-2 border-dashed border-green-300 bg-green-50 px-8 py-4">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-green-600">Código de cita</p>
                    <p className="mt-1 font-mono text-3xl font-bold tracking-wider text-green-800">{code}</p>
                    <button
                      onClick={() => {
                        void navigator.clipboard?.writeText(code);
                        setCopia(true);
                        setTimeout(() => setCopia(false), 2000);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-green-700 ring-1 ring-green-200 transition hover:bg-green-100"
                    >
                      {copia ? <Check className="h-3.5 w-3.5" /> : "⧉"}
                      {copia ? "¡Copiado!" : "Copiar código"}
                    </button>
                  </div>
                  <Resumen form={form} />
                  <p className="max-w-md text-sm text-[#546A8E]">
                    {form.serviceType === "especializada" ? (
                      <>Te llega por WhatsApp un mensaje con los <b>métodos de pago</b>: envía tu comprobante al
                      WhatsApp de la sede y te confirmamos fecha, hora y doctor.</>
                    ) : (
                      <>Ya recibiste el <b>recibo</b> por WhatsApp con los detalles de tu cita. Llega puntual:
                      tolerancia de 10 minutos, luego atendemos al siguiente 🐾.</>
                  )}
                  </p>
                  <button
                    onClick={() => { setForm(INITIAL); go("sede"); }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#DCEBFF] bg-white px-5 py-2.5 text-sm font-semibold text-[#546A8E] shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:text-[#475AAB] hover:shadow-md"
                  >
                    Agendar otra cita
                  </button>
                </section>
              )}
            </motion.div>
          </AnimatePresence>

          {step !== "sede" && step !== "enviado" && (
            <button
              onClick={back}
              className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#546A8E] shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:text-[#475AAB] hover:shadow-md"
            >
              <ChevronLeft className="h-4 w-4" />
              Volver atrás
            </button>
          )}
        </div>
      </div>

      {form.branch && step !== "enviado" && (
        <WhatsAppButton phone={MED_BRANCH_PHONES[form.branch]} />
      )}
    </div>
  );
}

// Sellos de confianza del paso de sede (adaptação médica del grooming).
const MED_TRUST_BADGES: Array<{ icon: LucideIcon; title: string; description: string; color: string }> = [
  {
    icon: ShieldCheck,
    title: "Atención profesional",
    description: "Veterinarios y asistentes capacitados",
    color: "text-blue-600",
  },
  {
    icon: Microscope,
    title: "Diagnóstico en sede",
    description: "Rayos X · Ecografía · Laboratorio",
    color: "text-orange-500",
  },
  {
    icon: Heart,
    title: "Amor y cuidado",
    description: "Tratamos a tu mascota como parte de la familia",
    color: "text-blue-600",
  },
];

function SedeStep({ selected, onPick, onContinue }: {
  selected: MedBranch | null;
  onPick: (b: MedBranch) => void;
  onContinue: () => void;
}) {
  return (
    <section>
      <StepHeading kicker="3 sedes para atenderte">
        Selecciona tu sede <span className="text-orange-500 underline decoration-orange-400 decoration-2 underline-offset-[3px]">más cercana</span>
      </StepHeading>
      <p className="-mt-2 mb-6 text-center text-sm text-[#546A8E]">
        Elige la veterinaria donde atenderemos a tu mascota
      </p>

      {/* Cards de sede (patrón grooming: foto + chip distrito + datos + botón) */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
        {BRANCHES.map((b) => {
          const isSelected = selected === (b.value as MedBranch);
          const district = b.label.replace("Sede ", "");
          const open = isBranchOpen(b);
          return (
            <button
              key={b.value}
              type="button"
              onClick={() => onPick(b.value as MedBranch)}
              aria-pressed={isSelected}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98] ${
                isSelected
                  ? "border-orange-400 shadow-lg shadow-orange-100"
                  : "border-gray-200 shadow-sm hover:border-orange-300"
              }`}
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <LazyImage
                  src={b.image}
                  alt={b.label}
                  className="transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div className={`absolute inset-0 transition-opacity duration-300 ${isSelected ? "bg-orange-400/10" : "bg-transparent"}`} />
                <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur-sm">
                  <MapPin className="h-3 w-3 text-blue-600" />
                  {district}
                </div>
                <div className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-colors ${
                  isSelected ? "bg-orange-500 text-white" : "bg-white/80 text-gray-300 backdrop-blur-sm"
                }`}>
                  {isSelected && <Check className="h-4 w-4" strokeWidth={3} />}
                </div>
              </div>

              <div className={`flex flex-col gap-2 px-4 py-3 transition-colors sm:px-5 sm:py-4 ${isSelected ? "bg-[#FFF7EE]" : "bg-white"}`}>
                <span className={`text-lg font-bold leading-tight transition-colors ${isSelected ? "text-[#475AAB]" : "text-gray-800"}`}>
                  {b.label}
                </span>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-sm text-[#546A8E]">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    <span className="truncate">{b.address}</span>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${open ? "text-green-600" : "text-gray-400"}`}>
                    <span className={`h-2 w-2 rounded-full ${open ? "bg-green-500" : "bg-gray-300"}`} />
                    {open ? "Abierto ahora" : "Cerrado"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-sm text-[#546A8E]">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  {b.hours}
                </div>

                <div className="flex items-center gap-1.5 text-sm text-[#546A8E]">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                  {b.phone}
                </div>

                <span className={`mt-2 flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                  isSelected
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-blue-200 text-blue-700 group-hover:border-orange-300 group-hover:bg-orange-50"
                }`}>
                  {isSelected ? (
                    <>
                      <Check className="h-4 w-4" strokeWidth={3} />
                      Sede seleccionada
                    </>
                  ) : (
                    <>
                      Seleccionar sede
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sellos de confianza + mascota (patrón grooming) */}
      <div className="relative mt-6">
        <div className="rounded-2xl bg-[#EFF6FF] p-3 sm:p-5 sm:pr-36 md:pr-44">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:divide-x sm:divide-[#DCEBFF]">
            {MED_TRUST_BADGES.map(({ icon: Icon, title, description, color }) => (
              <div key={title} className="flex items-center gap-3 rounded-xl px-3 py-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  <Icon className={`h-5 w-5 ${color}`} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#475AAB]">{title}</p>
                  <p className="text-xs text-[#546A8E]">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="-mr-10 mt-3 flex items-end justify-end sm:absolute sm:-bottom-8 sm:right-0 sm:mt-0">
          <div className="relative mb-14 max-w-25 -mr-14 rounded-2xl bg-white px-3 py-1 text-xs font-bold leading-snug text-gray-600 shadow-md">
            Elige tu sede más cercana
            <span className="absolute -right-1.5 bottom-5 h-3 w-3 rotate-45 bg-white" />
          </div>
          <img
            src="/images/vetMascot/map.webp"
            alt="Asistente veterinario"
            className="h-24 select-none sm:h-28 lg:h-32"
          />
        </div>
      </div>

      {/* Confirmación de sede (patrón grooming "Iniciar Reserva") */}
      <button
        onClick={onContinue}
        disabled={!selected}
        className={`mt-6 flex w-full items-center rounded-2xl p-4 text-left transition-all sm:mt-8 ${
          selected
            ? "cursor-pointer bg-gradient-to-r from-blue-600 to-orange-400 shadow-md hover:shadow-lg active:scale-[0.98]"
            : "cursor-not-allowed bg-gray-300"
        }`}
      >
        <span className={`mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${selected ? "bg-white/20" : "bg-white/30"}`}>
          <Stethoscope className={`h-5 w-5 ${selected ? "text-white" : "text-gray-400"}`} />
        </span>
        <div className="flex-1 text-left">
          <span className={`text-lg font-bold ${selected ? "text-white" : "text-[#546A8E]"}`}>
            Ver servicios disponibles
          </span>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
          selected ? "bg-white text-blue-600 shadow" : "bg-gray-400 text-white"
        }`}>
          <ArrowRight className="h-5 w-5" />
        </span>
      </button>
    </section>
  );
}

// Progreso con puntos numerados + etiquetas (maqueta "Confirma tu cita").
// Los 4 puntos = los 4 grupos reales del wizard; nada de lógica nueva.
function StepProgress({ groups, current }: { groups: typeof PROGRESS_GROUPS; current: number }) {
  return (
    <div className="mb-7 flex">
      {groups.map((g, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={g.label} className="relative flex flex-1 flex-col items-center">
            {i < groups.length - 1 && (
              <div
                aria-hidden
                className={`absolute left-1/2 top-[13px] h-0.5 w-full ${i < current ? "bg-green-500" : "bg-slate-200"}`}
              />
            )}
            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                done
                  ? "bg-green-500 text-white"
                  : active
                    ? "bg-brand-blue text-white ring-4 ring-blue-600/15"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={`mt-1.5 hidden text-[11px] font-semibold sm:block ${
                active ? "text-[#475AAB]" : done ? "text-green-600" : "text-slate-400"
              }`}
            >
              {active ? `${g.label} · Paso ${i + 1} de ${groups.length}` : g.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StepHeading({ kicker, children }: { kicker?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 text-center">
      {kicker && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">{kicker}</p>
      )}
      <h2 className="text-step-title font-display font-bold tracking-tight text-[#475AAB]">{children}</h2>
    </div>
  );
}

// Mascota del paso doctor con fundido blanco; si el webp falta, la
// columna desaparece (patrón de cascada de /estado, sin icono roto).
function DoctorMascot() {
  const reduceMotion = useReducedMotion() ?? false;
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="relative mx-auto hidden w-full justify-center sm:flex">
      <motion.img
        src={MASCOT.doctor}
        alt="Nuestro equipo médico te espera"
        className="h-64 w-auto select-none self-center object-contain mix-blend-multiply lg:h-80"
        draggable={false}
        onError={() => setHidden(true)}
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.88, y: reduceMotion ? 0 : 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0.2 : 0.45, ease: "easeOut", delay: 0.15 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white via-white/70 to-transparent sm:h-16"
      />
    </div>
  );
}

// Avatar del doctor: intenta la foto real en /images/doctores/{slug}.webp
// (ej. dra-karla.webp — el counter las suelta ahí y aparecen solas);
// si no existe aún, estetoscopio sobre degradado azul.
function doctorPhotoSrc(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `/images/doctores/${slug}.webp`;
}

function DoctorAvatar({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#EFF6FF] to-[#DCEBFF] ring-1 ring-[#DCEBFF]">
        <Stethoscope className="h-6 w-6 text-blue-600" />
      </span>
    );
  }
  return (
    <img
      src={doctorPhotoSrc(name)}
      alt={`Foto de ${name}`}
      loading="lazy"
      onError={() => setFailed(true)}
      draggable={false}
      className="h-12 w-12 shrink-0 select-none rounded-full object-cover ring-1 ring-[#DCEBFF]"
    />
  );
}

function Resumen({ form }: { form: FormData }) {
  const b = MED_BRANCHES.find((x) => x.value === form.branch);
  const serviceLabel = SERVICES.find((s) => s.id === form.serviceType)?.label ?? form.serviceType;
  return (
    <div className="rounded-[18px] border border-[#DCEBFF] bg-gradient-to-b from-white to-[#F7FBFF] p-4 shadow-sm sm:p-5">
      <ul className="grid gap-2">
        {b && <SummaryRow icon={MapPin}>{b.label}</SummaryRow>}
        <SummaryRow icon={form.serviceType === "especializada" ? Microscope : Stethoscope}>
          {serviceLabel}
          {form.specialtyName ? ` · ${form.specialtyName}` : ""}
          {form.specialtyCost !== null ? ` — S/ ${form.specialtyCost.toFixed(0)}` : ""}
        </SummaryRow>
        {form.doctorName && <SummaryRow icon={UserRound}>{form.doctorName}</SummaryRow>}
        {form.date && form.startMinute !== null && (
          <SummaryRow icon={CalendarDays}>{prettyDate(form.date)} · {hora(form.startMinute)}</SummaryRow>
        )}
      </ul>
    </div>
  );
}

function SummaryRow({ icon: Icon, children, accent = false }: { icon: LucideIcon; children: React.ReactNode; accent?: boolean }) {
  return (
    <li className={`flex items-center gap-2.5 rounded-[12px] border px-3 py-2 text-sm ${
      accent
        ? "border-orange-100 bg-[#FFF7EE] text-[#1A2238]"
        : "border-[#DCEBFF] bg-[#F7FBFF] text-[#546A8E]"
    }`}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
        accent ? "bg-orange-500 text-white" : "bg-[#EFF6FF] text-blue-600"
      }`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="leading-snug">{children}</span>
    </li>
  );
}

function Loading() {
  return (
    <div className="flex justify-center p-6 text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[#546A8E]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-[#DCEBFF] bg-[#F7FBFF] px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
      />
    </label>
  );
}
