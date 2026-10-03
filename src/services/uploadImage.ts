const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
const MAX_IMAGE_SIDE = 1200;

export function isUploadTooLarge(file: File): boolean {
  return file.size > MAX_UPLOAD_BYTES;
}

function buildUrl(secureUrl: string): string {
  return secureUrl.replace(
    "/upload/",
    "/upload/f_auto,q_auto,w_800,c_limit/"
  );
}

export async function compressImage(file: File): Promise<File> {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });

    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
    if (scale === 1 && file.size <= MAX_UPLOAD_BYTES * 0.6) {
      URL.revokeObjectURL(url);
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return file;
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8)
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^./]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

async function uploadFileToCloudinary(file: File): Promise<string | null> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: fd, signal: controller.signal }
    );

    if (!res.ok) return null;

    const data: { secure_url?: string } = await res.json();
    if (!data.secure_url) return null;

    return buildUrl(data.secure_url);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadFile(file: File): Promise<string | null> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) return null;
  const optimized = await compressImage(file);
  return uploadFileToCloudinary(optimized);
}

export async function uploadImage(base64: string): Promise<string | null> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) return null;

  try {
    const blob = await (await fetch(base64)).blob();
    const file = new File([blob], "referencia-corte.jpg", { type: blob.type || "image/jpeg" });
    return await uploadFile(file);
  } catch {
    return null;
  }
}
