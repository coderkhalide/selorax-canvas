import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F3F4F6',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #E5E7EB',
        padding: '16px 40px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#2D2F8F', letterSpacing: '-0.5px' }}>
          SeloraX
        </span>
        <span style={{ fontSize: 14, color: '#9CA3AF' }}>Canvas</span>
      </header>

      <main style={{ padding: '48px 40px', maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Dashboard
        </h1>
        <p style={{ color: '#6B7280', marginBottom: 40, fontSize: 15 }}>
          Manage your pages, funnels, and experiments.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <DashboardCard
            href="/funnels"
            icon="🔀"
            title="Funnels"
            description="Build multi-step sales funnels from your pages"
            color="#2D2F8F"
          />
          <DashboardCard
            href={`${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'}/api/pages`}
            icon="📄"
            title="Pages API"
            description="Browse pages via the REST API"
            color="#F47920"
            external
          />
          <DashboardCard
            href="/analytics/funnels/demo"
            icon="📊"
            title="Analytics"
            description="Funnel conversion rates and drop-off analysis"
            color="#10B981"
          />
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  href, icon, title, description, color, external,
}: {
  href: string; icon: string; title: string; description: string; color: string; external?: boolean;
}) {
  const style: React.CSSProperties = {
    display: 'block', padding: '24px',
    background: '#fff', border: '1px solid #E5E7EB',
    borderRadius: 12, textDecoration: 'none',
    cursor: 'pointer',
  };
  const inner = (
    <>
      <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>{description}</p>
      <span style={{
        display: 'inline-block', marginTop: 16,
        fontSize: 12, fontWeight: 600, color,
      }}>Open →</span>
    </>
  );
  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{inner}</a>;
  }
  return <Link href={href} style={style}>{inner}</Link>;
}
