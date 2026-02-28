import React2 from "react";

import { useEffect, useRef } from "react";
import { jsx } from "react/jsx-runtime";
var CustomHtmlComponent = ({ element, isPreview }) => {
  const { html = "" } = element.data || {};
  const containerRef = useRef(null);
  useEffect(() => {
    if (!document.querySelector('script[src="https://cdn.tailwindcss.com"]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
    if (!containerRef.current || !html) return;
    const scripts = containerRef.current.querySelectorAll("script");
    scripts.forEach((script) => {
      if (script.src && document.querySelector(`script[src="${script.src}"]`)) {
        return;
      }
      const newScript = document.createElement("script");
      Array.from(script.attributes).forEach(
        (attr) => newScript.setAttribute(attr.name, attr.value)
      );
      newScript.appendChild(document.createTextNode(script.innerHTML));
      document.body.appendChild(newScript);
    });
  }, [html]);
  if (!html) {
    return /* @__PURE__ */ jsx("div", { className: "p-4 border border-dashed border-gray-300 rounded text-center text-gray-400 text-sm", children: "Custom HTML Block (Empty)" });
  }
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref: containerRef,
      className: element.className,
      style: element.style,
      dangerouslySetInnerHTML: { __html: html }
    }
  );
};

function htmlRender({ data, style, className }) {
  const fakeElement = {
    id: "__render__",
    type: "custom",
    name: "html",
    style: style ?? {},
    className: className ?? "",
    data: data ?? {}
  };
  return React2.createElement(CustomHtmlComponent, {
    element: fakeElement,
    isPreview: true
  });
}
export {
  htmlRender as default
};
