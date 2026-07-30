const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

function buildUrl(secureUrl: string): string {
  return secureUrl.replace(
    "/upload/",
    "/upload/f_auto,q_auto,w_800,c_limit/"
  );
}

async function upload(formData: FormData): Promise<string | null> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) return null;

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) return null;

  const data: { secure_url?: string } = await res.json();
  if (!data.secure_url) return null;

  return buildUrl(data.secure_url);
}

export function uploadFile(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET ?? "");
  return upload(fd);
}

export async function uploadImage(base64: string): Promise<string | null> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) return null;

  try {
    const blob = await (await fetch(base64)).blob();
    const fd = new FormData();
    fd.append("file", blob);
    fd.append("upload_preset", UPLOAD_PRESET);

    return await upload(fd);
  } catch {
    return null;
  }
}