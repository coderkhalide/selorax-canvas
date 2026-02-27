'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuAction {
  label:     string;
  icon?:     string;
  shortcut?: string;
  danger?:   boolean;
  disabled?: boolean;
  divider?:  boolean;  // render a divider line before this item
  onClick:   () => void;
}

interface ContextMenuProps {
  x:        number;
  y:        number;
  actions:  ContextMenuAction[];
  onClose:  () => void;
}

export default function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [onClose]);

  // Adjust position so menu stays inside viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(0, Math.min(x, window.innerWidth  - 200)),
    top:  Math.max(0, Math.min(y, window.innerHeight - 400)),
    zIndex: 9999,
  };

  const menu = (
    <div ref={menuRef} className="ctx-menu" style={menuStyle}>
      {actions.map((action, i) => (
        <div key={i}>
          {action.divider && <div className="ctx-divider" />}
          <button
            className={`ctx-item ${action.danger ? 'danger' : ''}`}
            disabled={action.disabled}
            onClick={() => { action.onClick(); onClose(); }}
          >
            {action.icon && <span className="ctx-icon">{action.icon}</span>}
            <span className="ctx-label">{action.label}</span>
            {action.shortcut && (
              <span className="ctx-shortcut">{action.shortcut}</span>
            )}
          </button>
        </div>
      ))}
    </div>
  );

  return createPortal(menu, document.body);
}
