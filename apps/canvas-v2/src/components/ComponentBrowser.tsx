"use client";
import { useState } from "react";
import { Search, Loader2, Package } from "lucide-react";
import { useComponents, RemoteComponent } from "../hooks/useComponents";
import { useFunnel } from "../context/FunnelContext";

interface Props {
  tenantId: string;
}

export function ComponentBrowser({ tenantId }: Props) {
  const { components, loading, error } = useComponents(tenantId);
  const { setDraggingType } = useFunnel();
  const [search, setSearch] = useState("");

  const filtered = components.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  const byCategory = filtered.reduce<Record<string, RemoteComponent[]>>(
    (acc, c) => {
      (acc[c.category] ??= []).push(c);
      return acc;
    },
    {}
  );

  const handleDragStart = (
    e: React.DragEvent,
    component: RemoteComponent
  ) => {
    if (!component.componentUrl) { e.preventDefault(); return; }
    e.dataTransfer.setData("elementType", "custom");
    e.dataTransfer.setData("layoutPreset", component.id);
    e.dataTransfer.setData(
      "variantData",
      JSON.stringify({
        componentUrl: component.componentUrl,
        name: component.name,
      })
    );
    e.dataTransfer.effectAllowed = "copy";
    setDraggingType("custom");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-4 text-center text-xs text-red-500">{error}</div>
    );
  }

  if (components.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-gray-400">
        No components in registry yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative px-2">
        <Search className="w-3.5 h-3.5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search components..."
          className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category}>
          <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {category}
          </p>
          <div className="flex flex-col gap-0.5">
            {items.map((component) => (
              <div
                key={component.id}
                draggable={!!component.componentUrl}
                onDragStart={(e) => handleDragStart(e, component)}
                onDragEnd={() => setDraggingType(null)}
                title={component.componentUrl ? undefined : "Not compiled yet — build this component to use it"}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg group ${
                  component.componentUrl
                    ? "hover:bg-gray-50 cursor-grab active:cursor-grabbing"
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                {component.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={component.thumbnailUrl}
                    alt={component.name}
                    className="w-8 h-8 rounded object-cover border border-gray-100"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-gray-700 font-medium group-hover:text-gray-900 truncate">
                    {component.name}
                  </span>
                  {component.isGlobal && (
                    <span className="text-[9px] text-gray-400 font-medium uppercase tracking-wider">Global</span>
                  )}
                  {!component.componentUrl && (
                    <span className="text-[9px] text-amber-500 font-medium">Not built</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
