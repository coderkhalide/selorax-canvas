"use client";
import { useState } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import { usePages } from "../../hooks/usePages";
import { PageCard } from "./PageCard";
import { NewPageModal } from "./NewPageModal";
import { useRouter } from "next/navigation";

export function PagesGrid({ tenantId }: { tenantId: string }) {
  const { pages, loading, error, createPage } = usePages(tenantId);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  const filtered = pages.filter((p) =>
    (p.title ?? p.slug).toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (title: string, type: string) => {
    const page = await createPage(title, type);
    if (page) router.push(`/editor/${page.id}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages..."
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New Page
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}
      {error && <div className="text-center py-20 text-red-500 text-sm">{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm mb-4">No pages yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Create your first page
          </button>
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((page) => (
            <PageCard key={page.id} page={page} />
          ))}
        </div>
      )}

      {showModal && (
        <NewPageModal onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
