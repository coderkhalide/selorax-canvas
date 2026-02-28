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
  const genRef = useRef(0);

  const sendPrompt = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;

      // Abort any in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      // Generation counter — used to ignore state updates from superseded calls
      const gen = ++genRef.current;

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

        try {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? ""; // keep incomplete last line for next chunk

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  setResponse((prev) => prev + data.content);
                }
              } catch {
                // ignore non-JSON data lines
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        if (gen === genRef.current) setError(err.message ?? "Unknown error");
      } finally {
        if (gen === genRef.current) setIsStreaming(false);
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
