'use client';
import { useState } from 'react';
import LayersTree       from './LayersTree';
import ComponentBrowser from './ComponentBrowser';
import FunnelBuilder    from './FunnelBuilder';

interface LeftPanelProps {
  flatNodes:   any[];
  selectedIds: Set<string>;
  onSelect:    (id: string | null) => void;
  conn:        any;
  pageId:      string;
  tenantId:    string;
}

type Tab = 'layers' | 'components' | 'funnels';

export default function LeftPanel({
  flatNodes, selectedIds, onSelect, conn, pageId, tenantId,
}: LeftPanelProps) {
  const [tab, setTab] = useState<Tab>('layers');

  return (
    <div className="panel-left">
      {/* Tab strip */}
      <div className="panel-tabs">
        {(['layers', 'components', 'funnels'] as Tab[]).map(t => (
          <button
            key={t}
            className={`panel-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div className="panel-tab-body">
        {tab === 'layers'     && (
          <LayersTree flatNodes={flatNodes} selectedIds={selectedIds} onSelect={onSelect} />
        )}
        {tab === 'components' && (
          <ComponentBrowser tenantId={tenantId} pageId={pageId} conn={conn} />
        )}
        {tab === 'funnels'    && (
          <FunnelBuilder
            tenantId={tenantId}
            backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'}
          />
        )}
      </div>
    </div>
  );
}
