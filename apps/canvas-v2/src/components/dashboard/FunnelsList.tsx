"use client";
import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { useFunnels } from "../../hooks/useFunnels";
import { FunnelRow } from "./FunnelRow";
import { NewFunnelModal } from "./NewFunnelModal";

export function FunnelsList({ tenantId }: { tenantId: string }) {
  const { funnels, loading, error, createFunnel, addStep } = useFunnels(tenantId);
  const [showModal, setShowModal] = useState(false);

  const handleAddStep = async (funnelId: string, title: string, pageType: string) => {
    await addStep(funnelId, title, pageType);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">{funnels.length} funnel{funnels.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New Funnel
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}
      {error && <div className="text-center py-20 text-red-500 text-sm">{error}</div>}
      {!loading && !error && funnels.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm mb-4">No funnels yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Create your first funnel
          </button>
        </div>
      )}
      {!loading && funnels.length > 0 && (
        <div className="flex flex-col gap-3">
          {funnels.map((funnel) => (
            <FunnelRow key={funnel.id} funnel={funnel} onAddStep={handleAddStep} />
          ))}
        </div>
      )}

      {showModal && (
        <NewFunnelModal
          onClose={() => setShowModal(false)}
          onCreate={createFunnel}
        />
      )}
    </div>
  );
}
