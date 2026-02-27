'use client';
// Data comes from SpacetimeDB subscription — auto-updates in real-time

const STATUS_COLORS: Record<string, string> = {
  thinking: '#7C3AED', planning: '#2563EB', building: '#059669',
  applying:  '#D97706', done:    '#16A34A', error:    '#DC2626',
};

interface AIStatusBarProps {
  operation: {
    status: string;
    currentAction: string;
    progress: number;
    prompt: string;
  };
}

export default function AIStatusBar({ operation }: AIStatusBarProps) {
  const color = STATUS_COLORS[operation.status] ?? '#7C3AED';
  return (
    <div className="ai-status-bar" style={{ borderColor: color }}>
      <span className="ai-dot" style={{
        background: color,
        animation: operation.status !== 'done' ? 'pulse 1s infinite' : 'none',
      }} />
      <span className="ai-action">{operation.currentAction}</span>
      <div className="ai-progress-track">
        <div className="ai-progress-fill" style={{ width: `${operation.progress}%`, background: color }} />
      </div>
      <span className="ai-pct">{operation.progress}%</span>
    </div>
  );
}
