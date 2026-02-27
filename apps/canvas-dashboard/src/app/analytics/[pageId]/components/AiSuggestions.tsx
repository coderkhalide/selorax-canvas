'use client';
import { useState } from 'react';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export default function AiSuggestions({ pageId, tenantId }: { pageId: string; tenantId: string }) {
  const [loading, setLoading]   = useState(false);
  const [response, setResponse] = useState('');

  const askAI = async () => {
    setLoading(true);
    setResponse('');
    try {
      const res = await fetch(`${BACKEND}/api/ai/canvas`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body:    JSON.stringify({
          message: `Analyze page ${pageId}. Call get_page_analytics and get_canvas_screenshot first to understand the performance. Then give me your top 1-2 improvement suggestions. Ask my permission before applying anything.`,
          tenantId,
        }),
      });

      if (!res.ok || !res.body) {
        setResponse('Failed to get AI suggestions.');
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) setResponse(prev => prev + decoder.decode(value));
      }
    } catch {
      setResponse('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#F9FAFB', marginBottom: 12 }}>
        AI Suggestions
      </h2>
      {!response && (
        <button
          onClick={askAI}
          disabled={loading}
          style={{
            background: loading ? '#4B5563' : '#7C3AED',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '10px 20px',
            cursor: loading ? 'wait' : 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {loading ? 'Analyzing...' : 'Analyze this page with AI'}
        </button>
      )}
      {response && (
        <div style={{
          background: '#12141f',
          border: '1px solid #7C3AED',
          borderRadius: 8,
          padding: 20,
          fontSize: 13,
          color: '#D1D5DB',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
        }}>
          {response}
        </div>
      )}
    </div>
  );
}
