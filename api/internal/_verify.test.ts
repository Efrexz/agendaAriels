import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }) }));

describe("autorización de personal", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_URL", "https://supa.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test");
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "staff-id", email: "staff@example.test" } }, error: null });
    mocks.from.mockReset().mockReturnValue({ select: mocks.select });
    mocks.select.mockReset().mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReset().mockReturnValue({ eq: mocks.eq, maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockReset().mockResolvedValue({ data: { user_id: "staff-id" }, error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("acepta únicamente sesión válida con membresía activa", async () => {
    const { verifyStaff } = await import("./_verify.js");
    expect(await verifyStaff("jwt-de-prueba")).toEqual({ id: "staff-id", email: "staff@example.test" });
    expect(mocks.getUser).toHaveBeenCalledWith("jwt-de-prueba");
    expect(mocks.from).toHaveBeenCalledWith("staff_users");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "staff-id");
    expect(mocks.eq).toHaveBeenCalledWith("active", true);
  });

  it("rechaza una sesión válida sin membresía activa", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const { verifyStaff } = await import("./_verify.js");
    expect(await verifyStaff("jwt-de-prueba")).toBeNull();
  });

  it("rechaza cuando falla la consulta de permisos o falta la tabla", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "falló" } });
    const { verifyStaff } = await import("./_verify.js");
    expect(await verifyStaff("jwt-de-prueba")).toBeNull();
  });

  it("rechaza tokens inválidos o fallos de red sin consultar permisos", async () => {
    const { verifyStaff } = await import("./_verify.js");
    mocks.getUser.mockRejectedValueOnce(new Error("error de red"));
    expect(await verifyStaff("jwt-de-prueba")).toBeNull();
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "token inválido" } });
    expect(await verifyStaff("inválido")).toBeNull();
    expect(await verifyStaff(null)).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
