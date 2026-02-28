import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";

const PublicFunnelContext = createContext(undefined);

export const useFunnel = () => {
  const context = useContext(PublicFunnelContext);
  if (!context)
    throw new Error("useFunnel must be used within a FunnelProvider");
  return context;
};

// Generate CSS variables string from theme settings
const generateThemeCss = (initialData) => {
  const currentSchemeId = initialData?.theme?.currentSchemeId || "default";
  const schemes = initialData?.theme?.schemes || {};
  const scheme = schemes[currentSchemeId];

  if (!scheme?.settings) return "";

  const cssVars = Object.entries(scheme.settings)
    .map(([key, value]) => `--color-${key.replace(/_/g, "-")}: ${value};`)
    .join("\n  ");

  return `:root {\n  ${cssVars}\n}`;
};

export const FunnelProvider = ({
  initialData,
  product,
  skus,
  store,
  useNewVariantUI,
  variantData,
  data: {},
  children,
}) => {
  const [deviceView, setDeviceView] = useState("desktop");
  const checkoutRef = useRef(null);

  // Generate theme CSS synchronously (available on first render & SSR)
  const themeCss = useMemo(() => generateThemeCss(initialData), [initialData]);

  // ১. স্ক্রিন সাইজ পর্যবেক্ষণ (Screen Size Detection)
  useEffect(() => {
    const checkSize = () => {
      const w = window.innerWidth;
      if (w < 768) setDeviceView("mobile");
      else if (w < 1024) setDeviceView("tablet");
      else setDeviceView("desktop");
    };
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  // ২. থিম ভেরিয়েবল সেট করা (Applying Theme CSS Variables to document for runtime updates)
  useEffect(() => {
    const currentSchemeId = initialData?.theme?.currentSchemeId || "default";
    const schemes = initialData?.theme?.schemes || {};
    const scheme = schemes[currentSchemeId];

    if (scheme?.settings) {
      const root = document.documentElement;
      Object.entries(scheme.settings).forEach(([key, value]) => {
        const cssVarName = `--color-${key.replace(/_/g, "-")}`;
        root.style.setProperty(cssVarName, value);
      });
    }
  }, [initialData]);

  const value = {
    elements: initialData?.elements || [],
    deviceView,
    currentSchemeId: initialData?.theme?.currentSchemeId || "default",
    schemes: initialData?.theme?.schemes || {},
    globalCss: initialData?.globalCss || "",
    product,
    skus,
    store,
    checkoutRef,
    useNewVariantUI,
    variantData,
  };

  return (
    <PublicFunnelContext.Provider value={value}>
      {/* Theme CSS variables - injected synchronously for SSR compatibility */}
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      {/* Global CSS from project data */}
      <style
        dangerouslySetInnerHTML={{ __html: initialData?.globalCss || "" }}
      />
      {children}
    </PublicFunnelContext.Provider>
  );
};
