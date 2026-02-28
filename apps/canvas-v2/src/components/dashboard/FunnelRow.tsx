"use client";
import { useState } from "react";
import { ChevronRight, Plus, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Funnel, FunnelStep } from "../../hooks/useFunnels";
import Link from "next/link";

interface Props {
  funnel: Funnel;
  onAddStep: (funnelId: string, title: string, pageType: string) => Promise<void>;
}

export function FunnelRow({ funnel, onAddStep }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const [stepTitle, setStepTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const steps: FunnelStep[] = funnel.steps ?? [];

  const handleAddStep = async () => {
    if (!stepTitle.trim()) return;
    setLoading(true);
    await onAddStep(funnel.id, stepTitle.trim(), "funnel_step");
    setLoading(false);
    setStepTitle("");
    setShowAddStep(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-xs font-bold text-blue-600">F</span>
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">{funnel.name}</p>
            <p className="text-xs text-gray-400">{steps.length} step{steps.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          {steps.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {steps
                .sort((a, b) => a.order - b.order)
                .map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <Link
                      href={`/editor/${step.pageId}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-medium text-blue-700 transition-colors"
                    >
                      <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-700">
                        {idx + 1}
                      </span>
                      {step.title ?? step.page?.title ?? step.page?.slug ?? "Untitled"}
                    </Link>
                    {idx < steps.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    )}
                  </div>
                ))}
              <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
              <div className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs text-green-600 font-medium">Done</span>
              </div>
            </div>
          )}
          {steps.length === 0 && (
            <p className="text-sm text-gray-400 mb-4">No steps yet. Add your first step.</p>
          )}

          {showAddStep ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={stepTitle}
                onChange={(e) => setStepTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddStep()}
                placeholder="Step name (e.g. Landing, Checkout, Upsell)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddStep}
                disabled={!stepTitle.trim() || loading}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
              </button>
              <button
                onClick={() => { setShowAddStep(false); setStepTitle(""); }}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddStep(true)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-4 h-4" /> Add Step
            </button>
          )}
        </div>
      )}
    </div>
  );
}
