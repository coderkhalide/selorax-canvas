# Funnel Builder MCP Server

A remote MCP (Model Context Protocol) server for the Funnel Builder app. Connect from anywhere using just a URL.

## Quick Start

Once your app is deployed, anyone can connect to your MCP server:

**Claude Desktop / Claude Code Configuration:**
```json
{
  "mcpServers": {
    "funnel-builder": {
      "type": "streamable-http",
      "url": "https://your-domain.com/api/mcp"
    }
  }
}
```

That's it! No local installation required.

**For local development:**
```json
{
  "mcpServers": {
    "funnel-builder": {
      "type": "streamable-http",
      "url": "http://localhost:3001/api/mcp"
    }
  }
}
```

---

## How It Works

The MCP server uses **Streamable HTTP** transport - the modern standard for remote MCP servers.

**Features:**
- No local setup required
- Works from anywhere with internet
- Full CORS support for cross-origin requests
- Session management via headers
- SSE stream for real-time notifications

---

## API Reference

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mcp` | POST | JSON-RPC 2.0 messages |
| `/api/mcp` | GET | Server info + connection config |
| `/api/mcp?health=true` | GET | Health check |
| `/api/mcp?stream=true` | GET | SSE notifications |

### JSON-RPC Methods

| Method | Description |
|--------|-------------|
| `initialize` | Initialize connection, get capabilities |
| `initialized` | Client acknowledgment |
| `ping` | Health check |
| `tools/list` | List available tools |
| `tools/call` | Execute a tool |
| `resources/list` | List available resources |
| `resources/read` | Read a resource |

### Request Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "setHeadline",
    "arguments": {
      "text": "Hello World!"
    }
  }
}
```

### Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Headline updated"
      }
    ]
  }
}
```

---

## Available Tools

| Tool | Description |
|------|-------------|
| `checkConnection` | Check if the app is running |
| `getElementTypes` | List available element types |
| `setElements` | Replace all page elements |
| `addElement` | Add a single element |
| `updateElement` | Update element by ID |
| `deleteElement` | Delete element by ID |
| `changeTheme` | Change color theme |
| `setHeadline` | Update headline text |
| `setButtonText` | Update button text |
| `setImageUrl` | Update image URL |
| `generatePage` | Generate complete page |
| `getCurrentElements` | Get current page structure |
| `findElement` | Search for elements |
| `getSelectedElement` | Get selected element |
| `getParentSection` | Get parent section |
| `getDesignSystem` | Get theme/design system |
| `getCapabilities` | Get available components |
| `verifyElement` | Verify element exists |
| `screenshotElement` | Capture element screenshot |
| `aiActivityStart` | Show AI working indicator |
| `aiActivityEnd` | Remove AI indicator |

---

## Testing

### Health Check
```bash
curl https://your-domain.com/api/mcp?health=true
```

### Initialize Connection
```bash
curl -X POST https://your-domain.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
```

### List Tools
```bash
curl -X POST https://your-domain.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

### Call a Tool
```bash
curl -X POST https://your-domain.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "setHeadline",
      "arguments": { "text": "Hello from MCP!" }
    }
  }'
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Client                               │
│       (Claude Desktop, Claude Code, Custom App, etc.)        │
│                                                              │
│                          ↓ HTTP POST (JSON-RPC)              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│              /api/mcp (Next.js API Route)                    │
│              Remote MCP Server (Streamable HTTP)             │
│                                                              │
│                          ↓ Redis Queue                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│              Browser (React App)                             │
│              useMCPCommandListener hook                      │
│              Executes commands, updates UI                   │
│                                                              │
│                          ↓ Redis Response                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│              /api/mcp returns JSON-RPC response              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Examples

### TypeScript/JavaScript

```typescript
async function callMCPTool(url: string, toolName: string, args: any) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    })
  });

  const result = await response.json();
  return result.result?.content?.[0]?.text;
}

// Example usage
const result = await callMCPTool(
  'https://your-app.com/api/mcp',
  'generatePage',
  {
    elements: [
      {
        id: 'hero-1',
        type: 'section',
        name: 'Hero Section',
        style: { padding: '80px 20px' },
        children: [
          {
            id: 'headline-1',
            type: 'headline',
            name: 'Main Headline',
            content: 'Welcome to Our Product',
            style: { fontSize: '48px', fontWeight: 'bold' }
          }
        ]
      }
    ],
    themeColor: '#3B82F6'
  }
);
```

### Python

```python
import requests

def call_mcp_tool(url: str, tool_name: str, args: dict):
    response = requests.post(url, json={
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": args
        }
    })
    return response.json()

# Example
result = call_mcp_tool(
    "https://your-app.com/api/mcp",
    "setHeadline",
    {"text": "Hello from Python!"}
)
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | (required) | Redis connection URL |

---

## Files

| File | Description |
|------|-------------|
| `src/mcp/tools.ts` | Shared tool definitions |
| `src/app/api/mcp/route.ts` | HTTP MCP server |
| `src/app/api/mcp-commands/route.ts` | Command queue |
| `src/app/api/mcp-responses/route.ts` | Response store |
| `src/hooks/useMCPCommandListener.ts` | Browser executor |

---

## Troubleshooting

### "Browser not connected"
- Make sure the web app is open in a browser
- The browser polls for commands every 500ms
- Check that Redis is running

### Commands timing out
- Check Redis connection
- Verify browser tab is active (not minimized)

### CORS errors
- The server has permissive CORS headers (`*`)
- If issues persist, check your deployment's CORS settings

---

## Deployment Checklist

1. **Redis**: Ensure Redis is available (Upstash, Railway, etc.)
2. **Environment**: Set `REDIS_URL` in your deployment
3. **Health**: Test `/api/mcp?health=true` returns OK
4. **Tools**: Test `tools/list` returns all tools

---

## License

MIT
