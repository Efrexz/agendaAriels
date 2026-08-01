import { describe, it, expect } from "vitest";
import { haversineKm, isWithinPickupRange } from "./geo";

describe("haversineKm", () => {
  it("returns 0 for identical coordinates", () => {
    const a = { lat: -12.046, lng: -77.042 };
    expect(haversineKm(a, a)).toBeCloseTo(0, 2);
  });

  it("is symmetric", () => {
    const a = { lat: -12.0, lng: -77.0 };
    const b = { lat: -12.1, lng: -77.1 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 5);
  });

  it("returns reasonable distance between known Lima points", () => {
    const sanMartin = { lat: -12.0194, lng: -77.0712 };
    const sanMiguel = { lat: -12.0783, lng: -77.0904 };
    // San Martín → San Miguel is roughly 6–8 km
    const dist = haversineKm(sanMartin, sanMiguel);
    expect(dist).toBeGreaterThan(5);
    expect(dist).toBeLessThan(10);
  });

  it("returns distance for points across Lima", () => {
    const centro = { lat: -12.0464, lng: -77.0428 };
    const miraflores = { lat: -12.1211, lng: -77.0298 };
    // Centro → Miraflores ~8–10 km
    const dist = haversineKm(centro, miraflores);
    expect(dist).toBeGreaterThan(7);
    expect(dist).toBeLessThan(12);
  });
});

describe("isWithinPickupRange", () => {
  const branch = { lat: -12.0194, lng: -77.0712 };
  const maxKm = 8;

  it("returns true when within range", () => {
    // ~3.6 km from San Martín
    const nearby = { lat: -12.0, lng: -77.05 };
    expect(isWithinPickupRange(branch, nearby, maxKm)).toBe(true);
  });

  it("returns false when out of range", () => {
    // Surco area, ~30+ km from San Martín
    const far = { lat: -12.18, lng: -76.98 };
    expect(isWithinPickupRange(branch, far, maxKm)).toBe(false);
  });

  it("returns true at exactly the boundary", () => {
    const { lat, lng } = branch;
    // Move 8 km north
    const kmPerDegreeLat = 111.32;
    const delta = maxKm / kmPerDegreeLat;
    const boundary = { lat: lat + delta, lng };
    expect(isWithinPickupRange(branch, boundary, maxKm)).toBe(true);
  });

  it("returns false just over the boundary", () => {
    const { lat, lng } = branch;
    const kmPerDegreeLat = 111.32;
    const delta = (maxKm + 0.05) / kmPerDegreeLat;
    const justOver = { lat: lat + delta, lng };
    expect(isWithinPickupRange(branch, justOver, maxKm)).toBe(false);
  });
});
