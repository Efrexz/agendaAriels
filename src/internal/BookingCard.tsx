import { useMemo, useState } from "react";
import {
  Bath,
  Building2,
  Cat,
  CheckCircle2,
  ChevronDown,
  Clock,
  Dog,
  ExternalLink,
  MapPin,
  PackageCheck,
  Phone,
  Printer,
  Scissors,
  Truck,
  User,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { updateStatus, resendWhatsapp, type PanelBooking } from "./api";
import { printViaQz } from "./qz";
import { ConfirmModal } from "./ConfirmModal";
import { NOTIFIABLE_STATUSES, SLOT_LABELS, STATUS_ORDER, statusMeta } from "../statuses";

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// Color del borde izquierdo por estado (semáforo visual de la maqueta):
// de un vistazo se ve en qué etapa está cada mascota del tablero.
const BORDER_COLOR: Record<string, string> = {
  pendiente: "border-l-amber-400",
  en_camino_recojo: "border-l-sky-500",
  recibido: "border-l-blue-500",
  en_bano: "border-l-cyan-500",
  en_secado: "border-l-indigo-500",
  en_corte: "border-l-violet-500",
  listo: "border-l-green-500",
  en_camino_entrega: "border-l-sky-500",
  entregado: "border-l-slate-400",
  cancelado: "border-l-red-500",
};

const STATE_COLOR: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800 hover:bg-amber-200",
  en_camino_recojo: "bg-sky-100 text-sky-800 hover:bg-sky-200",
  recibido: "bg-blue-100 text-blue-800 hover:bg-blue-200",
  en_bano: "bg-cyan-100 text-cyan-800 hover:bg-cyan-200",
  en_secado: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
  en_corte: "bg-violet-100 text-violet-800 hover:bg-violet-200",
  listo: "bg-green-100 text-green-800 hover:bg-green-200",
  en_camino_entrega: "bg-sky-100 text-sky-800 hover:bg-sky-200",
  entregado: "bg-slate-200 text-slate-800 hover:bg-slate-300",
};

const STATE_ICON: Record<string, LucideIcon> = {
  pendiente: Clock,
  en_camino_recojo: Truck,
  recibido: Building2,
  en_bano: Bath,
  en_secado: Wind,
  en_corte: Scissors,
  listo: CheckCircle2,
  en_camino_entrega: Truck,
  entregado: PackageCheck,
};

