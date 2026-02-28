import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAIPrompt } from "../useAIPrompt";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeStream(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe("useAIPrompt", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("starts with idle state", () => {
    const { result } = renderHook(() => useAIPrompt({ pageId: "p1", tenantId: "t1" }));
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.response).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("streams response text from SSE chunks", async () => {
    const sseChunks = [
      `data: ${JSON.stringify({ content: "Hello " })}\n\n`,
      `data: ${JSON.stringify({ content: "world" })}\n\n`,
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: makeStream(sseChunks),
    });

    const { result } = renderHook(() => useAIPrompt({ pageId: "p1", tenantId: "t1" }));

    await act(async () => {
      await result.current.sendPrompt("Make the button blue");
    });

    expect(result.current.response).toBe("Hello world");
    expect(result.current.isStreaming).toBe(false);
  });

  it("sets error on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const { result } = renderHook(() => useAIPrompt({ pageId: "p1", tenantId: "t1" }));

    await act(async () => {
      await result.current.sendPrompt("test");
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isStreaming).toBe(false);
  });

  it("clears response when clearResponse is called", async () => {
    const sseChunks = [`data: ${JSON.stringify({ content: "Hi" })}\n\n`];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: makeStream(sseChunks),
    });

    const { result } = renderHook(() => useAIPrompt({ pageId: "p1", tenantId: "t1" }));

    await act(async () => {
      await result.current.sendPrompt("test");
    });

    expect(result.current.response).toBe("Hi");

    act(() => {
      result.current.clearResponse();
    });

    expect(result.current.response).toBe("");
    expect(result.current.error).toBeNull();
  });

  it("handles SSE data line split across two chunks", async () => {
    const content = { content: "split" };
    const full = `data: ${JSON.stringify(content)}\n\n`;
    const mid = Math.floor(full.length / 2);
    const chunk1 = full.slice(0, mid);
    const chunk2 = full.slice(mid);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: makeStream([chunk1, chunk2]),
    });

    const { result } = renderHook(() => useAIPrompt({ pageId: "p1", tenantId: "t1" }));

    await act(async () => {
      await result.current.sendPrompt("test split");
    });

    expect(result.current.response).toBe("split");
  });

  it("second sendPrompt cancels first and does not clear isStreaming prematurely", async () => {
    // First call: slow stream (we won't resolve it)
    let resolveFirst!: () => void;
    const firstStream = new ReadableStream({
      start(controller) {
        // Never enqueues anything — waits for resolveFirst
        resolveFirst = () => controller.close();
      },
    });

    // Second call: instant response
    const sseChunks = [`data: ${JSON.stringify({ content: "second" })}\n\n`];

    mockFetch
      .mockResolvedValueOnce({ ok: true, body: firstStream })
      .mockResolvedValueOnce({ ok: true, body: makeStream(sseChunks) });

    const { result } = renderHook(() => useAIPrompt({ pageId: "p1", tenantId: "t1" }));

    // Start first call (don't await)
    void result.current.sendPrompt("first");

    // Immediately start second call
    await act(async () => {
      await result.current.sendPrompt("second");
    });

    // Close first stream after second completes
    resolveFirst();

    expect(result.current.response).toBe("second");
    expect(result.current.isStreaming).toBe(false);
  });
});
