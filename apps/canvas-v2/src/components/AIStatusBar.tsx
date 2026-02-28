"use client";

import { useTable } from "spacetimedb/react";
import { tables } from "../module_bindings";
import { useMemo } from "react";
import { Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";

interface Props {
  pageId: string;
  tenantId: string;
}

export function AIStatusBar({ pageId, tenantId }: Props) {
  // useTable returns [rows] — rows is readonly[]
  const [allOps] = useTable(tables.ai_operation);

  // Most recent active operation for this page/tenant
  const activeOp = useMemo(() => {
    const pageOps = (allOps as any[]).filter(
      (op) =>
        op.pageId === pageId &&
        op.tenantId === tenantId &&
        op.status !== "completed" &&
        op.status !== "error"
    );
    // Sort by startedAt descending (u64 BigInt — compare as numbers)
    return (
      pageOps.sort(
        (a: any, b: any) =>
          Number(b.startedAt ?? 0) - Number(a.startedAt ?? 0)
      )[0] ?? null
    );
  }, [allOps, pageId, tenantId]);

  // Most recently finished op within the last 5 seconds
  const recentFinished = useMemo(() => {
    const nowMs = Date.now();
    const finished = (allOps as any[]).filter(
      (op) =>
        op.pageId === pageId &&
        op.tenantId === tenantId &&
        (op.status === "completed" || op.status === "error") &&
        op.completedAt != null &&
        // completedAt is a STDB u64 — stored as microseconds, compare to ms
        Number(op.completedAt) / 1000 > nowMs - 5000
    );
    return finished.sort(
      (a: any, b: any) => Number(b.completedAt ?? 0) - Number(a.completedAt ?? 0)
    )[0] ?? null;
  }, [allOps, pageId, tenantId]);

  const op = activeOp ?? recentFinished;
  if (!op) return null;

  const isActive = op.status !== "completed" && op.status !== "error";
  const isComplete = op.status === "completed";
  const isFailed = op.status === "error";

  const displayMessage: string =
    op.currentAction || "AI is working...";
  const progress: number =
    typeof op.progress === "number"
      ? op.progress
      : typeof op.progress === "bigint"
      ? Number(op.progress)
      : 0;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 text-sm border-t transition-all ${
        isActive
          ? "bg-blue-50 border-blue-200 text-blue-700"
          : isComplete
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-red-50 border-red-200 text-red-700"
      }`}
    >
      {isActive && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
      {isComplete && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
      {isFailed && <XCircle className="w-4 h-4 flex-shrink-0" />}
      <Sparkles className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
      <span className="flex-1 truncate">{displayMessage}</span>
      {isActive && progress > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-mono tabular-nums">{progress}%</span>
        </div>
      )}
    </div>
  );
}
