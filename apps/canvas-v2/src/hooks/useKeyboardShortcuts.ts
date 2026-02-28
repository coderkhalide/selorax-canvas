import { useEffect } from 'react';

interface KeyboardShortcutsConfig {
    onUndo: () => void;
    onRedo: () => void;
    enabled?: boolean;
}

export function useKeyboardShortcuts({ onUndo, onRedo, enabled = true }: KeyboardShortcutsConfig) {
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifier = isMac ? e.metaKey : e.ctrlKey;

            // Undo: Cmd/Ctrl + Z
            if (modifier && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                onUndo();
                return;
            }

            // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
            if (modifier && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
                e.preventDefault();
                onRedo();
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onUndo, onRedo, enabled]);
}
