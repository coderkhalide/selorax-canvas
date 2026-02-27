'use client';
import { useState, useCallback, useRef } from 'react';
import CanvasNode from './CanvasNode';
import { buildSelectionRect, rectsIntersect, type Point } from '@/utils/rubber-band';
import { useCanvas } from '@/context/CanvasContext';

interface CanvasProps {
  tree: any;
  cursors: any[];
  onContextMenu: (x: number, y: number, targetId: string | null) => void;
  dropInfo?: { overId: string; position: 'before' | 'after' | 'inside' } | null;
}

export default function Canvas({
  tree, cursors, onContextMenu, dropInfo,
}: CanvasProps) {
  const { selectedIds, selectNode, multiSelectNodes } = useCanvas();
  const [rubberStart, setRubberStart] = useState<Point | null>(null);
  const [rubberEnd, setRubberEnd] = useState<Point | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only left button
    if (e.button !== 0) return;
    // Don't start rubber band when clicking on a node
    const target = e.target as HTMLElement;
    if (target.closest('[data-node-id]')) return;

    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    setRubberStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setRubberEnd(null);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!rubberStart) return;
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    setRubberEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [rubberStart]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (rubberStart && rubberEnd) {
      const selRect = buildSelectionRect(rubberStart, rubberEnd);
      const isDrag = selRect.width > 4 || selRect.height > 4;

      if (isDrag && frameRef.current) {
        const frameBounds = frameRef.current.getBoundingClientRect();
        const nodeEls = frameRef.current.querySelectorAll<HTMLElement>('[data-node-id]');
        const ids: string[] = [];

        nodeEls.forEach(el => {
          const nodeId = el.dataset.nodeId;
          if (!nodeId) return;
          const elBounds = el.getBoundingClientRect();
          // Convert element bounds to frame-relative coordinates
          const elRect = {
            x: elBounds.left - frameBounds.left,
            y: elBounds.top - frameBounds.top,
            width: elBounds.width,
            height: elBounds.height,
          };
          if (rectsIntersect(selRect, elRect)) {
            ids.push(nodeId);
          }
        });

        multiSelectNodes(ids); // empty array clears selection
      }
    }

    setRubberStart(null);
    setRubberEnd(null);
  }, [rubberStart, rubberEnd, multiSelectNodes]);

  const handleMouseLeave = useCallback(() => {
    // Cancel rubber band without triggering selection
    setRubberStart(null);
    setRubberEnd(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const nodeEl = target.closest<HTMLElement>('[data-node-id]');
    const nodeId = nodeEl?.dataset.nodeId ?? null;
    onContextMenu(e.clientX, e.clientY, nodeId);
  }, [onContextMenu]);

  const rubberRect =
    rubberStart && rubberEnd
      ? buildSelectionRect(rubberStart, rubberEnd)
      : null;

  return (
    <div
      className="canvas-viewport"
      onClick={(e) => {
        if (e.target === e.currentTarget) selectNode(null);
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
    >
      <div className="canvas-frame" ref={frameRef}>
        {tree ? (
          <CanvasNode node={tree} depth={0} dropInfo={dropInfo} />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', minHeight: 400, color: '#9CA3AF', flexDirection: 'column', gap: 12,
          }}>
            <span style={{ fontSize: 40 }}>🎨</span>
            <p>Canvas is empty. Use the AI bar to start building.</p>
          </div>
        )}

        {/* Live cursors — camelCase from STDB generated bindings */}
        {cursors.map(cursor => (
          <div key={cursor.userId} style={{
            position: 'absolute',
            left: cursor.x, top: cursor.y,
            pointerEvents: 'none',
            transform: 'translate(-2px, -2px)',
          }}>
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path d="M0 0L16 12L8 12L5 20L0 0Z" fill={cursor.userColor} />
            </svg>
            <span style={{
              background: cursor.userColor, color: '#fff',
              fontSize: 11, padding: '2px 6px', borderRadius: 4,
              marginLeft: 16, whiteSpace: 'nowrap',
            }}>
              {cursor.userName}
            </span>
          </div>
        ))}

        {/* Rubber band selection rectangle */}
        {rubberRect && (rubberRect.width > 4 || rubberRect.height > 4) && (
          <div
            className="rubber-band"
            style={{
              left: rubberRect.x,
              top: rubberRect.y,
              width: rubberRect.width,
              height: rubberRect.height,
            }}
          />
        )}
      </div>
    </div>
  );
}
