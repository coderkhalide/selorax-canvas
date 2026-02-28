import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Helper: create a minimal NextRequest-like object
function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return {
    json: () => Promise.resolve(body),
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
  } as any;
}

// Helper: create a mock upstream fetch with streaming chunks
function mockUpstreamStream(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  let idx = 0;
  const body = {
    getReader: () => ({
      read: async () => {
        if (idx < chunks.length) {
          return { done: false as const, value: encoder.encode(chunks[idx++]) };
        }
        return { done: true as const, value: undefined };
      },
      cancel: vi.fn().mockResolvedValue(undefined),
    }),
  };
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    body,
    text: () => Promise.resolve("upstream error"),
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "http://test-backend");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/funnel-agent", () => {
  it("returns 400 when messages array has no user message", async () => {
    const { POST } = await import("../route");
    const req = makeRequest({ messages: [{ role: "assistant", content: "hi" }] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when messages is empty", async () => {
    const { POST } = await import("../route");
    const req = makeRequest({ messages: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("forwards the last user message as prompt to backend", async () => {
    const fetchMock = mockUpstreamStream(["response"]);
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("../route");

    const req = makeRequest({
      messages: [{ role: "user", content: "Add a button" }],
      pageId: "pg-1",
      tenantId: "store_001",
    });
    await POST(req);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://test-backend/api/ai/canvas",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"prompt":"Add a button"'),
      })
    );
  });

  it("forwards page_id and tenant_id to backend", async () => {
    vi.stubGlobal("fetch", mockUpstreamStream(["ok"]));
    const { POST } = await import("../route");

    const req = makeRequest({
      messages: [{ role: "user", content: "test" }],
      pageId: "page-99",
      tenantId: "store_001",
    });
    await POST(req);

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sent = JSON.parse(options.body);
    expect(sent.page_id).toBe("page-99");
    expect(sent.tenant_id).toBe("store_001");
  });

  it("uses x-tenant-id header over body tenantId", async () => {
    vi.stubGlobal("fetch", mockUpstreamStream(["ok"]));
    const { POST } = await import("../route");

    const req = makeRequest(
      { messages: [{ role: "user", content: "test" }], tenantId: "body_tenant" },
      { "x-tenant-id": "header_tenant" }
    );
    await POST(req);

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers["x-tenant-id"]).toBe("header_tenant");
  });

  it("re-encodes plain text stream chunks as SSE data events", async () => {
    vi.stubGlobal("fetch", mockUpstreamStream(["Hello", " world"]));
    const { POST } = await import("../route");

    const req = makeRequest({ messages: [{ role: "user", content: "hi" }] });
    const res = await POST(req);

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    // Read the stream
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let output = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value);
    }

    expect(output).toContain('data: {"content":"Hello"}');
    expect(output).toContain('data: {"content":" world"}');
  });

  it("handles multimodal content array — extracts text parts for prompt", async () => {
    const fetchMock = mockUpstreamStream(["ok"]);
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("../route");

    const req = makeRequest({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image" },
            { type: "image_url", url: "https://example.com/img.png" },
          ],
        },
      ],
    });
    await POST(req);

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sent = JSON.parse(options.body);
    expect(sent.prompt).toContain("Describe this image");
  });

  it("returns upstream error status when backend is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve("Service unavailable"),
      })
    );
    const { POST } = await import("../route");

    const req = makeRequest({ messages: [{ role: "user", content: "test" }] });
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("picks the last user message when multiple messages are present", async () => {
    const fetchMock = mockUpstreamStream(["ok"]);
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("../route");

    const req = makeRequest({
      messages: [
        { role: "user", content: "First message" },
        { role: "assistant", content: "Response" },
        { role: "user", content: "Last user message" },
      ],
    });
    await POST(req);

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sent = JSON.parse(options.body);
    expect(sent.prompt).toBe("Last user message");
  });

  it("defaults page_id to 'unknown' when pageId is absent", async () => {
    vi.stubGlobal("fetch", mockUpstreamStream(["ok"]));
    const { POST } = await import("../route");

    const req = makeRequest({
      messages: [{ role: "user", content: "test" }],
    });
    await POST(req);

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sent = JSON.parse(options.body);
    expect(sent.page_id).toBe("unknown");
  });

  it("defaults tenant_id to store_001 when no header or body tenantId", async () => {
    vi.stubGlobal("fetch", mockUpstreamStream(["ok"]));
    const { POST } = await import("../route");

    const req = makeRequest({
      messages: [{ role: "user", content: "test" }],
    });
    await POST(req);

    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const sent = JSON.parse(options.body);
    expect(sent.tenant_id).toBe("store_001");
  });

  it("returns 400 when prompt is empty string after joining multimodal parts", async () => {
    const { POST } = await import("../route");
    // All content parts are non-text types — no text to extract
    const req = makeRequest({
      messages: [
        {
          role: "user",
          content: [{ type: "image_url", url: "https://example.com/img.png" }],
        },
      ],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 500 when upstream response has no body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: null,
        text: () => Promise.resolve(""),
      })
    );
    const { POST } = await import("../route");

    const req = makeRequest({ messages: [{ role: "user", content: "test" }] });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
