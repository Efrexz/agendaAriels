import { timingSafeEqual } from "node:crypto";

/** Vercel envía CRON_SECRET como Authorization: Bearer <secret>.
 * Sin secreto configurado no se permite ejecutar tareas en ningún entorno. */
export function isAuthorizedCron(
  headers: Record<string, string | string[] | undefined>,
  secret: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (!secret?.trim() || typeof headers.authorization !== "string") return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(headers.authorization);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
