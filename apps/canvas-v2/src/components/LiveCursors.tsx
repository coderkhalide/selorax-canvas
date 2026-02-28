"use client";
import { useTable } from "spacetimedb/react";
import { tables } from "@/module_bindings";
import { useMemo } from "react";

function colorFromUserId(userId: string): string {
  const colors = [
    "#EF4444", "#F97316", "#EAB308", "#22C55E",
    "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

interface Props {
  pageId: string;
  tenantId: string;
  currentUserId?: string;
}

export function LiveCursors({ pageId, tenantId, currentUserId }: Props) {
  const [allCursors] = useTable(tables.active_cursor);

  const cursors = useMemo(
    () =>
      allCursors.filter(
        (c) =>
          c.pageId === pageId &&
          c.tenantId === tenantId &&
          c.userId !== currentUserId
      ),
    [allCursors, pageId, tenantId, currentUserId]
  );

  return (
    <>
      {cursors.map((cursor) => {
        // Use userColor from STDB if available, otherwise derive from userId
        const color = cursor.userColor || colorFromUserId(cursor.userId);
        const label = cursor.userName || "User";
        return (
          <div
            key={cursor.userId}
            className="absolute pointer-events-none z-50"
            style={{
              left: cursor.x,
              top: cursor.y,
              transition: "left 0.1s, top 0.1s",
            }}
          >
            <div
              className="w-3 h-3 rounded-full border-2 border-white shadow-md"
              style={{ backgroundColor: color }}
            />
            <div
              className="absolute top-4 left-0 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white whitespace-nowrap shadow-sm"
              style={{ backgroundColor: color }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </>
  );
}
