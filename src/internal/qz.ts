// Impresión silenciosa de boletas vía QZ Tray (térmica Epson TM-T20II, ESC/POS).
// Requiere QZ Tray instalado y corriendo en la PC del staff. Si no está,
// el panel regresa automáticamente al diálogo de impresión del navegador.

export interface QzPetLike {
  name: string;
  type: string;
  service: string;
  size: string;
  bathType: string;
  corteType: string;
  corteSpecs: string;
  extras: string[];
  perfume: string;
  notes: string;
}

export interface QzBookingLike {
  bookingCode: string;
  branchLabel: string;
  serviceDate: string;
  timeSlot: string;
  ownerName: string;
  ownerPhone: string;
  ownerAddress: string;
  pets: QzPetLike[];
}

/** Datos mínimos de una cita médica para su ticket de cartelera (recordatorio
 *  interno del counter). branchLabel y serviceLabel los calcula el llamador. */
export interface MedApptLike {
  appointmentCode: string;
  branchLabel: string;
  serviceLabel: string;
  specialtyName: string | null;
  doctorName: string | null;
  apptDate: string | null;
  startMinute: number | null;
  petName: string;
  petType: string;
  petNotes: string;
  ownerName: string;
  ownerPhone: string;
}

interface QzPrintersApi {
  websocket: {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
  };
  printers: {
    find(query?: string): Promise<string | string[]>;
    detail(query: string): Promise<unknown>;
  };
  configs: {
    create(options: Record<string, unknown>): unknown;
  };
  print(config: unknown, data: Array<Record<string, unknown>>): Promise<void>;
  setErrorHandler(fn: (err: unknown) => void): void;
}

declare global {
  interface Window {
    qz?: QzPrintersApi;
  }
}

/** Ancho útil de la TM-T20II con papel de 80mm (columnas de la fuente normal). */
const COLUMNS = 48;

/** Sin acentos ni emojis: la tabla de caracteres por defecto de la térmica. */
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function wrapCol(text: string, width = COLUMNS, indent = ""): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = indent;
  for (const word of words) {
    if ((current + word).length > width) {
      lines.push(current.trimEnd());
      current = indent;
    }
    current += word + " ";
  }
  if (current.trim()) lines.push(current.trimEnd());
  return lines.length > 0 ? lines : [indent];
}

function line(char = "-"): string {
  return char.repeat(COLUMNS);
}

/** Fecha en formato legible corto para la boleta. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function slotShort(slot: string): string {
  return slot === "9-11" ? "9:00-11:00 am" : "11:00 am-2:00 pm";
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(min % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Construye la boleta como comandos ESC/POS crudos. */
export function buildEscPosTicket(booking: QzBookingLike): string {
  const out: string[] = [];
  const center = (t: string) => out.push("\x1B@\x1Ba\x01" + t + "\x1Ba\x00\n");
  const left = (t: string) => out.push(t + "\n");

  // Encabezado
  center(plain("VETERINARIA ARIEL"));
  center(plain(booking.branchLabel));
  center(line("="));

  // Código de reserva: destacado
  center(plain(booking.bookingCode));
  center(line("="));

  // Datos del recojo
  left(plain(`Fecha: ${shortDate(booking.serviceDate)}`));
  left(plain(`Recojo: ${slotShort(booking.timeSlot)}`));
  left("");

  // Cliente
  left(plain("CLIENTE"));
  for (const l of wrapCol(plain(`Nombre: ${booking.ownerName}`))) left(l);
  left(plain(`Tel: ${booking.ownerPhone}`));
  for (const l of wrapCol(plain(`Dir: ${booking.ownerAddress}`))) left(l);
  left(line());

  // Mascotas
  left(plain("MASCOTAS"));
  booking.pets.forEach((pet, i) => {
    left(plain(`${i + 1}. ${pet.name.toUpperCase()} (${pet.type})`));
    for (const l of wrapCol(plain(`  ${pet.service} - ${pet.size} - ${pet.bathType}`))) left(l);
    if (pet.corteType && pet.corteType !== "-") {
      for (const l of wrapCol(plain(`  Corte: ${pet.corteType}`))) left(l);
    }
    if (pet.corteSpecs && pet.corteSpecs !== "-") {
      for (const l of wrapCol(plain(`  Indicac: ${pet.corteSpecs}`), COLUMNS, "  ")) left(l);
    }
    if (pet.perfume && pet.perfume !== "-") {
      for (const l of wrapCol(plain(`  Perfume: ${pet.perfume}`))) left(l);
    }
    if (pet.notes && pet.notes !== "-") {
      for (const l of wrapCol(plain(`  Obs: ${pet.notes}`), COLUMNS, "  ")) left(l);
    }
    if (pet.extras.length > 0) {
      for (const l of wrapCol(plain(`  Extras: ${pet.extras.join(", ")}`), COLUMNS, "  ")) left(l);
    }
  });
  left(line());

  center(plain("Gracias por su confianza"));
  out.push("\n\n\n"); // salto previo al corte
  out.push("\x1D\x56\x42\x00"); // GS V 66 0 → corte parcial con avance
  return out.join("");
}

