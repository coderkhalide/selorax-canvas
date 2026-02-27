'use client';
import CanvasNode from './CanvasNode';

interface CanvasProps {
  tree: any;
  cursors: any[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function Canvas({ tree, cursors, selectedId, onSelect }: CanvasProps) {
  return (
    <div className="canvas-viewport" onClick={(e) => {
      if (e.target === e.currentTarget) onSelect(null);
    }}>
      <div className="canvas-frame">
        {tree ? (
          <CanvasNode node={tree} selectedId={selectedId} onSelect={onSelect} depth={0} />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', minHeight: 400, color: '#9CA3AF', flexDirection: 'column', gap: 12,
          }}>
            <span style={{ fontSize: 40 }}>🎨</span>
            <p>Canvas is empty. Use the AI bar to start building.</p>
          </div>
        )}

        {/* Live cursors */}
        {cursors.map(cursor => (
          <div key={cursor.user_id} style={{
            position: 'absolute',
            left: cursor.x, top: cursor.y,
            pointerEvents: 'none',
            transform: 'translate(-2px, -2px)',
          }}>
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path d="M0 0L16 12L8 12L5 20L0 0Z" fill={cursor.user_color} />
            </svg>
            <span style={{
              background: cursor.user_color, color: '#fff',
              fontSize: 11, padding: '2px 6px', borderRadius: 4,
              marginLeft: 16, whiteSpace: 'nowrap',
            }}>
              {cursor.user_name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
