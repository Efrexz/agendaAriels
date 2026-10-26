import { describe, it, expect } from "vitest";
import { clearMedProfile, loadMedProfile, saveMedProfile } from "./clientProfileMed";

function storageStub() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe("clientProfileMed", () => {
  it("guarda y recarga el dueño (nombre/celular/correo)", () => {
    const s = storageStub();
    saveMedProfile({ ownerName: "Efraín Andrade", ownerPhone: "51917104426", ownerEmail: "a@b.pe" }, s);
    const p = loadMedProfile(s);
    expect(p?.ownerName).toBe("Efraín Andrade");
    expect(p?.ownerPhone).toBe("51917104426");
    expect(p?.ownerEmail).toBe("a@b.pe");
  });

  it("normaliza espacios y no guarda si name/phone vacíos", () => {
    const s = storageStub();
    saveMedProfile({ ownerName: "  Juan  ", ownerPhone: " 999 ", ownerEmail: "" }, s);
    const p = loadMedProfile(s);
    expect(p?.ownerName).toBe("Juan");
    expect(p?.ownerPhone).toBe("999");
    saveMedProfile({ ownerName: "", ownerPhone: "", ownerEmail: "x@y" }, s);
    expect(loadMedProfile(s)?.ownerName).toBe("Juan");
  });

  it("clearMedProfile borra (y reload devuelve null)", () => {
    const s = storageStub();
    saveMedProfile({ ownerName: "Ana", ownerPhone: "111", ownerEmail: "" }, s);
    clearMedProfile(s);
    expect(loadMedProfile(s)).toBeNull();
    expect(s.getItem("vcm_client_profile_v1")).toBeNull();
  });

  it("perfil corrupto se auto-limpia (no revienta)", () => {
    const s = storageStub();
    s.setItem("vcm_client_profile_v1", "{no-es-json");
    expect(loadMedProfile(s)).toBeNull();
    s.setItem("vcm_client_profile_v1", JSON.stringify({ savedAt: "x" })); // faltan campos
    expect(loadMedProfile(s)).toBeNull();
  });
});
