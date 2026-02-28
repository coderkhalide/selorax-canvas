# AI Prompt Bar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a persistent AI prompt bar above the canvas that sends prompts to the Mastra backend (Claude Sonnet 4.6) and streams the response, with live canvas updates appearing via STDB subscription.

**Architecture:** A new `AIPromptBar` component renders above the canvas in `EditorLayout`. It calls `/api/funnel-agent` (the existing Next.js proxy that forwards to `canvas-backend /api/ai/canvas`). The Mastra agent executes STDB tools server-side; canvas-v2's `useTable` subscription picks up the changes live. A `useAIPrompt` hook handles the SSE streaming.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons, Next.js fetch streaming (SSE via ReadableStream + TextDecoder)

---

## Context for the implementer

### Relevant files to read before starting:
- `apps/canvas-v2/src/components/EditorLayout.tsx` — where to add `<AIPromptBar>`
- `apps/canvas-v2/src/app/api/funnel-agent/route.ts` — the proxy endpoint we call
- `apps/canvas-v2/src/context/FunnelContext.tsx` — provides `selectedId` (currently selected canvas element)
- `apps/canvas-v2/src/components/AIStatusBar.tsx` — pattern for how STDB-driven AI status works

### How the Mastra AI works:
1. POST to `/api/funnel-agent` with `{ messages: [{role:"user", content: prompt}], pageId, tenantId }`
2. The proxy extracts the last user message and calls `canvas-backend /api/ai/canvas`
3. Backend runs Mastra (Claude Sonnet 4.6), which calls STDB tools (insert_node, update_node_styles, etc.)
4. Canvas updates appear live via STDB WebSocket subscription in canvas-v2
5. The proxy streams Mastra's text response back as SSE: `data: {"content":"..."}\n\n`
6. `AIStatusBar` (bottom of screen) shows `ai_operation` STDB progress automatically

### Key constraint:
The proxy route (`/api/funnel-agent`) expects `{ messages: [{role: "user", content: string}], pageId, tenantId }`. It only uses the last user message. Keep the payload minimal.

---

## Task 1: `useAIPrompt` hook

**Files:**
- Create: `apps/canvas-v2/src/hooks/useAIPrompt.ts`

This hook handles sending a prompt to Mastra and streaming the text response.

**Step 1: Write the failing test**

Create `apps/canvas-v2/src/hooks/__tests__/useAIPrompt.test.ts`:

```typescript
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
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd apps/canvas-v2 && npx vitest run src/hooks/__tests__/useAIPrompt.test.ts
```

Expected: FAIL with "Cannot find module '../useAIPrompt'"

**Step 3: Implement `useAIPrompt`**

Create `apps/canvas-v2/src/hooks/useAIPrompt.ts`:

```typescript
import { useState, useRef, useCallback } from "react";

interface UseAIPromptOptions {
  pageId?: string;
  tenantId?: string;
  selectedNodeId?: string | null;
}

interface UseAIPromptReturn {
  isStreaming: boolean;
  response: string;
  error: string | null;
  sendPrompt: (prompt: string) => Promise<void>;
  clearResponse: () => void;
}

export function useAIPrompt({
  pageId,
  tenantId,
  selectedNodeId,
}: UseAIPromptOptions = {}): UseAIPromptReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendPrompt = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;

      // Abort any in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setIsStreaming(true);
      setResponse("");
      setError(null);

      try {
        const res = await fetch("/api/funnel-agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(tenantId ? { "x-tenant-id": tenantId } : {}),
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            pageId,
            tenantId,
            ...(selectedNodeId ? { selected_node_id: selectedNodeId } : {}),
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`AI request failed (${res.status}): ${text}`);
        }

        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setResponse((prev) => prev + data.content);
              }
            } catch {
              // ignore partial JSON lines
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError(err.message ?? "Unknown error");
      } finally {
        setIsStreaming(false);
      }
    },
    [pageId, tenantId, selectedNodeId]
  );

  const clearResponse = useCallback(() => {
    setResponse("");
    setError(null);
  }, []);

  return { isStreaming, response, error, sendPrompt, clearResponse };
}
```

**Step 4: Run tests to verify they pass**

```bash
cd apps/canvas-v2 && npx vitest run src/hooks/__tests__/useAIPrompt.test.ts
```

Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add apps/canvas-v2/src/hooks/useAIPrompt.ts apps/canvas-v2/src/hooks/__tests__/useAIPrompt.test.ts
git commit -m "feat: add useAIPrompt hook for Mastra SSE streaming"
```

---

## Task 2: `AIPromptBar` component

**Files:**
- Create: `apps/canvas-v2/src/components/AIPromptBar.tsx`

**Step 1: Implement the component**

No unit test needed — it's a pure UI wrapper around `useAIPrompt`. We'll verify visually.

Create `apps/canvas-v2/src/components/AIPromptBar.tsx`:

```typescript
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useAIPrompt } from "@/hooks/useAIPrompt";
import { useFunnel } from "@/context/FunnelContext";

interface AIPromptBarProps {
  pageId?: string;
  tenantId?: string;
}

