import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Microscope, CalendarDays, CheckCircle2, ClipboardList,
  FileWarning, Loader2, PawPrint, Phone, ScanLine, Stethoscope,
} from "lucide-react";
import {
  createAppointment, fetchDoctors, fetchSlots, fetchSpecialties,
  MED_BRANCH_PHONES, MED_BRANCHES, type MedBranch, type MedDoctor, type MedSlot, type MedSpecialty,
} from "./api";

// Wizard de citas médicas: sede → servicio → especialidad/doctor → fecha/hora → datos → CM-XXXXX.
// Mismo estilo del wizard de grooming (tokens de marca en medical.css).

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

function limaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

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

export default function App() {
  const [step, setStep] = useState<Step>("sede");
  const [form, setForm] = useState<FormData>(INITIAL);
  const [doctors, setDoctors] = useState<MedDoctor[] | null>(null);
  const [specialties, setSpecialtyList] = useState<MedSpecialty[] | null>(null);
  const [slots, setSlots] = useState<MedSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
  }, []);

  const back = () => {
    setError(null);
    const prev: Record<Step, Step> = {
      sede: "sede", servicio: "sede", orden: "servicio", sin_orden: "servicio",
      especialidad: "servicio", doctor: "servicio", agenda: "doctor", datos: "agenda", enviado: "sede",
    };
    if (step === "agenda" && form.serviceType === "especializada") setStep("datos");
    else setStep(prev[step]);
  };

  // Paso servicio → carga: doctores (general/rayos/eco) o especialidades
  async function chooseService(t: ServiceType) {
    setError(null);
    update("serviceType", t);
    if (t === "general" || t === "rayos" || t === "eco") {
      if (t !== "general") {
        setStep("orden");
        return;
      }
      setStep("doctor");
    } else {
      setStep("especialidad");
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
      setCode(result.appointmentCode);
      setStep("enviado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la cita");
    } finally {
      setSubmitting(false);
    }
  }

  const branch = MED_BRANCHES.find((b) => b.value === form.branch) ?? null;
  const title = "Agenda la cita médica de tu mascota";
  const canSubmit =
    form.petName.trim().length >= 2 &&
    form.ownerName.trim().length >= 3 &&
    form.ownerPhone.trim().length >= 6;

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 py-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blue text-white shadow-md shadow-blue-600/20">
          <PawPrint className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">Veterinaria Ariel</h1>
          <p className="text-xs text-slate-500">Citas médicas · grooming · 3 sedes</p>
        </div>
      </header>

      {/* Stepper */}
      {step !== "enviado" && (
        <div className="mb-4 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
          {["sede", "servicio", "agenda", "datos"].map((s, i) => {
            const order = ["sede", "servicio", "orden", "sin_orden", "especialidad", "doctor", "agenda", "datos"];
            const active = order.indexOf(step) >= order.indexOf(s);
            return (
              <span key={s} className={`rounded-full px-2.5 py-1 ${active ? "bg-brand-blue/10 text-brand-blue" : ""}`}>
                {["1. Sede", "2. Servicio", (i >= 2 ? "3. Fecha" : "3. Fecha"), "4. Datos"][i]}
              </span>
            );
          })}
        </div>
      )}

      {branch && (
        <div className={`mb-4 ${step === "datos" ? "" : "hidden"}`}></div>
      )}

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700">{error}</p>
      )}

      {/* ── Paso: sede ── */}
      {step === "sede" && (
        <SedeStep title={title} onPick={(b) => { update("branch", b); setStep("servicio"); }} />
      )}

      {/* ── Paso: servicio ── */}
      {step === "servicio" && (
        <section>
          <StepTitle>Sede <b>{branch?.short}</b> — ¿Qué necesitas para tu mascota?</StepTitle>
          <div className="grid gap-3">
            {SERVICES.map((s) => (
              <button
                key={s.id}
                onClick={() => void chooseService(s.id)}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-brand-blue"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
                  <s.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="flex items-center gap-2 font-semibold text-slate-900">{s.label}</span>
                  <span className="text-xs text-slate-500">{s.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <BackButton onClick={back} />
        </section>
      )}

      {/* ── Orden médica: pregunta ── */}
      {step === "orden" && (
        <section>
          <StepTitle>¿Tu mascota tiene <b>orden médica sellada</b> por un médico?</StepTitle>
          <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
            📄 Para radiografías y ecografías necesitamos una orden médica con sello de un médico
            (de cualquier clínica). Sin orden, primero debe pasar por una consulta general.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { update("hasOrder", true); setStep("doctor"); }}
              className="rounded-2xl bg-green-50 p-4 font-semibold text-green-800 ring-1 ring-green-200 transition hover:-translate-y-0.5"
            >✅ Sí, tengo orden</button>
            <button
              onClick={() => setStep("sin_orden")}
              className="rounded-2xl bg-red-50 p-4 font-semibold text-red-800 ring-1 ring-red-200 transition hover:-translate-y-0.5"
            >❌ No tengo</button>
          </div>
          <BackButton onClick={back} />
        </section>
      )}

      {/* ── Sin orden: dos caminos ── */}
      {step === "sin_orden" && (
        <section>
          <StepTitle>Sin orden médica, primero toca <b>consulta general</b></StepTitle>
          <p className="mb-4 text-sm text-slate-600">
            El médico evalúa a tu mascota y, si es necesario, te emite la orden para la
            radiografía o ecografía el mismo día.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { update("serviceType", "general"); update("hasOrder", null); setStep("doctor"); }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-orange-400 py-3 font-semibold text-white shadow-md transition hover:-translate-y-0.5"
            >
              🩺 Agendar consulta general ahora
            </button>
            <a
              href={`https://wa.me/${MED_BRANCH_PHONES[form.branch!]}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl bg-green-50 py-3 font-semibold text-green-800 ring-1 ring-green-200 transition hover:-translate-y-0.5"
            >
              <Phone className="h-4 w-4" /> Hablar con la sede por WhatsApp
            </a>
          </div>
          <BackButton onClick={back} />
        </section>
      )}

      {/* ── Especialidad (especializada) ── */}
      {step === "especialidad" && (
        <section>
          <StepTitle>Elige la <b>especialidad</b> para {branch?.short}</StepTitle>
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
                  setStep("datos");
                }}
                className="flex items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-brand-blue"
              >
                <span className="font-semibold text-slate-900">🎓 {s.name}</span>
                <span className="rounded-full bg-brand-orange/10 px-3 py-1 text-sm font-bold text-brand-orange">
                  S/ {s.cost.toFixed(0)}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            La consulta se paga por adelantado; después confirmamos fecha, hora y doctor.
          </p>
          <BackButton onClick={back} />
        </section>
      )}

      {/* ── Doctor ── */}
      {step === "doctor" && (
        <section>
          <StepTitle>Elige el <b>doctor</b> en {branch?.short}</StepTitle>
          {!doctors && <Loading />}
          {doctors && doctors.length === 0 && (
            <p className="rounded-2xl bg-amber-50 p-4 text-center text-sm text-amber-800">
              Sin doctores disponibles en esta sede — elige otra sede o escríbenos por WhatsApp.
            </p>
          )}
          <div className="grid gap-3">
            {doctors?.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  update("doctorId", d.id);
                  update("doctorName", d.name);
                  setStep("agenda");
                }}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-brand-blue"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 font-bold text-brand-blue">🩺</span>
                <span>
                  <span className="font-semibold text-slate-900">{d.name}</span>
                  <span className="block text-xs text-slate-500">{d.specialty ?? "Medicina Veterinaria General"}</span>
                </span>
              </button>
            ))}
          </div>
          <BackButton onClick={back} />
        </section>
      )}

      {/* ── Fecha + hora ── */}
      {step === "agenda" && (
        <section>
          <StepTitle>Elige la <b>fecha y hora</b> de la cita</StepTitle>
          <label className="mb-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
            <CalendarDays className="h-5 w-5 text-slate-400" />
            <input
              type="date"
              min={limaToday()}
              max={todayMinPlus()}
              value={form.date ?? ""}
              onChange={(e) => {
                update("date", e.target.value);
                update("startMinute", null);
                if (e.target.value && form.doctorId) void loadSlots(e.target.value, form.doctorId);
              }}
              className="w-full text-sm outline-none"
            />
          </label>
          {!form.date && (
            <p className="rounded-xl bg-white/70 p-4 text-center text-sm text-slate-400">
              Primero escoge un día (disponible con {30} días de anticipación)
            </p>
          )}
          {form.date && slotsLoading && <Loading />}
          {form.date && !slotsLoading && slots && slots.length === 0 && (
            <p className="rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-800">
              El doctor no tiene horas libres ese día — prueba otro día.
            </p>
          )}
          {form.date && !slotsLoading && slots && slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <button
                  key={s.startMinute}
                  onClick={() => { update("startMinute", s.startMinute); setStep("datos"); }}
                  className={`rounded-xl py-2.5 text-sm font-semibold transition ${
                    form.startMinute === s.startMinute
                      ? "bg-brand-orange text-white shadow-md"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-brand-blue"
                  }`}
                >
                  {hora(s.startMinute)}
                </button>
              ))}
            </div>
          )}
          <BackButton onClick={back} />
        </section>
      )}

      {/* ── Datos ── */}
      {step === "datos" && (
        <section>
          <StepTitle>Últimos <b>datos</b> y confirmamos</StepTitle>
          <Resumen form={form} />
          <div className="mt-4 grid gap-3">
            <Field label="Nombre de la mascota" value={form.petName} onChange={(v) => update("petName", v)} placeholder="Ej: Manolo" />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">Tipo</span>
                <div className="flex gap-2">
                  {["Perro", "Gato"].map((t) => (
                    <button
                      key={t}
                      onClick={() => update("petType", t)}
                      className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${form.petType === t ? "bg-brand-blue text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
                    >{t === "Perro" ? "🐶 Perro" : "🐱 Gato"}</button>
                  ))}
                </div>
              </div>
            </div>
            <Field label="Tu nombre completo" value={form.ownerName} onChange={(v) => update("ownerName", v)} placeholder="Ej: Juan Pérez" />
            <Field label="Tu celular (WhatsApp)" value={form.ownerPhone} onChange={(v) => update("ownerPhone", v)} placeholder="999 111 222" />
            <Field label="Correo (opcional)" value={form.ownerEmail} onChange={(v) => update("ownerEmail", v)} placeholder="tucorreo@ejemplo.com" />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">¿Qué le pasa a tu mascota? (opcional)</span>
              <textarea
                value={form.petNotes}
                onChange={(e) => update("petNotes", e.target.value)}
                maxLength={400}
                rows={2}
                placeholder="Síntomas, observaciones…"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
              />
            </label>
          </div>
          {form.serviceType === "especializada" && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
              💳 Esta consulta se paga por adelantado: al confirmar recibirás por WhatsApp nuestros
              métodos de pago y vamos a confirmar fecha, hora y doctor cuando verifiquemos tu comprobante.
            </p>
          )}
          <button
            onClick={() => void submit()}
            disabled={submitting || !canSubmit}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-lg font-bold text-white transition ${
              submitting || !canSubmit ? "cursor-not-allowed bg-blue-300" : "bg-gradient-to-r from-blue-600 to-orange-400 hover:-translate-y-0.5 hover:shadow-lg"
            }`}
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />}
            {submitting ? "Registrando…" : "Confirmar cita"}
          </button>
          <BackButton onClick={back} />
        </section>
      )}

      {/* ── Enviado ── */}
      {step === "enviado" && (
        <section className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="text-6xl">🎉</div>
          <h2 className="font-display text-2xl font-bold text-green-700">¡Cita registrada!</h2>
          <div className="rounded-2xl border-2 border-dashed border-green-200 bg-green-50 px-8 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-green-600">Código de cita</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-green-800">{code}</p>
          </div>
          <p className="text-sm text-slate-600">
            {form.serviceType === "especializada" ? (
              <>Te llega por WhatsApp un mensaje con los <b>métodos de pago</b>: envía tu comprobante al
              WhatsApp de la sede y te confirmamos fecha, hora y doctor.</>
            ) : (
              <>Ya recibiste el <b>recibo</b> por WhatsApp con los detalles de tu cita (y llega puntual:
              tolerancia “10 minutos” luego atendemos al siguiente 🐾).</>
            )}
          </p>
          <button
            onClick={() => { setForm(INITIAL); setStep("sede"); }}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:ring-brand-blue"
          >
            Agendar otra cita
          </button>
        </section>
      )}
    </div>
  );
}

