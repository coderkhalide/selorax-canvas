import React from "react";
import * as Icons from "lucide-react";
import { extractFirstColor } from "./styleUtils";

export const DynamicIcon = ({ name, className, size = 24, color, ...props }) => {
  const IconCmp = Icons[name] || Icons.HelpCircle;
  const style = color?.includes("gradient")
    ? { color: extractFirstColor(color) } // Fallback to first color for SVG icons
    : { color };

  return <IconCmp className={className} size={size} style={style} {...props} />;
};