export function AIPromptBar({ pageId, tenantId }: AIPromptBarProps) {
  const { selectedId } = useFunnel();
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isStreaming, response, error, sendPrompt, clearResponse } =
    useAIPrompt({ pageId, tenantId, selectedNodeId: selectedId });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const prompt = input;
    setInput("");
    await sendPrompt(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  const hasOutput = response || error;

  return (
    <div className="w-full border-b border-gray-200 bg-white">
      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2">
        <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0" />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedId
              ? "Ask AI to edit selected element..."
              : "Ask AI to edit this page..."
          }
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:opacity-50 py-0.5"
          style={{ minHeight: "24px", maxHeight: "120px" }}
        />
        {hasOutput && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            title={collapsed ? "Show response" : "Hide response"}
          >
            {collapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        )}
        {hasOutput && !isStreaming && (
          <button
            type="button"
            onClick={clearResponse}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            title="Clear response"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="flex-shrink-0 p-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-colors"
          title="Send to Mastra AI"
        >
          {isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>

      {/* Response area */}
      {hasOutput && !collapsed && (
        <div className="px-4 pb-3">
          {error ? (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">
              {error}
            </p>
          ) : (
            <div className="text-xs text-gray-700 bg-gray-50 px-3 py-2 rounded border border-gray-200 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {response}
              {isStreaming && (
                <span className="inline-block w-1.5 h-3.5 bg-purple-500 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/canvas-v2/src/components/AIPromptBar.tsx
git commit -m "feat: add AIPromptBar component with Mastra streaming"
```

---

## Task 3: Wire `AIPromptBar` into `EditorLayout`

**Files:**
- Modify: `apps/canvas-v2/src/components/EditorLayout.tsx`
- Modify: `apps/canvas-v2/src/components/FunnelBuilder.tsx`

The `AIPromptBar` needs `pageId` and `tenantId`. `EditorLayout` currently receives `tenantId` but not `pageId`. We'll pass `pageId` through.

**Step 1: Add `pageId` prop to `EditorLayout`**

In `apps/canvas-v2/src/components/EditorLayout.tsx`, make these changes:

1. Add `pageId?: string` to the `EditorLayoutProps` interface (after `tenantId?: string`):

```typescript
interface EditorLayoutProps {
  // ... existing props ...
  tenantId?: string;
  pageId?: string;    // ADD THIS
}
```

2. Destructure it in the function signature:

```typescript
export const EditorLayout: React.FC<EditorLayoutProps> = ({
  // ... existing destructures ...
  tenantId,
  pageId,             // ADD THIS
}) => {
```

3. Add the `AIPromptBar` import at the top of the file:

```typescript
import { AIPromptBar } from "./AIPromptBar";
```

4. Inside the `<main>` element, add `<AIPromptBar>` as the first child (before the existing `viewMode === "editor"` block and before `<Canvas>`):

```typescript
<main className="flex-1 relative bg-gray-100 flex flex-col items-center justify-start overflow-hidden transition-all">
  {/* AI Prompt Bar — always visible above canvas */}
  <div className="w-full flex-shrink-0">
    <AIPromptBar pageId={pageId} tenantId={tenantId} />
  </div>

  {viewMode === "editor" && (
    // ... existing top-4 right-4 absolute div ...
  )}
  <Canvas isAnalyzing={isAnalyzing} followAiScroll={followAiScroll} />
  // ... rest unchanged ...
```

**Step 2: Pass `pageId` from `FunnelBuilder` to `EditorLayout`**

In `apps/canvas-v2/src/components/FunnelBuilder.tsx`, find the `<EditorLayout>` JSX (around line 187) and add `pageId={pageId}`:

```typescript
<EditorLayout
  showAiPrompt={showAiPrompt}
  setShowAiPrompt={setShowAiPrompt}
  aiPrompt={aiPrompt}
  setAiPrompt={setAiPrompt}
  isAnalyzing={isAnalyzing}
  followAiScroll={followAiScroll}
  handleAiOptimization={handleAiOptimization}
  selectedImage={selectedImage}
  setSelectedImage={setSelectedImage}
  generateSpecificComponent={generateSpecificComponent}
  tenantId={tenantId}
  pageId={pageId}    // ADD THIS
/>
```

**Step 3: Run the dev server and verify manually**

```bash
cd apps/canvas-v2 && npm run dev
```

Open `http://localhost:3000/editor/<pageId>`. You should see:
- A slim bar above the canvas with a sparkles icon, text input, and send button
- Typing a prompt and pressing Enter (or clicking Send) streams a response from Mastra
- Canvas changes (if Mastra makes edits) appear live
- `AIStatusBar` at the bottom shows the `ai_operation` STDB progress

**Step 4: Run all tests to confirm nothing broke**

```bash
cd apps/canvas-v2 && npx vitest run
```

Expected: All existing tests pass (68+) plus 4 new `useAIPrompt` tests = 72+ total

**Step 5: Commit**

```bash
git add apps/canvas-v2/src/components/EditorLayout.tsx apps/canvas-v2/src/components/FunnelBuilder.tsx
git commit -m "feat: wire AIPromptBar into EditorLayout above canvas"
```
