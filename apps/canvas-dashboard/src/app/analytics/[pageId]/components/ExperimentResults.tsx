interface ExperimentLift {
  control: { visitors: number; conversionRate: number };
  variant: { visitors: number; conversionRate: number };
  lift: number;
}

export default function ExperimentResults({ experimentLift }: { experimentLift: ExperimentLift }) {
  const liftPositive = experimentLift.lift >= 0;
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#F9FAFB', marginBottom: 16 }}>
        Experiment Results
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
        {[
          { label: 'Control', data: experimentLift.control },
          { label: 'Variant', data: experimentLift.variant },
        ].map(({ label, data }) => (
          <div key={label} style={{ background: '#12141f', border: '1px solid #1e2130', borderRadius: 8, padding: '16px 20px' }}>
            <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 4px' }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#F9FAFB', margin: '0 0 2px' }}>
              {data.conversionRate}%
            </p>
            <p style={{ fontSize: 11, color: '#4B5563', margin: 0 }}>{data.visitors.toLocaleString()} visitors</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: liftPositive ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${liftPositive ? '#34D399' : '#EF4444'}`, borderRadius: 6, padding: '6px 12px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: liftPositive ? '#34D399' : '#EF4444' }}>
          {liftPositive ? '+' : ''}{experimentLift.lift}% lift
        </span>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>vs control</span>
      </div>
    </div>
  );
}
