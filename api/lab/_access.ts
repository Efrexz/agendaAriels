import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizePhoneDest, sendViaEvolution, type BookingEnv } from "../_booking.js";

export const RESULT_WINDOW_MS = 20 * 24 * 60 * 60 * 1000;
const PUBLIC_ORIGIN = "https://agenda-ariels-nu.vercel.app";

export function newResultToken(): string {
  return randomBytes(32).toString("base64url");
}

export function resultTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string, storedHash: string | null): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !storedHash || !/^[a-f0-9]{64}$/.test(storedHash)) return false;
  return timingSafeEqual(Buffer.from(resultTokenHash(token), "hex"), Buffer.from(storedHash, "hex"));
}

export function resultAvailable(order: { resultPath: string | null; resultPublishedAt: string | null }, now = Date.now()): boolean {
  const published = order.resultPublishedAt ? Date.parse(order.resultPublishedAt) : NaN;
  return !!order.resultPath && Number.isFinite(published) && published <= now && now - published < RESULT_WINDOW_MS;
}

/** Nunca registrar el mensaje: contiene un enlace equivalente a una contraseña. */
export async function sendResultLink(order: { ownerPhone: string; orderCode: string; petName: string }, token: string): Promise<boolean> {
  try {
    const env = process.env as BookingEnv;
    // El simulador general registra mensajes completos, por lo que no se usa aquí.
    if (env.EVOLUTION_DRY_RUN === "true" || env.EVOLUTION_DRY_RUN === "1") return false;
    const dest = normalizePhoneDest(order.ownerPhone);
    if (!dest || !env.EVOLUTION_API_URL || !env.EVOLUTION_API_KEY || !env.EVOLUTION_INSTANCE) return false;
    const origin = new URL(process.env.LAB_RESULT_PUBLIC_ORIGIN || PUBLIC_ORIGIN);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) return false;
    const link = `${origin.origin}/estado?code=${encodeURIComponent(order.orderCode)}#resultado=${token}`;
    const text = `📄 El resultado de ${order.petName} está disponible.\n\nÁbrelo con este enlace privado:\n${link}\n\nNo compartas este enlace. Está disponible hasta 20 días desde su publicación.`;
    return (await sendViaEvolution([text], env, fetch, dest)).ok;
  } catch {
    return false;
  }
}
