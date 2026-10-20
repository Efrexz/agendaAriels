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

async function connectQz(): Promise<QzPrintersApi | null> {
  const qz = window.qz;
  if (!qz) return null;
  if (!qz.websocket.isConnected()) {
    await qz.websocket.connect();
  }
  return qz;
}

/**
 * Intenta imprimir la boleta silenciosamente en la térmica local.
 * Devuelve false para que el llamador use el fallback del navegador.
 */
export async function printViaQz(booking: QzBookingLike): Promise<boolean> {
  try {
    const qz = await connectQz();
    if (!qz) return false;
    const match = (await qz.printers.find("TM-T20")) as string | string[];
    const printer = Array.isArray(match) ? match[0] : match;
    if (!printer) return false;
    const text = buildEscPosTicket(booking);
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
