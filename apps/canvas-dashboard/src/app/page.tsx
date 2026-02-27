import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 16,
      background: '#0f1117', color: '#fff',
    }}>
      <h1 style={{ fontSize: 32, fontWeight: 700 }}>SeloraX Canvas</h1>
      <p style={{ color: '#6B7280', fontSize: 16 }}>
        Visual canvas editor — create a page to get started
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <a
          href={`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/pages`}
          style={{ color: '#a78bfa', fontSize: 14 }}
        >
          View pages via API →
        </a>
      </div>
    </div>
  );
}
