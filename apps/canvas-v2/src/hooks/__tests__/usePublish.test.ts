import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// usePublish reads NEXT_PUBLIC_BACKEND_URL at module level, so we must
// reset modules + re-import dynamically after stubbing the env var.

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "http://test-backend");
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("usePublish", () => {
  it("starts in idle state with no error", async () => {
    vi.resetModules();
    const { usePublish } = await import("../usePublish");
    const { result } = renderHook(() => usePublish("page-1", "store_001"));
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("transitions to success on ok response and auto-resets to idle after 3s", async () => {
    vi.stubGlobal("fetch", mockFetch({ success: true }));
    vi.resetModules();
    const { usePublish } = await import("../usePublish");
    const { result } = renderHook(() => usePublish("page-1", "store_001"));

    let ok = false;
    await act(async () => {
      ok = await result.current.publish();
    });
    expect(ok).toBe(true);
    expect(result.current.status).toBe("success");

    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(result.current.status).toBe("idle");
  });

  it("transitions to error on failed response and auto-resets after 4s", async () => {
    vi.stubGlobal("fetch", mockFetch({ error: "Not found" }, 404));
    vi.resetModules();
    const { usePublish } = await import("../usePublish");
    const { result } = renderHook(() => usePublish("page-1", "store_001"));

    let ok = true;
    await act(async () => {
      ok = await result.current.publish();
    });
    expect(ok).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.error).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(result.current.status).toBe("idle");
  });

  it("returns false and sets error when pageId is undefined", async () => {
    vi.resetModules();
    const { usePublish } = await import("../usePublish");
    const { result } = renderHook(() => usePublish(undefined, "store_001"));
    let ok = true;
    await act(async () => {
      ok = await result.current.publish();
    });
    expect(ok).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it("calls the correct URL with POST method and tenant header", async () => {
    const fetchMock = mockFetch({ success: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();
    const { usePublish } = await import("../usePublish");
    const { result } = renderHook(() => usePublish("page-42", "tenant_xyz"));

    await act(async () => {
      await result.current.publish();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://test-backend/api/pages/page-42/publish",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-tenant-id": "tenant_xyz" }),
      })
    );
  });
});
