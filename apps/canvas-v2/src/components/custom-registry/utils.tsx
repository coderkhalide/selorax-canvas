import React from "react";
import * as Icons from "lucide-react";
import { extractFirstColor } from "../styleUtils";

export const DynamicIcon: React.FC<{
  name: string;
  className?: string;
  size?: number;
  color?: string;
  [key: string]: any; // Allow other props
}> = ({ name, className, size = 24, color, ...props }) => {
  const IconCmp = (Icons as any)[name] || Icons.HelpCircle;
  const style = color?.includes("gradient")
    ? { color: extractFirstColor(color) } // Fallback to first color for SVG icons
    : { color };

  return <IconCmp className={className} size={size} style={style} {...props} />;
};
