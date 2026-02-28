"use client";

import { FunnelProvider } from "@/context/FunnelContext";
import { AIActivityProvider } from "@/context/AIActivityContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FunnelProvider>
      <AIActivityProvider>{children}</AIActivityProvider>
    </FunnelProvider>
  );
}
