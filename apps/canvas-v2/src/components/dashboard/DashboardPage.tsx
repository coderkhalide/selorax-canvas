"use client";
import { useState } from "react";
import { LayoutGrid, GitMerge } from "lucide-react";
import { PagesGrid } from "./PagesGrid";
import { FunnelsList } from "./FunnelsList";
import Image from "next/image";

type Tab = "pages" | "funnels";

export function DashboardPage({ tenantId }: { tenantId: string }) {
  const [tab, setTab] = useState<Tab>("pages");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
            <span className="font-bold text-white text-sm">S</span>
          </div>
          <Image width={400} height={200} src="/selorax.png" alt="SeloraX" className="w-36 h-7" />
        </div>
        <div className="text-xs text-gray-400 font-mono">
          tenant: {tenantId}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your pages and conversion funnels</p>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-8">
          <button
            onClick={() => setTab("pages")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "pages"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Pages
          </button>
          <button
            onClick={() => setTab("funnels")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "funnels"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <GitMerge className="w-4 h-4" /> Funnels
          </button>
        </div>

        {tab === "pages" && <PagesGrid tenantId={tenantId} />}
        {tab === "funnels" && <FunnelsList tenantId={tenantId} />}
      </main>
    </div>
  );
}
