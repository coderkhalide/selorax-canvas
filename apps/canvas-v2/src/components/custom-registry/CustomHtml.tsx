import React, { useEffect, useRef } from "react";
import { CustomComponentDef, FunnelElement } from "../../types";
import { Code } from "lucide-react";

export const CustomHtmlComponent: React.FC<{
  element: FunnelElement;
  isPreview?: boolean;
}> = ({ element, isPreview }) => {
  const { html = "" } = element.data || {};
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Auto-inject Tailwind CSS if not present
    if (!document.querySelector('script[src="https://cdn.tailwindcss.com"]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }

    if (!containerRef.current || !html) return;

    // 2. Handle other user-defined scripts
    const scripts = containerRef.current.querySelectorAll("script");

    scripts.forEach((script) => {
      // Check if this script is already loaded globally
      if (script.src && document.querySelector(`script[src="${script.src}"]`)) {
        return;
      }

      const newScript = document.createElement("script");
      Array.from(script.attributes).forEach((attr) =>
        newScript.setAttribute(attr.name, attr.value),
      );
      newScript.appendChild(document.createTextNode(script.innerHTML));

      document.body.appendChild(newScript);
    });
  }, [html]);

  if (!html) {
    return (
      <div className="p-4 border border-dashed border-gray-300 rounded text-center text-gray-400 text-sm">
        Custom HTML Block (Empty)
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={element.className}
      style={element.style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export const CustomHtmlDef: CustomComponentDef = {
  name: "Custom HTML",
  icon: <Code className="w-4 h-4" />,
  category: "Basic",
  component: CustomHtmlComponent,
  defaultData: {
    html: `<div class="w-full p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
  <div class="flex flex-col md:flex-row items-center justify-between gap-6">
    <div class="space-y-3 text-center md:text-left">
      <h3 class="text-2xl font-bold text-gray-900">Start Building Today</h3>
      <p class="text-gray-500 max-w-lg text-base">
        This is a simple, full-width card component. It's fully responsive, clean, and ready for your content. Use Tailwind CSS to customize it further.
      </p>
    </div>
    <button class="px-8 py-3 bg-black text-white font-medium rounded-xl hover:bg-gray-800 transition-all transform active:scale-95 shadow-lg">
      Get Started
    </button>
  </div>
</div>`,
  },
  settings: {
    html: {
      type: "code",
      label: "Code Editor (⚡ Tailwind Enabled)",
      placeholder:
        "Enter raw HTML code. Tailwind CSS is enabled automatically.",
      default: "",
    },
  },
};
