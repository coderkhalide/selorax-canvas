'use client';
import { useCanvas } from '@/context/CanvasContext';

interface FloatingToolbarProps {
  nodeId: string;
  nodeName: string;
}

export default function FloatingToolbar({ nodeId, nodeName }: FloatingToolbarProps) {
  const { deleteNode, duplicateSelected, nodes } = useCanvas();
  const node = nodes.get(nodeId);
  const isLocked = !!node?.lockedBy;

  return (
    <div className="floating-toolbar" onMouseDown={e => e.stopPropagation()}>
      <span className="floating-toolbar-name">{nodeName}</span>
      <button className="floating-btn" title="Duplicate (&#8984;D)" onClick={() => duplicateSelected()}>
        &#10695;
      </button>
      <button className="floating-btn danger" title="Delete" onClick={() => deleteNode(nodeId)}>
        &#10005;
      </button>
      <button className="floating-btn" title={isLocked ? 'Unlock' : 'Lock'}
        style={{ opacity: isLocked ? 1 : 0.5 }}>
        {isLocked ? '\uD83D\uDD12' : '\uD83D\uDD13'}
      </button>
    </div>
  );
}
