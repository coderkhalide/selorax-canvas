export type DropPosition = 'before' | 'after' | 'inside' | null;

export function DropZoneLine({ position }: { position: 'before' | 'after' }) {
  return <div className={`drop-zone-line drop-zone-${position}`} />;
}

export function DropHereHint() {
  return <div className="drop-here-hint">Drop Here</div>;
}
