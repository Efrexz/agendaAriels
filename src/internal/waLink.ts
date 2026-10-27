// Normalización del teléfono del dueño para wa.me — helper puro con test.
// 999 111 222 → 51999111222; "+51 986..." → 51986985047; placeholder "-" → null.

export function waLink(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  const with51 = digits.startsWith("51") ? digits : `51${digits}`;
  return `https://wa.me/${with51}?text=${encodeURIComponent(message)}`;
}
