'use client';
import { useState } from 'react';

const EXAMPLES = [
  'Make the hero section more premium and dark',
  'Add a countdown timer above the buy button',
  'Add social proof and trust badges',
  'Make this page mobile-friendly',
  'Build an urgency section with live stock counter',
];

interface AIBarProps {
  conn: any;
  pageId: string;
  tenantId: string;
  selectedNodeId: string | null;
}

export default function AIBar({ conn, pageId, tenantId, selectedNodeId }: AIBarProps) {
  const [prompt,  setPrompt]  = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');

  async function handleSubmit() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setResponse('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/ai/canvas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          page_id: pageId,
          tenant_id: tenantId,
          selected_node_id: selectedNodeId,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Request failed' }));
        setResponse(`Error: ${error}`);
        return;
      }

      // Stream tokens — actual canvas updates come via SpacetimeDB subscription
      const reader = res.body?.getReader();
      if (reader) {
        const dec = new TextDecoder();
        let text = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += dec.decode(value);
          setResponse(text);
        }
      }

      setPrompt('');
    } catch (err: any) {
      setResponse(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ai-bar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      {response && (
        <div style={{
          background: '#0f1117', border: '1px solid #2a2d3a', borderRadius: 6,
          padding: '8px 12px', fontSize: 12, color: '#9CA3AF', maxHeight: 80, overflow: 'auto',
        }}>
          {response}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="ai-bar-icon">✨</span>
        <div className="ai-bar-input-wrap">
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            placeholder="Describe what you want to change..."
            disabled={loading}
          />
          {!prompt && !loading && (
            <div className="ai-examples">
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => setPrompt(ex)} className="ai-chip">{ex}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={handleSubmit} disabled={loading || !prompt.trim()} className="ai-submit">
          {loading ? '⋯' : '→'}
        </button>
      </div>
    </div>
  );
}
