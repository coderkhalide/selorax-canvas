import type { NextRequest } from "next/server";

// Force dynamic to prevent caching of the streaming response
export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId =
      req.headers.get("x-tenant-id") ?? body.tenantId ?? "store_001";

    // Extract the last user message as the prompt for the Mastra backend.
    // The hook sends { messages: [...], model, apiKey, tools, pageId, tenantId }.
    const messages: Array<{ role: string; content: any }> = body.messages ?? [];
    const lastUserMsg = [...messages]
      .reverse()
      .find((m) => m.role === "user");

    let prompt = "";
    if (lastUserMsg) {
      const content = lastUserMsg.content;
      if (typeof content === "string") {
        prompt = content;
      } else if (Array.isArray(content)) {
        // Multimodal content — join text parts
        prompt = content
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text ?? "")
          .join(" ");
      }
    }

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "No user message found in request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const pageId: string | undefined = body.pageId;
    if (!pageId) {
      return new Response(
        JSON.stringify({ error: "pageId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const selectedNodeId: string | undefined = body.selected_node_id;

    const upstream = await fetch(`${BACKEND_URL}/api/ai/canvas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId,
      },
      body: JSON.stringify({
        prompt,
        page_id: pageId,
        tenant_id: tenantId,
        ...(selectedNodeId ? { selected_node_id: selectedNodeId } : {}),
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      return new Response(JSON.stringify({ error: err }), {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!upstream.body) {
      return new Response(JSON.stringify({ error: "No response body" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // The Mastra backend streams plain text chunks.
    // Re-encode as SSE data: {"content":"..."}\n\n so the hook's SSE parser works.
    const upstreamBody = upstream.body;
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstreamBody.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            if (text) {
              const sseChunk = `data: ${JSON.stringify({ content: text })}\n\n`;
              controller.enqueue(new TextEncoder().encode(sseChunk));
            }
          }
          controller.close();
        } catch (err) {
          console.error("[funnel-agent proxy] Streaming error:", err);
          reader.cancel().catch(() => {});
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    console.error("[funnel-agent proxy] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message ?? "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
