import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedCron } from "./_cron.js";

describe("autorización de tareas programadas", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("rechaza secretos ausentes, vacíos o solo con espacios", () => {
    expect(isAuthorizedCron({ authorization: "Bearer prueba" }, "")).toBe(false);
    expect(isAuthorizedCron({ authorization: "Bearer prueba" }, "   ")).toBe(false);
    vi.stubEnv("CRON_SECRET", undefined);
    expect(isAuthorizedCron({ authorization: "Bearer prueba" })).toBe(false);
  });

  it("solo acepta el Bearer exacto", () => {
    expect(isAuthorizedCron({ authorization: "Bearer secreto-prueba" }, "secreto-prueba")).toBe(true);
    expect(isAuthorizedCron({}, "secreto-prueba")).toBe(false);
    expect(isAuthorizedCron({ authorization: "Bearer incorrecto" }, "secreto-prueba")).toBe(false);
    expect(isAuthorizedCron({ authorization: "secreto-prueba" }, "secreto-prueba")).toBe(false);
    expect(isAuthorizedCron({ authorization: ["Bearer secreto-prueba"] }, "secreto-prueba")).toBe(false);
  });
});
