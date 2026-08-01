import { describe, it, expect } from "vitest";
import { BRANCHES, BRANCH_BY_VALUE, BRANCH_COORDS, MAX_PICKUP_DISTANCE_KM, isBranchOpen } from "./branches";

describe("BRANCHES", () => {
  it("has three branches", () => {
    expect(BRANCHES).toHaveLength(3);
  });

  it("each branch has required fields", () => {
    for (const branch of BRANCHES) {
      expect(branch.value).toBeTruthy();
      expect(branch.label).toBeTruthy();
      expect(branch.address).toBeTruthy();
      expect(branch.phone).toBeTruthy();
      expect(branch.opensAt).toBeLessThan(branch.closesAt);
      expect(branch.coords).toBeDefined();
      expect(typeof branch.coords.lat).toBe("number");
      expect(typeof branch.coords.lng).toBe("number");
    }
  });

  it("each branch has coordinates within Lima area", () => {
    for (const branch of BRANCHES) {
      expect(branch.coords.lat).toBeLessThan(-11.9);
      expect(branch.coords.lat).toBeGreaterThan(-12.2);
      expect(branch.coords.lng).toBeLessThan(-77.0);
      expect(branch.coords.lng).toBeGreaterThan(-77.2);
    }
  });
});

describe("BRANCH_BY_VALUE", () => {
  it("looks up branch by value", () => {
    const branch = BRANCH_BY_VALUE["san_martin"];
    expect(branch?.label).toBe("Sede San Martín de Porres");
  });

  it("returns undefined for invalid value", () => {
    expect(BRANCH_BY_VALUE["invalid"]).toBeUndefined();
  });
});

describe("BRANCH_COORDS", () => {
  it("maps each branch value to its coordinates", () => {
    for (const branch of BRANCHES) {
      expect(BRANCH_COORDS[branch.value]).toEqual(branch.coords);
    }
  });
});

describe("MAX_PICKUP_DISTANCE_KM", () => {
  it("is a positive number", () => {
    expect(MAX_PICKUP_DISTANCE_KM).toBeGreaterThan(0);
  });
});

describe("isBranchOpen", () => {
  it("returns true when within hours", () => {
    // 10 AM UTC → 5 AM in Lima (UTC-5), within 8-21
    const at10am = new Date("2025-06-15T15:00:00Z"); // 10 AM EST / 15:00 UTC
    // Actually, this is timezone-dependent. Let's use a mock approach.
    // Lima is UTC-5 normally. So 15:00 UTC = 10:00 Lima time.
    // Branch hours: 8:00 – 21:00. 10:00 is within range.
    const branch = BRANCHES[0];
    expect(isBranchOpen(branch, at10am)).toBe(true);
  });

  it("returns false when before opening", () => {
    // 11 PM UTC = 6 PM Lima → wait, that's still within 8-21.
    // Let's use 10 AM UTC = 5 AM Lima → closed
    const at5am = new Date("2025-06-15T10:00:00Z"); // 5 AM Lima
    const branch = BRANCHES[0];
    expect(isBranchOpen(branch, at5am)).toBe(false);
  });

  it("returns false when after closing", () => {
    // 3 AM UTC = 10 PM Lima (22:00) → closed
    const at10pm = new Date("2025-06-16T03:00:00Z"); // 10 PM Lima
    const branch = BRANCHES[0];
    expect(isBranchOpen(branch, at10pm)).toBe(false);
  });

  it("returns true at exactly opening time", () => {
    // 1 PM UTC = 8 AM Lima
    const at8am = new Date("2025-06-15T13:00:00Z");
    const branch = BRANCHES[0];
    expect(isBranchOpen(branch, at8am)).toBe(true);
  });

  it("returns false at exactly closing time", () => {
    // 2 AM UTC = 9 PM Lima (21:00) → closesAt is exclusive (h < closesAt)
    const at9pm = new Date("2025-06-16T02:00:00Z"); // 9 PM Lima
    const branch = BRANCHES[0];
    expect(isBranchOpen(branch, at9pm)).toBe(false);
  });
});
