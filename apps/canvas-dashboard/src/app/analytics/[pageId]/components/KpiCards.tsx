interface Stats {
  visitors: number;
  conversions: number;
  conversionRate: number;
  conversionValue: number;
}

export default function KpiCards({ stats }: { stats: Stats }) {
  const cards = [
    { label: 'Visitors',        value: stats.visitors.toLocaleString(),              sub: 'unique (30d)' },
    { label: 'Conversions',     value: stats.conversions.toLocaleString(),            sub: 'completed goals' },
    { label: 'Conv. Rate',      value: `${stats.conversionRate}%`,                   sub: 'visitors → goal' },
    { label: 'Revenue',         value: `$${stats.conversionValue.toLocaleString()}`, sub: 'total attributed' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
      {cards.map(c => (
        <div
          key={c.label}
          style={{
            background: '#12141f',
            border: '1px solid #1e2130',
            borderRadius: 8,
            padding: '20px 24px',
          }}
        >
          <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, margin: '0 0 4px' }}>{c.label}</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: '#F9FAFB', margin: '0 0 2px' }}>{c.value}</p>
          <p style={{ fontSize: 11, color: '#4B5563', margin: 0 }}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
