'use client';
import { useEffect, useState } from 'react';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

interface Stats {
  visitors: number;
  conversions: number;
  conversionRate: number;
  conversionValue: number;
}

interface AnalyticsStripProps {
  pageId: string;
  tenantId: string;
  isPublished: boolean;
}

export default function AnalyticsStrip({ pageId, tenantId, isPublished }: AnalyticsStripProps) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!isPublished) return;
    fetch(`${BACKEND}/api/analytics/pages/${pageId}?days=30`, {
      headers: { 'x-tenant-id': tenantId },
    })
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, [pageId, tenantId, isPublished]);

  if (!isPublished || !stats) return null;

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  const fmtMoney = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="analytics-strip">
      <div className="analytics-strip-stats">
        <span title="Unique visitors (30d)">👁 {fmt(stats.visitors)}</span>
        <span title="Conversion rate (30d)">⚡ {stats.conversionRate}%</span>
        <span title="Total revenue (30d)">💰 {fmtMoney(stats.conversionValue)}</span>
      </div>
      <a
        href={`/analytics/${pageId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="analytics-strip-link"
      >
        View Full Analytics →
      </a>
    </div>
  );
}
