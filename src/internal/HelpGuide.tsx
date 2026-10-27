import { useState } from "react";
import { CircleHelp, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FlaskConical, History, PawPrint, Settings, Stethoscope } from "lucide-react";

// Guía "?" del panel: instrucciones prácticas POR PESTAÑA para recepcionista
// nueva (el PLAN listaba "guía de uso para el staff" — hoy es producto).
// Solo lectura; el contenido cambia según la pestaña activa.

interface Section {
  id: string;
  label: string;
  icon: LucideIcon;
  steps: string[];
}

const SECTIONS: Section[] = [
  {
    id: "grooming",
    label: "Grooming",
    icon: PawPrint,
    steps: [
      "Arriba a la izquierda elige la fecha (o «Hoy»/«Mañana») y la sede.",
      "Cada reserva tiene su tarjeta: el botón de estado cambia la etapa (Recibido → Baño → Secado → Corte → Listo → Entrega) y el cliente se entera por WhatsApp en los estados clave.",
      "Botón azul 'Imprimir boleta': sale por la tiquetera (QZ Tray debe estar encendido en la PC del mostrador); si no, se abre el diálogo del navegador.",
      "Chipo roja '⚠️ WhatsApp': el aviso al cliente falló — usa 'Reenviar avisos' para reintentar.",
      "Aviso de llegada nueva: aparece abajo a la derecha cuando entra una reserva con el panel abierto.",
      "Días cerrados (feriados): botón 'Días cerrados (Ocupado)' al final de la lista.",
    ],
  },
  {
    id: "consultas",
    label: "Consultas",
    icon: Stethoscope,
    steps: [
      "Vista Hoy/Mañana/Semana + filtro de sede; citas agrupadas por doctor.",
      "Cada tarjeta se expande al hacer clic: ahí están los botones de estado (Entró, Atendida, Confirmar al cliente, Cancelar).",
      "Citas especializadas pendientes aparecen ARRIBA en el recuadro ámbar: primero '💰 Verifiqué el pago' y después '🩺 Asignar doctor/fecha' (el cliente no eligió día: nosotros se lo confirmamos).",
      "Botón verde junto al teléfono: abre WhatsApp del dueño con mensaje listo.",
      "'🔁 Reagendar como nueva cita' (en canceladas/no llegaron) abre el formulario con los datos ya puestos: solo elige fecha y hora.",
      "'＋ Cita manual' registra lo tomado por teléfono o mostrador.",
    ],
  },
  {
    id: "laboratorio",
    label: "Laboratorio",
    icon: FlaskConical,
    steps: [
      "Pestaña 'En curso' es la de trabajo diario; Hoy/Última semana para revisar entregadas.",
      "Flujo por tarjeta: '🔬 Enviar al laboratorio' → '✅ Resultado listo' (el cliente recibe WhatsApp) → '📋 Entregada / leído' cuando lo retira.",
      "Cuando el resultado llega: sube el PDF o foto en la propia tarjeta y publícalo — el cliente lo descarga en /estado con su código (dura 20 días).",
      "Anillo ámbar '⚠ >7 días': la orden lleva una semana en el laboratorio y no volvió — hay que reclamar.",
      "Cross-sede: '📍 Origen X → Responsable Y' indica qué sede registró y cuál atiende.",
    ],
  },
  {
    id: "historial",
    label: "Historial",
    icon: History,
    steps: [
      "Busca reservas, citas u órdenes de un RANGO (Hoy/Semana/Mes) con filtro de sede y texto.",
      "Cada registro se expande: código + quién cambió cada estado y cuándo.",
      "'Abrir en pestaña X →' salta directo a la cita/orden/reserva con el código buscado — útil para dudas por teléfono.",
    ],
  },
  {
    id: "config",
    label: "Config",
    icon: Settings,
    steps: [
      "Duración de cada cita (recalcula la agenda web; cambiar solo cuando nadie esté agendando).",
      "Métodos de pago: el texto que recibe el cliente en las especializadas.",
      "Doctores y especialidades: dar de alta/baja, precios y en qué sedes atienden.",
      "'📅 Horarios médicos de la web': la cuadrícula de media hora de cada doctor — los pinta el counter cuando un doctor muda su horario (no es diario).",
    ],
  },
];

export function HelpGuide({ tab }: { tab: string }) {
  const [open, setOpen] = useState(false);
  const [vista, setVista] = useState<string>(tab);
  // Si el counter cambia de pestaña con la guía abierta, la guía lo sigue.
  const active = SECTIONS.find((s) => s.id === (open ? vista : tab)) ?? SECTIONS[0]!;

  return (
    <>
      {open && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Guía rápida del panel">
          <button aria-label="Cerrar guía" className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">❓ Guía rápida</h2>
                <p className="text-xs text-slate-500">Qué hacer en cada pestaña, en lenguaje del mostrador.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setVista(s.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active.id === s.id ? "bg-brand-blue text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <section className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                <active.icon className={`h-4 w-4 ${active.id === "laboratorio" ? "text-brand-orange" : "text-brand-blue"}`} />
                {active.label}
              </h3>
              <ol className="flex flex-col gap-2 text-xs leading-relaxed text-slate-600">
                {active.steps.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-[9px] font-bold text-brand-blue">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </section>
            <p className="mt-3 text-center text-[11px] text-slate-400">
              ¿Algo confuso? Escríbeles al que hace la página — mejora con el día.
            </p>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(true)}
        title="Guía rápida: qué hacer en cada pestaña"
        aria-label="Abrir guía del panel"
        className="no-print fixed bottom-6 left-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-blue shadow-lg ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
      >
        <CircleHelp className="h-5 w-5" />
      </button>
    </>
  );
}
