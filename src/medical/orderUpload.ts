// Prepara el archivo de la orden sellada (rayos/eco) para subirlo por la API:
// base64 con compresión client-side. Las fotos de teléfono (4–6 MB) se
// reducen por canvas a máx 1600px JPEG q0.85 (~200–500 KB) sin perder
// legibilidad del sello — dentro del límite del body de Vercel (4.5 MB).

export const MAX_ORDER_BYTES = 3 * 1024 * 1024; // 3 MB (PDF y ya-comprimidas)

export async function prepareOrderBase64(file: File): Promise<{ base64: string; mime: string }> {
  const strip = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(",") + 1);
  const readAsDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });

  if (file.type === "application/pdf") {
    if (file.size > MAX_ORDER_BYTES) {
      throw new Error("El PDF pesa más de 3 MB. Tómale una foto a la orden y sube la imagen.");
    }
    return { base64: strip(await readAsDataUrl()), mime: "application/pdf" };
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Sube una foto (JPG/PNG) o un PDF de la orden.");
  }

  // Imagen pequeña: va tal cual (png/webp/jpeg — la API valida la firma real).
  if (file.size <= 1_200_000) {
    return { base64: strip(await readAsDataUrl()), mime: file.type };
  }

  // Foto de teléfono: comprimir por canvas (el sello sigue legible).
  const dataUrl = await readAsDataUrl();
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("No se pudo procesar la imagen"));
    img.src = dataUrl;
  });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { base64: canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "", mime: "image/jpeg" };
}