function SedeStep({ title, onPick }: { title: string; onPick: (b: MedBranch) => void }) {
  return (
    <section>
      <StepTitle>{title}</StepTitle>
      <div className="grid gap-3">
        {MED_BRANCHES.map((b) => (
          <button
            key={b.value}
            onClick={() => onPick(b.value)}
            className="overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-brand-blue"
          >
            <img src={b.image} alt={b.label} className="h-32 w-full object-cover" />
            <span className="block px-4 py-3 font-semibold text-slate-900">{b.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Resumen({ form }: { form: FormData }) {
  const b = MED_BRANCHES.find((x) => x.value === form.branch);
  return (
    <div className="rounded-2xl bg-white p-4 text-sm text-slate-700 ring-1 ring-slate-200">
      <p>🏥 <b>{b?.label}</b></p>
      <p>📋 {SERVICES.find((s) => s.id === form.serviceType)?.label ?? form.serviceType}
        {form.specialtyName ? ` · ${form.specialtyName}` : ""}
        {form.specialtyCost !== null ? ` (S/ ${form.specialtyCost.toFixed(0)})` : ""}
      </p>
      {form.doctorName && <p>🩺 {form.doctorName}</p>}
      {form.date && form.startMinute !== null && (
        <p>🗓 {prettyDate(form.date)} · {hora(form.startMinute)}</p>
      )}
      {form.serviceType === "rayos" || form.serviceType === "eco" ? (
        form.hasOrder && <p className="text-amber-700 text-xs mt-1 flex items-center gap-1"><FileWarning className="h-3.5 w-3.5" /> Preséntate con tu orden médica sellada</p>
      ) : null}
    </div>
  );
}

function StepTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-5 text-center text-step-title font-display font-bold text-[#475AAB]">{children}</h2>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-5 flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand-blue">
      <ArrowLeft className="h-4 w-4" /> Atrás
    </button>
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
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
      />
    </label>
  );
}
