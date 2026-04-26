import { useParams, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';

const API = 'http://localhost:3002';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, suffix = 'M') {
  if (n == null) return '—';
  return `$${(n / 1_000_000).toFixed(0)}${suffix}`;
}
function fmtX(n: number | null | undefined) {
  if (n == null) return '—';
  return `${n.toFixed(1)}x`;
}
function fmtDate(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type CovenantStatus = 'breach' | 'warning' | 'current' | 'n/a';

const INSTRUMENT_LABELS: Record<string, string> = {
  first_lien: 'First Lien',
  second_lien: 'Second Lien',
  mezzanine: 'Mezzanine',
  unitranche: 'Unitranche',
  equity_co_invest: 'Equity Co-Invest',
};
const INSTRUMENT_COLORS: Record<string, string> = {
  first_lien: 'bg-blue-100 text-blue-700',
  second_lien: 'bg-pink-100 text-pink-700',
  mezzanine: 'bg-amber-100 text-amber-800',
  unitranche: 'bg-violet-100 text-violet-700',
  equity_co_invest: 'bg-emerald-100 text-emerald-700',
};

function StatusBadge({ status, large }: { status: CovenantStatus; large?: boolean }) {
  const base = large ? 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold' : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold';
  if (status === 'breach') return <span className={`${base} bg-red-100 text-red-700`}>● Breach</span>;
  if (status === 'warning') return <span className={`${base} bg-amber-100 text-amber-700`}>● Warning</span>;
  if (status === 'current') return <span className={`${base} bg-emerald-100 text-emerald-700`}>● Current</span>;
  return <span className={`${base} bg-gray-100 text-gray-500`}>N/A</span>;
}

function MetricCard({
  label, value, subLabel, status, threshold, thresholdLabel
}: {
  label: string; value: string; subLabel?: string;
  status?: CovenantStatus; threshold?: string; thresholdLabel?: string;
}) {
  const valueColor = status === 'breach' ? 'text-red-600'
    : status === 'warning' ? 'text-amber-600'
    : 'text-gray-900';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueColor} mt-1`}>{value}</p>
      {status && <div className="mt-2"><StatusBadge status={status} /></div>}
      {threshold && (
        <p className="text-xs text-gray-400 mt-1">{thresholdLabel}: {threshold}</p>
      )}
      {subLabel && <p className="text-xs text-gray-400 mt-1">{subLabel}</p>}
    </div>
  );
}

// ─── Sparkline (mock trend, seeded) ───────────────────────────────────────────
function Sparkline({ dealId, metric }: { dealId: number; metric: string }) {
  const seed = dealId * (metric === 'leverage' ? 3 : 7);
  const points = Array.from({ length: 8 }, (_, i) => {
    const x = Math.sin(seed + i * 2.3) * 10000;
    const r = x - Math.floor(x);
    return metric === 'leverage' ? 2.5 + r * 3.5 : 1.4 + r * 2.8;
  });
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 280, h = 60, pad = 4;
  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });
  const last = points[points.length - 1];
  const threshold = metric === 'leverage' ? 5.25 : 1.75;
  const lineColor = metric === 'leverage'
    ? last > threshold ? '#ef4444' : '#10b981'
    : last < threshold ? '#ef4444' : '#10b981';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 60 }}>
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {points.map((v, i) => {
        const x = pad + (i / (points.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="2.5" fill={lineColor} />;
      })}
    </svg>
  );
}

// ─── Quarter labels ────────────────────────────────────────────────────────────
function quarterLabels() {
  const now = new Date();
  const labels = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i * 3);
    const q = Math.floor(d.getMonth() / 3) + 1;
    labels.push(`Q${q}'${String(d.getFullYear()).slice(2)}`);
  }
  return labels;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CovenantDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const stateData = (location.state as any)?.covenant ?? null;

  // Try live API — only if no state data provided
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['covenant-detail', id],
    queryFn: () =>
      fetch(`${API}/api/portfolio/covenants/${id}`)
        .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
        .catch(() => null),
    enabled: !stateData && !!id,
  });

  const cov = stateData ?? apiData;
  const isDemoData = !!stateData;
  const labels = quarterLabels();

  if (!stateData && isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-gray-400">Loading position…</div>
      </Layout>
    );
  }

  if (!cov) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <p className="text-gray-500">Position not found.</p>
          <Link to="/covenants" className="text-sm text-blue-600 hover:underline">← Back to Covenant Monitoring</Link>
        </div>
      </Layout>
    );
  }

  const isEquity = cov.instrument_type === 'equity_co_invest';

  return (
    <Layout>
      {/* Breadcrumb + header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link to="/covenants" className="hover:text-gray-600 transition-colors">Covenant Monitoring</Link>
            <span>/</span>
            <span className="text-gray-600 font-medium truncate max-w-xs">{cov.deal_name}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{cov.deal_name}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${INSTRUMENT_COLORS[cov.instrument_type] ?? 'bg-gray-100 text-gray-600'}`}>
              {INSTRUMENT_LABELS[cov.instrument_type] ?? cov.instrument_type}
            </span>
            <StatusBadge status={cov.overall_status} large />
          </div>
          <p className="text-sm text-gray-500 mt-1">{cov.borrower} · As of {fmtDate(cov.period_end_date)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDemoData && (
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">Demo Data</span>
          )}
          {!isDemoData && (
            <Link
              to={`/portfolio/positions/${cov.deal_id}`}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              View Full Position →
            </Link>
          )}
        </div>
      </div>

      {/* Key metrics row */}
      <div className={`grid gap-4 mb-6 ${isEquity ? 'grid-cols-3' : 'grid-cols-5'}`}>
        <MetricCard
          label="Drawn Amount"
          value={fmt(cov.drawn_amount)}
          subLabel="committed exposure"
        />
        {!isEquity && (
          <MetricCard
            label="Leverage (D/EBITDA)"
            value={fmtX(cov.leverage_ratio)}
            status={cov.leverage_status}
            threshold={cov.leverage_threshold ? `${cov.leverage_threshold}x max` : undefined}
            thresholdLabel="Threshold"
          />
        )}
        {!isEquity && (
          <MetricCard
            label="Interest Coverage"
            value={fmtX(cov.interest_coverage)}
            status={cov.icov_status}
            threshold={cov.icov_threshold ? `${cov.icov_threshold}x min` : undefined}
            thresholdLabel="Threshold"
          />
        )}
        {!isEquity && (
          <MetricCard label="EBITDA" value={fmt(cov.ebitda)} subLabel="trailing twelve months" />
        )}
        {!isEquity && (
          <MetricCard label="Revenue" value={fmt(cov.revenue)} subLabel="trailing twelve months" />
        )}
        {isEquity && (
          <MetricCard label="Fair Value" value={fmt(cov.fair_value)} subLabel="estimated" />
        )}
        <MetricCard
          label="Reporting"
          value={cov.reporting_obligations.length.toString()}
          status={cov.reporting_status}
          subLabel={`${cov.reporting_obligations.length} active obligation${cov.reporting_obligations.length !== 1 ? 's' : ''}`}
        />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left: Financial covenants + trend */}
        <div className="col-span-2 flex flex-col gap-5">
          {!isEquity && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Financial Covenant Trends</h2>
                <p className="text-xs text-gray-400 mt-0.5">8-quarter trailing view (demo simulation)</p>
              </div>
              <div className="p-5 grid grid-cols-2 gap-8">
                {/* Leverage trend */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Leverage (D/EBITDA)</p>
                    <StatusBadge status={cov.leverage_status} />
                  </div>
                  <Sparkline dealId={cov.deal_id} metric="leverage" />
                  <div className="flex justify-between mt-1">
                    {labels.filter((_, i) => i % 2 === 0).map(l => (
                      <span key={l} className="text-xs text-gray-400">{l}</span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Current: <strong className={`${cov.leverage_status === 'breach' ? 'text-red-600' : cov.leverage_status === 'warning' ? 'text-amber-600' : 'text-gray-900'}`}>{fmtX(cov.leverage_ratio)}</strong></span>
                    <span className="text-gray-400">Max {cov.leverage_threshold}x</span>
                  </div>
                </div>
                {/* Interest coverage trend */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Interest Coverage</p>
                    <StatusBadge status={cov.icov_status} />
                  </div>
                  <Sparkline dealId={cov.deal_id} metric="coverage" />
                  <div className="flex justify-between mt-1">
                    {labels.filter((_, i) => i % 2 === 0).map(l => (
                      <span key={l} className="text-xs text-gray-400">{l}</span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Current: <strong className={`${cov.icov_status === 'breach' ? 'text-red-600' : cov.icov_status === 'warning' ? 'text-amber-600' : 'text-gray-900'}`}>{fmtX(cov.interest_coverage)}</strong></span>
                    <span className="text-gray-400">Min {cov.icov_threshold}x</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Covenant compliance summary table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Covenant Compliance Summary</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Covenant</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Actual</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Threshold</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!isEquity && (
                  <tr>
                    <td className="px-5 py-3 font-medium text-gray-900">Leverage (Debt/EBITDA)</td>
                    <td className="px-5 py-3 text-gray-500">Financial</td>
                    <td className={`px-5 py-3 font-semibold ${cov.leverage_status === 'breach' ? 'text-red-600' : cov.leverage_status === 'warning' ? 'text-amber-600' : 'text-gray-900'}`}>
                      {fmtX(cov.leverage_ratio)}
                    </td>
                    <td className="px-5 py-3 text-gray-500">≤ {cov.leverage_threshold}x</td>
                    <td className="px-5 py-3"><StatusBadge status={cov.leverage_status} /></td>
                  </tr>
                )}
                {!isEquity && (
                  <tr>
                    <td className="px-5 py-3 font-medium text-gray-900">Interest Coverage</td>
                    <td className="px-5 py-3 text-gray-500">Financial</td>
                    <td className={`px-5 py-3 font-semibold ${cov.icov_status === 'breach' ? 'text-red-600' : cov.icov_status === 'warning' ? 'text-amber-600' : 'text-gray-900'}`}>
                      {fmtX(cov.interest_coverage)}
                    </td>
                    <td className="px-5 py-3 text-gray-500">≥ {cov.icov_threshold}x</td>
                    <td className="px-5 py-3"><StatusBadge status={cov.icov_status} /></td>
                  </tr>
                )}
                {cov.reporting_obligations.map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="px-5 py-3 font-medium text-gray-900 capitalize">
                      {r.obligation_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-5 py-3 text-gray-500">Reporting</td>
                    <td className="px-5 py-3 text-gray-500 capitalize">{r.frequency}</td>
                    <td className="px-5 py-3 text-gray-500">{r.days_after_period_end}d after period</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status === 'overdue' ? 'breach' : 'current'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: deal summary + actions */}
        <div className="flex flex-col gap-5">
          {/* Deal summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-4">Deal Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Borrower</span>
                <span className="font-medium text-gray-900 text-right max-w-[160px]">{cov.borrower}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Instrument</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${INSTRUMENT_COLORS[cov.instrument_type] ?? 'bg-gray-100 text-gray-600'}`}>
                  {INSTRUMENT_LABELS[cov.instrument_type] ?? cov.instrument_type}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Drawn</span>
                <span className="font-semibold text-gray-900">{fmt(cov.drawn_amount)}</span>
              </div>
              {!isEquity && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">EBITDA</span>
                    <span className="font-medium text-gray-900">{fmt(cov.ebitda)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Revenue</span>
                    <span className="font-medium text-gray-900">{fmt(cov.revenue)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Period End</span>
                <span className="font-medium text-gray-900">{fmtDate(cov.period_end_date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Deal ID</span>
                <span className="font-medium text-gray-500 font-mono">{cov.deal_id}</span>
              </div>
            </div>
          </div>

          {/* Reporting obligations */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-4">Reporting Obligations</h2>
            <div className="space-y-3">
              {cov.reporting_obligations.map((r: any, i: number) => (
                <div key={i} className="flex items-start justify-between gap-2 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800 capitalize">{r.obligation_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{r.frequency} · {r.days_after_period_end}d after period</p>
                    {r.last_received_date && (
                      <p className="text-xs text-gray-400">Last received: {fmtDate(r.last_received_date)}</p>
                    )}
                  </div>
                  <StatusBadge status={r.status === 'overdue' ? 'breach' : 'current'} />
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200 flex items-center gap-2">
                <span>📋</span> Log compliance review
              </button>
              <button className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200 flex items-center gap-2">
                <span>📨</span> Request financial package
              </button>
              <button className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200 flex items-center gap-2">
                <span>⚠️</span> Escalate to portfolio manager
              </button>
              <button className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200 flex items-center gap-2">
                <span>📎</span> Attach document
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
