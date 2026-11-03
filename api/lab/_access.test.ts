import { afterEach, describe, expect, it, vi } from "vitest";

const send = vi.fn(async () => ({ ok: true as const }));
vi.mock("../_booking.js", () => ({
  normalizePhoneDest: () => "51999999999",
  sendViaEvolution: send,
}));
const { newResultToken, resultTokenHash, tokenMatches, resultAvailable, sendResultLink } = await import("./_access.js");
const order = { ownerPhone: "999999999", orderCode: "LAB-ABCDE", petName: "Mascota QA" };

afterEach(() => { vi.unstubAllEnvs(); send.mockClear(); });

describe("acceso privado de laboratorio", () => {
  it("genera tokens aleatorios y solo valida la huella correspondiente", () => {
    const token = newResultToken();
    const other = newResultToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(other).not.toBe(token);
    expect(tokenMatches(token, resultTokenHash(token))).toBe(true);
    expect(tokenMatches(other, resultTokenHash(token))).toBe(false);
    expect(tokenMatches(token, null)).toBe(false);
    expect(tokenMatches("invalido", resultTokenHash(token))).toBe(false);
  });

  it("rechaza archivos vencidos, sin fecha o con fecha futura", () => {
    const now = Date.now();
    expect(resultAvailable({ resultPath: "a", resultPublishedAt: new Date(now - 19 * 86400_000).toISOString() }, now)).toBe(true);
    expect(resultAvailable({ resultPath: "a", resultPublishedAt: new Date(now - 20 * 86400_000).toISOString() }, now)).toBe(false);
    expect(resultAvailable({ resultPath: null, resultPublishedAt: new Date(now).toISOString() }, now)).toBe(false);
    expect(resultAvailable({ resultPath: "a", resultPublishedAt: new Date(now + 1).toISOString() }, now)).toBe(false);
  });

  it("no envía ni registra el token en modo de simulación", async () => {
    vi.stubEnv("EVOLUTION_DRY_RUN", "true");
    const log = vi.spyOn(console, "log");
    expect(await sendResultLink(order, newResultToken())).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("envía el enlace en el fragmento URL cuando Evolution está disponible", async () => {
    vi.stubEnv("EVOLUTION_DRY_RUN", "false");
    vi.stubEnv("EVOLUTION_API_URL", "https://example.test");
    vi.stubEnv("EVOLUTION_API_KEY", "test");
    vi.stubEnv("EVOLUTION_INSTANCE", "test");
    const token = newResultToken();
    expect(await sendResultLink(order, token)).toBe(true);
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0][0]).toContain(`?code=LAB-ABCDE#resultado=${token}`);
  });

  it("permite elegir un origen HTTPS de prueba y rechaza orígenes inválidos", async () => {
    vi.stubEnv("EVOLUTION_DRY_RUN", "false");
    vi.stubEnv("EVOLUTION_API_URL", "https://example.test");
    vi.stubEnv("EVOLUTION_API_KEY", "test");
    vi.stubEnv("EVOLUTION_INSTANCE", "test");
    vi.stubEnv("LAB_RESULT_PUBLIC_ORIGIN", "https://preview.example.test");
    expect(await sendResultLink(order, newResultToken())).toBe(true);
    expect(send.mock.calls[0][0][0]).toContain("https://preview.example.test/estado?");
    vi.stubEnv("LAB_RESULT_PUBLIC_ORIGIN", "http://insecure.example.test");
    expect(await sendResultLink(order, newResultToken())).toBe(false);
    expect(send).toHaveBeenCalledOnce();
  });
});
