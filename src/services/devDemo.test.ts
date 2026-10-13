import { describe, it, expect } from "vitest";
import { applyDevDemoTo } from "./devDemo";
import { loadClientProfile } from "./clientProfile";

function storageStub() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe("applyDevDemoTo", () => {
  it("?demo=1 siembra el perfil demo', fuera de dev no", () => {
    const storage = storageStub();
    applyDevDemoTo(false, "?demo=1", storage);
    expect(loadClientProfile(storage)).toBeNull();

    applyDevDemoTo(true, "?demo=1", storage);
    const profile = loadClientProfile(storage);
    expect(profile).not.toBeNull();
    expect(profile?.pets).toHaveLength(3);
    expect(profile?.pets.map((p) => p.petName)).toEqual(["Rocky", "Luna", "Michi"]);
    expect(profile?.owner.ownerName).toBe("Demo Pérez");
  });

  it("?demo=0 limpia el perfil sembrado", () => {
    const storage = storageStub();
    applyDevDemoTo(true, "?demo=1", storage);
    expect(loadClientProfile(storage)).not.toBeNull();
    applyDevDemoTo(true, "?demo=0", storage);
    expect(loadClientProfile(storage)).toBeNull();
  });

  it("sin ?demo= el perfil del navegador no se toca", () => {
    const storage = storageStub();
    applyDevDemoTo(true, "", storage);
    expect(storage.getItem("va_client_profile_v1")).toBeNull();
  });

  it("sin storage no explota", () => {
    expect(() => applyDevDemoTo(true, "?demo=1", null)).not.toThrow();
  });
});
