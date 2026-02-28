// MCP Types for Funnel Builder
import { FunnelElement, ColorScheme, ThemeSettings } from "../types";

// Tool argument types
export interface GetCapabilitiesArgs {
  reason?: string;
}

export interface GetDesignSystemArgs {
  reason?: string;
}

export interface FindElementArgs {
  type?: string;
  text?: string;
}

export interface EditElementByIdArgs {
  id: string;
  instruction: string;
}

export interface EditElementArgs {
  instruction: string;
}

export interface UpdateLayoutArgs {
  instruction: string;
}

export interface GenerateLandingPageArgs {
  content: string;
  color?: string;
}

export interface UpdateCopyArgs {
  prompt: string;
  context?: string;
}

export interface ThinkArgs {
  thought: string;
}

// Tool result types
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

// MCP Resource types
export interface ComponentResource {
  key: string;
  name: string;
  category: string;
  settings: string[];
}

export interface ElementResource {
  id: string;
  type: string;
  name: string;
  content?: string;
  childCount?: number;
}

export interface ThemeResource {
  id: string;
  name: string;
  settings: ThemeSettings;
}

// MCP Server State (for HTTP transport)
export interface MCPServerState {
  elements: FunnelElement[];
  selectedElementId: string | null;
  currentSchemeId: string | null;
  schemes: Record<string, ColorScheme>;
}

// MCP Tool definitions for schema
export const MCP_TOOL_NAMES = [
  "getCapabilities",
  "getDesignSystem",
  "findElement",
  "editElementById",
  "editElement",
  "updateLayout",
  "generateLandingPage",
  "updateCopy",
  "think",
] as const;

export type MCPToolName = (typeof MCP_TOOL_NAMES)[number];

// MCP Resource URIs
export const MCP_RESOURCE_URIS = {
  components: "funnel://components",
  elements: "funnel://elements",
  theme: "funnel://theme",
  selected: "funnel://selected",
  schemas: "funnel://schemas",
} as const;
