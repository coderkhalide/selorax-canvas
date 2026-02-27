// @selorax/types — Shared TypeScript interfaces

export interface Tenant {
  id:     string;   // "store_001"
  name:   string;   // "My Store"
  domain: string;   // "mystore.selorax.com"
  plan:   string;   // "starter" | "pro" | "enterprise"
}

export type CanvasNodeType = 'layout' | 'element' | 'component' | 'slot';

export interface FlatNode {
  id:                string;
  page_id:           string;
  tenant_id:         string;
  node_type:         CanvasNodeType;
  parent_id:         string | null;
  order:             string;
  styles:            string;  // JSON
  props:             string;  // JSON
  settings:          string;  // JSON
  children_ids:      string;  // JSON string[]
  component_url?:    string | null;
  component_id?:     string | null;
  component_version?: string | null;
  locked_by?:        string | null;
  locked_at?:        bigint | null;
  updated_by:        string;
  updated_at:        bigint;
}

export interface TreeNode {
  id:               string;
  type:             CanvasNodeType;
  styles:           Record<string, any>;
  props:            Record<string, any>;
  settings:         Record<string, any>;
  children:         TreeNode[];
  url?:             string;
  componentId?:     string;
  componentVersion?: string;
}

export interface PageTree {
  root:     TreeNode;
  pageId:   string;
  tenantId: string;
}

export interface ResponsiveStyles {
  [key: string]: any;
  _sm?:    Record<string, any>;  // mobile
  _md?:    Record<string, any>;  // tablet
  _lg?:    Record<string, any>;  // desktop
  _hover?: Record<string, any>;
  _focus?: Record<string, any>;
  _active?: Record<string, any>;
}

export interface ElementProps {
  tag?:     string;   // 'text' | 'heading' | 'image' | 'button' | 'divider'
  content?: string;
  level?:   string;   // 'h1' | 'h2' | 'h3'
  src?:     string;
  alt?:     string;
  label?:   string;
  action?:  { type: string; url?: string };
}

export interface ComponentSettings {
  [key: string]: any;
}
