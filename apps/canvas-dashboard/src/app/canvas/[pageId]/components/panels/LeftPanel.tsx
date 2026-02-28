'use client';
import { useState } from 'react';
import LayersTree       from './LayersTree';
import ElementsPanel    from './ElementsPanel';
import ComponentBrowser from './ComponentBrowser';
import FunnelBuilder    from './FunnelBuilder';

type Tab = 'elements' | 'layers' | 'components' | 'funnels';

export default function LeftPanel({ pageId, tenantId }: {
  pageId: string; tenantId: string;
}) {
  const [tab, setTab] = useState<Tab>('elements');

  return (
    <div className="panel-left">
      <div className="panel-tabs">
        {(['elements', 'layers', 'components', 'funnels'] as Tab[]).map(t => (
          <button key={t} className={`panel-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="panel-tab-body">
        {tab === 'elements'    && <ElementsPanel pageId={pageId} tenantId={tenantId} />}
        {tab === 'layers'      && <LayersTree />}
        {tab === 'components'  && <ComponentBrowser tenantId={tenantId} pageId={pageId} />}
        {tab === 'funnels'     && (
          <FunnelBuilder
            tenantId={tenantId}
            backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'}
          />
        )}
      </div>
    </div>
  );
}
