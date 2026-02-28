import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePages } from "../usePages";

const MOCK_PAGES = [
  { id: "p1", title: "Home", slug: "home", pageType: "landing", createdAt: "2026-01-01", publishedVersionId: null },
  { id: "p2", title: "About", slug: "about", pageType: "landing", createdAt: "2026-01-02", publishedVersionId: "v1" },
];

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
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("usePages", () => {
  it("fetches pages on mount and sets them", async () => {
    vi.stubGlobal("fetch", mockFetch(MOCK_PAGES));
    const { result } = renderHook(() => usePages("store_001"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pages).toHaveLength(2);
    expect(result.current.pages[0].id).toBe("p1");
  });

  it("sends x-tenant-id header", async () => {
    const fetchMock = mockFetch(MOCK_PAGES);
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => usePages("tenant_xyz"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-backend/api/pages",
        expect.objectContaining({
          headers: expect.objectContaining({ "x-tenant-id": "tenant_xyz" }),
        })
      )
    );
  });

  it("handles wrapped { pages: [...] } response shape", async () => {
    vi.stubGlobal("fetch", mockFetch({ pages: MOCK_PAGES }));
    const { result } = renderHook(() => usePages("store_001"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pages).toHaveLength(2);
  });

  it("sets error on failed fetch", async () => {
    vi.stubGlobal("fetch", mockFetch("Not found", 404));
    const { result } = renderHook(() => usePages("store_001"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.pages).toHaveLength(0);
  });

  it("createPage sends POST and prepends new page to list", async () => {
    const newPage = { id: "p3", title: "New", slug: "new-123", pageType: "landing", createdAt: "2026-01-03", publishedVersionId: null };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(MOCK_PAGES) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve(newPage) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePages("store_001"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: typeof newPage | null = null;
    await act(async () => {
      created = (await result.current.createPage("New", "landing")) as typeof newPage | null;
    });

    expect(created?.id).toBe("p3");
    expect(result.current.pages[0].id).toBe("p3");
  });

  it("createPage returns null on backend error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve("error") });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePages("store_001"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created: unknown = "sentinel";
    await act(async () => {
      created = await result.current.createPage("X", "landing");
    });
    expect(created).toBeNull();
  });
});
