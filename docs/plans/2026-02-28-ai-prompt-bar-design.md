# AI Prompt Bar — Design Document

**Date:** 2026-02-28
**Status:** Approved

---

## Goal

Add a persistent, always-visible AI input bar to the canvas-v2 editor that sends prompts directly to the Mastra backend AI (Claude Sonnet 4.6 with 16 STDB tools), with streaming response display and live canvas updates via SpacetimeDB.

## Problem

The existing `AgentChat.tsx` is a floating bottom-right panel requiring a click to discover. It uses client-side Gemini/OpenRouter MCP executors, not the canvas-backend Mastra AI. Users need a more prominent, dedicated input for the Mastra AI that edits the live STDB canvas directly.

## Architecture

### Data Flow

```
User types prompt in AIPromptBar
  → POST /api/funnel-agent (Next.js proxy)
    → POST canvas-backend /api/ai/canvas
      → Mastra agent (Claude Sonnet 4.6) receives prompt
        → Calls STDB tools: insert_node, update_node_styles, etc.
          → STDB broadcasts changes to all subscribers
            → canvas-v2 useTable(canvas_node) picks up changes
              → Canvas re-renders with AI edits live
      → Streams text response back through proxy
  → AIPromptBar renders streaming text
  → AIStatusBar (bottom) shows ai_operation progress from STDB
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AIPromptBar` | `src/components/AIPromptBar.tsx` | Input + streaming response display |
| `useAIPrompt` | `src/hooks/useAIPrompt.ts` | SSE streaming hook for Mastra |
| `EditorLayout` | (modified) | Renders `<AIPromptBar>` above the canvas |

## UI Design

```
┌──────────────────────────────────────────────────────────────────┐
│  ✦  Ask AI to edit this page...               [→ Send]  [✕]      │
└──────────────────────────────────────────────────────────────────┘
   ↓ while streaming:
┌──────────────────────────────────────────────────────────────────┐
│  ✦  I'll add a hero section with a purple gradient background... │
│     (spinner while active)                                       │
└──────────────────────────────────────────────────────────────────┘
```

- Placed above the canvas in `EditorLayout`, full width
- Input field with placeholder "Ask AI to edit this page..."
- Send button (disabled while streaming)
- Response shown in a collapsible area directly below the input
- Clears automatically when a new prompt is submitted
- Passes `pageId`, `tenantId`, and `selectedNodeId` to Mastra

## Key Design Decisions

1. **No conversation history** — single prompt, single response, clears on next send. Full history remains available in `AgentChat`
2. **Mastra backend only** — no Gemini/OpenRouter, no client-side MCP executors; Mastra has the 16 real STDB tools
3. **`selected_node_id` context** — passes currently selected element ID so Mastra can operate on what the user has selected
4. **Streaming text** — SSE stream from Mastra is rendered token by token
5. **No duplicate with AgentChat** — `AgentChat` remains for multi-turn conversation; `AIPromptBar` is for quick, single commands