export function BookingCard({
  booking,
  onChanged,
  printing,
  onPrint,
  onPrinted,
  showDate = false,
}: {
  booking: PanelBooking;
  onChanged: () => void;
  printing: boolean;
  onPrint: (id: string) => void;
  onPrinted: () => void;
  showDate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  // Confirmación de cancelación con modal propio (adiós window.confirm)
  const [confirmCancel, setConfirmCancel] = useState(false);
  const meta = statusMeta(booking.status);
  const firstType = (booking.pets[0]?.type ?? "").toLowerCase();
  const SpeciesIcon = firstType.includes("gato") ? Cat : firstType.includes("perro") ? Dog : User;
  const avatarTint = firstType.includes("gato")
    ? "bg-orange-100 text-orange-600"
    : firstType.includes("perro")
      ? "bg-sky-100 text-sky-600"
      : "bg-slate-100 text-slate-400";
  const border = BORDER_COLOR[booking.status] ?? "border-l-slate-300";

  /** Siguientes estados razonables: los que siguen en el flujo (+ cancelar). */
  const nextStatuses = useMemo(() => {
    const idx = STATUS_ORDER.indexOf(booking.status as (typeof STATUS_ORDER)[number]);
    const rest = idx >= 0 ? STATUS_ORDER.slice(idx + 1) : [];
    return [...rest.slice(0, 3).map(String), "cancelado"];
  }, [booking.status]);

  async function setStatus(status: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await updateStatus(booking.id, status);
      if (NOTIFIABLE_STATUSES.has(status) && !result.notified && !result.stale) {
        setError("⚠️ Reserva actualizada, pero el aviso por WhatsApp no se pudo enviar.");
      } else {
        setOpen(false);
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setResendBusy(true);
    setResendMsg(null);
    try {
      const r = await resendWhatsapp(booking.id);
      setResendMsg(r.resent ? "Aviso reenviado ✓" : (r.reason ?? "No se reenvió"));
      if (r.resent) onChanged();
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : "No se pudo reenviar");
    } finally {
      setResendBusy(false);
    }
  }

  function handlePrint() {
    onPrint(booking.id);
    // Path 1: QZ Tray (impresión silenciosa en la térmica del mostrador).
    // Path 2 (fallback): diálogo de impresión del navegador con la boleta 80mm.
    void printViaQz(booking).then((ok) => {
      if (ok) {
        onPrinted();
        return;
      }
      // Deja pintar el ticket (área de impresión) antes de abrir el diálogo.
      setTimeout(() => {
        window.print();
        onPrinted();
      }, 50);
    });
  }

  return (
    <article className={`rounded-2xl border-l-4 bg-white shadow-sm ring-1 ring-slate-200 ${border}`}>
      {/* Impresión: solo visible con @media print cuando es el ticket activo */}
      {printing && <PrintableTicket booking={booking} />}

      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); }
        }}
        className={`no-print flex cursor-pointer items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-inset ${open ? "rounded-t-2xl" : "rounded-2xl"}`}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Avatar de la mascota (icono por especie) */}
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${avatarTint}`}>
          <SpeciesIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-800">
              {booking.ownerName} · {booking.pets.map((p) => p.name).join(", ")}
            </p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>{meta.short}</span>
            {booking.whatsappDelivered === false && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                ⚠️ WhatsApp
              </span>
            )}
          </div>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-slate-400">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{booking.ownerAddress}</span>
            {booking.mapsUrl && (
              <a href={booking.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 text-brand-blue" title="Abrir en Maps">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-slate-500">
          <span className="font-mono text-[11px] font-bold text-slate-400">{booking.bookingCode}</span>
          {showDate && <span className="text-xs">📅 {booking.serviceDate}</span>}
          <span className="text-xs">{SLOT_LABELS[booking.timeSlot]?.split(" – ")[0]}</span>
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 p-4 pt-3">
          {/* Banner WhatsApp fallido (estilo maqueta) */}
          {booking.whatsappDelivered === false && (
            <div className="no-print mb-3 rounded-xl border-l-4 border-red-500 bg-red-50 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-base leading-none">❗</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-700">
                    El WhatsApp inicial de esta reserva no llegó a la veterinaria ni al cliente.
                  </p>
                </div>
              </div>
              {resendMsg && <p className="mt-1.5 text-xs text-red-600">{resendMsg}</p>}
              <button
                onClick={handleResend}
                disabled={resendBusy}
                className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {resendBusy ? "Reenviando…" : "↩ Reenviar avisos"}
              </button>
            </div>
          )}

          {/* Cliente */}
          <div className="mb-3 grid gap-1.5 text-sm text-slate-600">
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 shrink-0 text-slate-400" />
              {booking.ownerName}·
              <a className="flex items-center gap-1 text-brand-blue underline decoration-dotted" href={`tel:${booking.ownerPhone}`}>
                <Phone className="h-3.5 w-3.5" />
                {booking.ownerPhone}
              </a>
            </p>
            <p className="flex min-w-0 items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">{booking.ownerAddress}</span>
              {booking.mapsUrl && (
                <a href={booking.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 text-brand-blue" title="Abrir en Maps">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </p>
          </div>

          {/* Mascotas */}
          <div className="mb-3 flex flex-col gap-2">
            {booking.pets.map((pet, i) => (
              <div key={i} className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{pet.name} <span className="font-normal text-slate-400">({pet.type})</span></p>
                    <p className="text-slate-600">
                      {pet.service} · {pet.size} · {pet.bathType}
                      {pet.corteType && pet.corteType !== "-" && ` · Corte: ${pet.corteType}`}
                    </p>
                    {pet.corteSpecs && pet.corteSpecs !== "-" && (
                      <p className="text-slate-500">✏️ {pet.corteSpecs}</p>
                    )}
                    {pet.perfume && pet.perfume !== "-" && (
                      <p className="text-slate-500">🌸 {pet.perfume}</p>
                    )}
                    {pet.notes && pet.notes !== "-" && (
                      <p className="text-slate-500">📝 {pet.notes}</p>
                    )}
                    {pet.extras.length > 0 && (
                      <p className="text-slate-500">➕ {pet.extras.join(" · ")}</p>
                    )}
                  </div>
                  {pet.corteImage && (
                    <a href={pet.corteImage} target="_blank" rel="noreferrer" className="shrink-0" title="Ver foto de referencia">
                      <img src={pet.corteImage} alt={`Referencia de corte de ${pet.name}`} className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Acciones de estado */}
          <div className="no-print mb-3 flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir boleta
            </button>
            {nextStatuses.map((s) => {
              const m = statusMeta(s);
              const StateIcon = STATE_ICON[s];
              return (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => (s === "cancelado" ? setConfirmCancel(true) : setStatus(s))}
                  title={
                    NOTIFIABLE_STATUSES.has(s)
                      ? `${m.label} (además avisa al cliente por WhatsApp)`
                      : m.label
                  }
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    s === "cancelado"
                      ? "bg-red-50 text-red-700 hover:bg-red-100"
                      : (STATE_COLOR[s] ?? "bg-slate-100 text-slate-700 hover:bg-slate-200")
                  }`}
                >
                  {StateIcon && <StateIcon className="h-3.5 w-3.5" />}
                  {m.short}
                </button>
              );
            })}
          </div>

          {error && <p className="no-print mb-2 text-xs text-red-600">{error}</p>}

          {/* Historial de estados de esta reserva */}
          {booking.timeline && booking.timeline.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                Historial ({booking.timeline.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
                {booking.timeline.map((t, i) => (
                  <li key={i}>
                    <span className="font-medium text-slate-700">{formatTime(t.createdAt)}</span> — {statusMeta(t.status).label} ({t.createdBy})
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {confirmCancel && (
        <ConfirmModal
          title="¿Cancelar esta reserva?"
          description={`La reserva ${booking.bookingCode} quedará cancelada y el cliente recibirá el aviso por WhatsApp si el servidor está disponible.`}
          confirmLabel={busy ? "Cancelando…" : "Sí, cancelar"}
          danger
          busy={busy}
          onClose={() => setConfirmCancel(false)}
          onConfirm={async () => {
            await setStatus("cancelado");
            setConfirmCancel(false);
          }}
        />
      )}
    </article>
  );
}

/** Boleta 80mm: visible solo al imprimir vía .print-area en panel.css. */
function PrintableTicket({ booking }: { booking: PanelBooking }) {
  return (
    <div className="print-area">
      <p style={{ textAlign: "center", fontWeight: 700 }}>VETERINARIA ARIEL</p>
      <p style={{ textAlign: "center" }}>{booking.branchLabel}</p>
      <hr />
      <p style={{ fontWeight: 700 }}>RESERVA: {booking.bookingCode}</p>
      <p>Fecha: {booking.serviceDate}</p>
      <p>Recojo: {SLOT_LABELS[booking.timeSlot]}</p>
      <hr />
      <p>Cliente: {booking.ownerName}</p>
      <p>Tel: {booking.ownerPhone}</p>
      <p>Dir: {booking.ownerAddress}</p>
      <hr />
      {booking.pets.map((pet, i) => (
        <div key={i}>
          <p style={{ fontWeight: 700 }}>MASCOTA {i + 1}: {pet.name}</p>
          <p>{pet.type} · {pet.size}</p>
          <p>{pet.service} · {pet.bathType}</p>
          {pet.corteType && pet.corteType !== "-" && <p>Corte: {pet.corteType}</p>}
          {pet.corteSpecs && pet.corteSpecs !== "-" && <p>Indicac.: {pet.corteSpecs}</p>}
          {pet.notes && pet.notes !== "-" && <p>Obs.: {pet.notes}</p>}
          {pet.extras.length > 0 && <p>Extras: {pet.extras.join(", ")}</p>}
        </div>
      ))}
      <hr />
      <p style={{ textAlign: "center" }}>¡Gracias por su confianza!</p>
    </div>
  );
}
