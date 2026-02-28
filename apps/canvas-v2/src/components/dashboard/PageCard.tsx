"use client";
import { FileText, Globe, ChevronRight } from "lucide-react";
import { Page } from "../../hooks/usePages";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  landing_page: "Landing Page",
  product_template: "Product Template",
  collection: "Collection",
  funnel_step: "Funnel Step",
};

const TYPE_COLORS: Record<string, string> = {
  landing_page: "bg-blue-100 text-blue-700",
  product_template: "bg-green-100 text-green-700",
  collection: "bg-purple-100 text-purple-700",
  funnel_step: "bg-orange-100 text-orange-700",
};

export function PageCard({ page }: { page: Page }) {
  const label = TYPE_LABELS[page.type] ?? page.type;
  const color = TYPE_COLORS[page.type] ?? "bg-gray-100 text-gray-700";
  const edited = new Date(page.updatedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <Link
      href={`/editor/${page.id}`}
      className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition-all flex flex-col gap-3"
    >
      <div className="w-full h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center border border-gray-100">
        <FileText className="w-8 h-8 text-gray-300" />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate text-sm leading-tight">
            {page.title || page.slug}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{edited}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0 mt-0.5 transition-colors" />
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
          {label}
        </span>
        {page.publishedVersionId && (
          <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
            <Globe className="w-3 h-3" /> Live
          </span>
        )}
      </div>
    </Link>
  );
}
