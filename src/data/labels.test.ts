import { describe, it, expect } from "vitest";
import { formatExtraLabel, type ExtraServiceLike } from "./labels";

describe("formatExtraLabel", () => {
  it("returns service label without variant", () => {
    expect(formatExtraLabel({ service: "deworming" })).toBe("Desparasitación");
  });

  it("returns service label with variant", () => {
    expect(
      formatExtraLabel({ service: "antiflea", variant: "1m_pipeta_fipforte" })
    ).toBe("Antipulgas (Pipeta Fip Forte, 1 mes)");
  });

  it("returns raw service key if unknown", () => {
    expect(formatExtraLabel({ service: "unknown_service" })).toBe("unknown_service");
  });

  it("returns raw variant key if unknown within known service", () => {
    expect(
      formatExtraLabel({ service: "deworming", variant: "unknown_variant" })
    ).toBe("Desparasitación (unknown_variant)");
  });

  it("handles ExtraServiceLike from labels import", () => {
    const extra: ExtraServiceLike = { service: "vaccine", variant: "rabia" };
    expect(formatExtraLabel(extra)).toBe("Vacuna (Antirrábica)");
  });
});
