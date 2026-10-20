import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Printer } from "lucide-react";
import { updateStatus, type PanelBooking } from "./api";
import { printViaQz } from "./qz";
import { NOTIFIABLE_STATUSES, SLOT_LABELS, STATUS_ORDER, statusMeta } from "../statuses";

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function BookingCard({
  booking,
  onChanged,
  printing,
  onPrint,
  onPrinted,
}: {
  booking: PanelBooking;
  onChanged: () => void;
  printing: boolean;
  onPrint: (id: string) => void;
  onPrinted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = statusMeta(booking.status);

  /** Siguientes estados razonables: los que siguen en el flujo (+ cancelar). */
  const nextStatuses = useMemo(() => {
    const idx = STATUS_ORDER.indexOf(booking.status as (typeof STATUS_ORDER)[number]);
    const rest = idx >= 0 ? STATUS_ORDER.slice(idx + 1) : [];
    return [...rest.slice(0, 3).map(String), "cancelado"];
  }, [booking.status]);

  async function setStatus(status: string) {
    if (status === "cancelado" && !window.confirm(`¿Cancelar la reserva ${booking.bookingCode}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await updateStatus(booking.id, status);
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setBusy(false);
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
    <article className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      {/* Impresión: solo visible con @media print cuando es el ticket activo */}
      {printing && <PrintableTicket booking={booking} />}

      <div
        className={`flex cursor-pointer items-center justify-between gap-3 p-4 ${open ? "rounded-t-2xl" : "rounded-2xl"}`}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-brand-blue">{booking.bookingCode}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>
              {meta.emoji} {meta.short}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-slate-600">
            {booking.ownerName} · {booking.pets.map((p) => p.name).join(", ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-slate-400">
          <span className="text-xs">{SLOT_LABELS[booking.timeSlot]?.split(" – ")[0]}</span>
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 p-4 pt-3">
          {/* Cliente */}
          <div className="mb-3 grid gap-1 text-sm text-slate-600">
            <p>
              👤 {booking.ownerName} · 📞 <a className="text-brand-blue underline decoration-dotted" href={`tel:${booking.ownerPhone}`}>{booking.ownerPhone}</a>
            </p>
            <p className="flex items-center gap-1">
              📍 {booking.ownerAddress}
              {booking.mapsUrl && (
                <a href={booking.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex text-brand-blue" title="Abrir en Maps">
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
              return (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => setStatus(s)}
                  title={
                    NOTIFIABLE_STATUSES.has(s)
                      ? `${m.label} (además avisa al cliente por WhatsApp)`
                      : m.label
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    s === "cancelado"
                      ? "bg-red-50 text-red-700 hover:bg-red-100"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {m.emoji} {m.short}
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
