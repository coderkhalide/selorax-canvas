export type DropPosition = 'before' | 'after' | 'inside' | null;

export function DropZoneLine({ position }: { position: 'before' | 'after' }) {
  return <div className={`drop-zone-line ${position}`} />;
}
