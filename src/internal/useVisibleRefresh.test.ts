import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleVisibleRefresh } from "./useVisibleRefresh";

class FakeVisibility extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
}
afterEach(() => vi.useRealTimers());
describe("refresco visible", () => {
  it("actualiza cada intervalo solo si está visible y al regresar", () => {
    vi.useFakeTimers();
    const source = new FakeVisibility();
    const refresh = vi.fn();
    const stop = scheduleVisibleRefresh(source as Document, refresh, 30_000);
    vi.advanceTimersByTime(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    source.visibilityState = "hidden";
    source.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    source.visibilityState = "visible";
    source.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(60_000);
    source.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
