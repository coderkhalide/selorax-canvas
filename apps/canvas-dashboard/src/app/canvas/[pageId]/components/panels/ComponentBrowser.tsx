'use client';
import { useState, useEffect } from 'react';
import { useDraggable }        from '@dnd-kit/core';

interface Component {
  id:             string;
  name:           string;
  currentVersion: string;
  currentUrl:     string;
  isPublic:       boolean;
  tenantId:       string | null;
}

interface ComponentBrowserProps {
  tenantId:   string;
  pageId:     string;
  conn:       any;
}

export default function ComponentBrowser({ tenantId, pageId, conn }: ComponentBrowserProps) {
  const [components, setComponents] = useState<Component[]>([]);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`${backendUrl}/api/components`, {
      headers: { 'x-tenant-id': tenantId },
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => setComponents(Array.isArray(data) ? data : []))
      .catch(err => { if (err.name !== 'AbortError') setComponents([]); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [tenantId, backendUrl]);

  const filtered = components.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const mine    = filtered.filter(c => c.tenantId === tenantId);
  const library = filtered.filter(c => c.isPublic && c.tenantId === null);

  const inject = (comp: Component) => {
    if (!conn) return;
    conn.reducers.insertNode({
      id:               crypto.randomUUID(),
      pageId,
      tenantId,
      parentId:         null,
      nodeType:         'component',
      order:            'z' + Date.now().toString(36),
      styles:           null,
      props:            null,
      settings:         null,
      componentUrl:     { some: comp.currentUrl },
      componentVersion: { some: comp.currentVersion },
      componentId:      comp.id,
    });
  };

  return (
    <div className="component-browser">
      <div className="component-search">
        <input
          type="text"
          placeholder="Search components..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="component-search-input"
        />
      </div>

      {loading && <p className="browser-loading">Loading...</p>}

      {mine.length > 0 && (
        <div className="component-group">
          <div className="component-group-label">My Components</div>
          <div className="component-grid">
            {mine.map(comp => (
              <ComponentCard key={comp.id} comp={comp} onInject={inject} />
            ))}
          </div>
        </div>
      )}

      {library.length > 0 && (
        <div className="component-group">
          <div className="component-group-label">Public Library</div>
          <div className="component-grid">
            {library.map(comp => (
              <ComponentCard key={comp.id} comp={comp} onInject={inject} />
            ))}
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <p className="browser-empty">No components found</p>
      )}
    </div>
  );
}

function ComponentCard({
  comp, onInject,
}: { comp: Component; onInject: (c: Component) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `component-${comp.id}`,
    data: { type: 'component', component: comp },
  });

  return (
    <div
      ref={setNodeRef}
      className={`component-card ${isDragging ? 'dragging' : ''}`}
      onClick={() => onInject(comp)}
      {...listeners}
      {...attributes}
      title={`${comp.name} v${comp.currentVersion}`}
    >
      <span className="component-card-icon">🧩</span>
      <span className="component-card-name">{comp.name}</span>
      <span className="component-card-version">v{comp.currentVersion}</span>
    </div>
  );
}
