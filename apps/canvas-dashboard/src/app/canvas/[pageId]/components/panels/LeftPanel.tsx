'use client';
import LayersTree from './LayersTree';

interface LeftPanelProps {
  flatNodes: any[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function LeftPanel({ flatNodes, selectedId, onSelect }: LeftPanelProps) {
  return (
    <div className="panel-left">
      <div className="panel-section">
        <h3>Layers</h3>
        <LayersTree flatNodes={flatNodes} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </div>
  );
}
