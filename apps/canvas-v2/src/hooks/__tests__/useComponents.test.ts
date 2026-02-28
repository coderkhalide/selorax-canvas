import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useComponents } from "../useComponents";

const MOCK_COMPONENTS = [
  {
    id: "comp-1",
    name: "Countdown Timer",
    category: "Marketing",
    thumbnailUrl: "https://r2.dev/thumb.png",
    versions: [{ compiledUrl: "https://r2.dev/countdown.js" }],
  },
  {
    id: "comp-2",
    name: "Hero Banner",
    category: "Layout",
    thumbnailUrl: null,
    versions: [{ compiledUrl: "https://r2.dev/hero.js" }],
  },
  {
    // No versions — should be filtered out
    id: "comp-3",
    name: "Draft Component",
    category: "General",
    thumbnailUrl: null,
    versions: [],
  },
];

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "http://test-backend");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("useComponents", () => {
  it("fetches components on mount and filters out components with no versions", async () => {
    vi.stubGlobal("fetch", mockFetch(MOCK_COMPONENTS));
    const { result } = renderHook(() => useComponents("store_001"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.components).toHaveLength(2); // comp-3 filtered out
  });

  it("maps versions[0].compiledUrl to componentUrl", async () => {
    vi.stubGlobal("fetch", mockFetch(MOCK_COMPONENTS));
    const { result } = renderHook(() => useComponents("store_001"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.components[0].componentUrl).toBe("https://r2.dev/countdown.js");
    expect(result.current.components[1].componentUrl).toBe("https://r2.dev/hero.js");
  });

  it("handles wrapped { components: [...] } response shape", async () => {
    vi.stubGlobal("fetch", mockFetch({ components: MOCK_COMPONENTS }));
    const { result } = renderHook(() => useComponents("store_001"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.components).toHaveLength(2);
  });

  it("sets error on failed fetch", async () => {
    vi.stubGlobal("fetch", mockFetch("Error", 500));
    const { result } = renderHook(() => useComponents("store_001"));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.components).toHaveLength(0);
  });

  it("sends x-tenant-id header", async () => {
    const fetchMock = mockFetch(MOCK_COMPONENTS);
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => useComponents("store_xyz"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-backend/api/components",
        expect.objectContaining({
          headers: expect.objectContaining({ "x-tenant-id": "store_xyz" }),
        })
      )
    );
  });
});