/** Ticket de cartelera interna (recordatorio del counter) para citas médicas:
 *  consultas e interconsultas confirmadas. Se pega en la cartelera de pendientes,
 *  NO se entrega al cliente (sin costos ni mensajes de cara al público). */
export function buildMedicalTicket(appt: MedApptLike): string {
  const out: string[] = [];
  const center = (t: string) => out.push("\x1B@\x1Ba\x01" + t + "\x1Ba\x00\n");
  const left = (t: string) => out.push(t + "\n");
  // Doble altura + doble ancho (ESC ! 48): para leerlo de la cartelera a distancia.
  // Si a doble ancho no cabe en el papel, cae a tamaño normal.
  const big = (t: string) => {
    if (t.length * 2 <= COLUMNS) center("\x1B!\x30" + t + "\x1B!\x00");
    else center(t);
  };

  // Encabezado
  center(plain("VETERINARIA ARIEL"));
  center(plain(appt.branchLabel));
  center(line("="));

  // Código de la cita: destacado (llave para buscar en Historial / reagendar)
  big(plain(appt.appointmentCode));
  center(line("="));

  // Mascota + consulta
  big(plain(`${appt.petName.toUpperCase()} (${appt.petType.toUpperCase()})`));
  for (const l of wrapCol(plain(`Consulta: ${appt.serviceLabel}${appt.specialtyName ? ` - ${appt.specialtyName}` : ""}`))) left(l);
  left(plain(`Fecha: ${appt.apptDate ? shortDate(appt.apptDate) : "por confirmar"}`));
  left(plain(`Hora: ${appt.startMinute !== null ? minToTime(appt.startMinute) : "por confirmar"}`));
  if (appt.doctorName) left(plain(`Doctor(a): ${appt.doctorName}`));
  left(line());

  // Cliente + indicaciones (recordatorio operativo en papel)
  left(plain("CLIENTE"));
  for (const l of wrapCol(plain(`Nombre: ${appt.ownerName}`))) left(l);
  left(plain(`Tel: ${appt.ownerPhone}`));
  const notes = appt.petNotes.trim();
  if (notes && notes !== "-") {
    for (const l of wrapCol(plain(`Indicac: ${notes}`), COLUMNS, "  ")) left(l);
  }
  left(line());

  center(plain("Recordatorio interno"));
  out.push("\n\n\n"); // salto previo al corte
  out.push("\x1D\x56\x42\x00"); // GS V 66 0 → corte parcial con avance
  return out.join("");
}

async function connectQz(): Promise<QzPrintersApi | null> {
  const qz = window.qz;
  if (!qz) return null;
  if (!qz.websocket.isConnected()) {
    await qz.websocket.connect();
  }
  return qz;
}

/** Envía datos ESC/POS crudos a la térmica. Devuelve false para que el
 *  llamador use el fallback del navegador. */
async function sendToQz(text: string): Promise<boolean> {
  try {
    const qz = await connectQz();
    if (!qz) return false;
    const match = (await qz.printers.find("TM-T20")) as string | string[];
    const printer = Array.isArray(match) ? match[0] : match;
    if (!printer) return false;
    // ASCII puro → los bytes son idénticos al string; QZ imprime raw con Uint8Array
    const bytes = new TextEncoder().encode(text);
    await qz.print(qz.configs.create({ printerName: printer }), [
      { type: "raw", format: "command", data: bytes },
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Intenta imprimir la boleta silenciosamente en la térmica local.
 * Devuelve false para que el llamador use el fallback del navegador.
 */
export async function printViaQz(booking: QzBookingLike): Promise<boolean> {
  return sendToQz(buildEscPosTicket(booking));
}

/** Igual que printViaQz pero para el ticket de cartelera de citas médicas. */
export async function printViaQzAppt(appt: MedApptLike): Promise<boolean> {
  return sendToQz(buildMedicalTicket(appt));
}
