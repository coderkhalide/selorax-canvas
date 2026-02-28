import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { FunnelElement, ColorScheme, ProjectData } from "../types";

interface SimpleFunnelContextType {
  elements: FunnelElement[];
  deviceView: "desktop" | "tablet" | "mobile";
  currentSchemeId: string;
  schemes: Record<string, ColorScheme>;
  globalCss: string;
}

const PublicFunnelContext = createContext<SimpleFunnelContextType | undefined>(
  undefined
);

export const useFunnel = () => {
  const context = useContext(PublicFunnelContext);
  if (!context)
    throw new Error("useFunnel must be used within a FunnelProvider");
  return context;
};

export const FunnelProvider: React.FC<{
  initialData: ProjectData;
  children: ReactNode;
}> = ({ initialData, children }) => {
  const [deviceView, setDeviceView] = useState<"desktop" | "tablet" | "mobile">("desktop");

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

  // ২. থিম ভেরিয়েবল সেট করা (Applying Theme CSS Variables)
  useEffect(() => {
    const currentSchemeId = initialData.theme?.currentSchemeId || "default";
    const schemes = initialData.theme?.schemes || {};
    const scheme = schemes[currentSchemeId];

    if (scheme) {
      const root = document.documentElement;
      Object.entries(scheme.settings).forEach(([key, value]) => {
        const cssVarName = `--color-${key.replace(/_/g, "-")}`;
        root.style.setProperty(cssVarName, value as string);
      });
    }
  }, [initialData]);

  const value: SimpleFunnelContextType = {
    elements: initialData.elements || [],
    deviceView,
    currentSchemeId: initialData.theme?.currentSchemeId || "default",
    schemes: initialData.theme?.schemes || {},
    globalCss: initialData.globalCss || "",
  };

  return (
    <PublicFunnelContext.Provider value={value}>
      {/* গ্লোবাল সিএসএস প্রয়োগ করা */}
      <style
        dangerouslySetInnerHTML={{ __html: initialData.globalCss || "" }}
      />
      {children}
    </PublicFunnelContext.Provider>
  );
};
