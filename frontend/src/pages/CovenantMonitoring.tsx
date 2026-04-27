import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

const API = 'https://gp-os-production.up.railway.app';
const PAGE_SIZE = 25;

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

// ─── Mock Data Generator ───────────────────────────────────────────────────────
const LEV_WARN = 4.5;
const LEV_BREACH = 5.25;
const ICOV_WARN = 2.0;
const ICOV_BREACH = 1.75;

const INSTRUMENT_TYPES = [
  { type: 'first_lien', weight: 0.50 },
  { type: 'second_lien', weight: 0.15 },
  { type: 'mezzanine', weight: 0.20 },
  { type: 'equity_co_invest', weight: 0.15 },
];
const COMPANY_PREFIXES = [
  'Apex', 'Summit', 'Nexus', 'Vertex', 'Horizon', 'Atlas', 'Titan', 'Pinnacle',
  'Vector', 'Quantum', 'Crest', 'Meridian', 'Zenith', 'Orbit', 'Ridge', 'Peak',
  'Arc', 'Core', 'Prime', 'Volt', 'Flux', 'Wave', 'Nova', 'Pulse', 'Forge',
  'Eagle', 'Falcon', 'Griffin', 'Hawk', 'Raven', 'Bridge', 'Shield', 'Beacon',
];
const COMPANY_SUFFIXES = [
  'Tech', 'Systems', 'Digital', 'Health', 'Capital', 'Industries', 'Brands',
  'Solutions', 'Networks', 'Logistics', 'Energy', 'Pharma', 'Financial', 'Media',
  'Commerce', 'Manufacturing', 'Analytics', 'Platforms', 'Therapeutics', 'Works',
];
const OBLIGATION_TYPES = ['monthly_financials', 'quarterly_financials', 'annual_audit', 'compliance_certificate'];

function seededRand(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function pickWeighted<T extends { weight: number }>(arr: T[], rand: number): T {
  let cum = 0;
  for (const item of arr) { cum += item.weight; if (rand < cum) return item; }
  return arr[arr.length - 1];
}

function generateMockCovenants(count: number) {
  const result: any[] = [];
  for (let i = 0; i < count; i++) {
    const r = (n: number) => seededRand(i * 17 + n);
    const prefix = COMPANY_PREFIXES[Math.floor(r(1) * COMPANY_PREFIXES.length)];
    const suffix = COMPANY_SUFFIXES[Math.floor(r(2) * COMPANY_SUFFIXES.length)];
    const name = `${prefix}${suffix}`;
    const instr = pickWeighted(INSTRUMENT_TYPES, r(3));
    const isEquity = instr.type === 'equity_co_invest';
    const drawn = Math.round((r(4) * 140 + 10) * 10) * 100_000;
    const fair_value = drawn * (0.92 + r(5) * 0.2);
    const lev = isEquity ? null : 2.5 + r(6) * 3.5;
    const icov = isEquity ? null : 1.4 + r(7) * 2.8;
    const daysAgo = Math.floor(r(8) * 120);
    const periodDate = new Date(Date.now() - daysAgo * 86400000).toISOString().substring(0, 10);

    let levStatus: any = 'n/a';
    if (!isEquity && lev != null) levStatus = lev > LEV_BREACH ? 'breach' : lev > LEV_WARN ? 'warning' : 'current';
    let icovStatus: any = 'n/a';
    if (!isEquity && icov != null) icovStatus = icov < ICOV_BREACH ? 'breach' : icov < ICOV_WARN ? 'warning' : 'current';

    const numObs = 1 + Math.floor(r(9) * 3);
    const reporting_obligations = Array.from({ length: numObs }, (_, j) => ({
      obligation_type: OBLIGATION_TYPES[j % OBLIGATION_TYPES.length],
      frequency: j === 0 ? 'monthly' : j === 1 ? 'quarterly' : 'annual',
      days_after_period_end: 30,
      last_received_date: new Date(Date.now() - Math.floor(r(10 + j) * 60) * 86400000).toISOString().substring(0, 10),
      status: r(11 + j) < 0.1 ? 'overdue' : 'current',
    }));
    const hasOverdueRep = reporting_obligations.some((o: any) => o.status === 'overdue');
    const reportingStatus = hasOverdueRep ? 'breach' : 'current';
    const statuses = [levStatus, icovStatus, reportingStatus];
    const overallStatus = statuses.includes('breach') ? 'breach'
      : statuses.includes('warning') ? 'warning'
      : statuses.every((s: string) => s === 'n/a') ? 'n/a'
      : 'current';

    result.push({
      deal_id: 1000 + i,
      deal_name: `${name} ${instr.type === 'first_lien' ? 'Debt Facility' : instr.type === 'second_lien' ? 'TLB Facility' : instr.type === 'mezzanine' ? 'Mezz Investment' : 'Co-Investment'}`,
      borrower: `${name} Holdings LLC`,
      instrument_type: instr.type,
      drawn_amount: drawn,
      fair_value,
      leverage_ratio: lev,
      leverage_threshold: isEquity ? null : LEV_BREACH,
      leverage_status: levStatus,
      interest_coverage: icov,
      icov_threshold: isEquity ? null : ICOV_BREACH,
      icov_status: icovStatus,
      reporting_obligations,
      reporting_status: reportingStatus,
      overall_status: overallStatus,
      period_end_date: periodDate,
      ebitda: isEquity ? null : drawn * (0.1 + r(12) * 0.15),
      revenue: isEquity ? null : drawn * (0.25 + r(13) * 0.4),
    });
  }
  return result;
}

// ─── Types ────────────────────────────────────────────────────────────────────
const INSTRUMENT_LABELS: Record<string, string> = {
  first_lien: 'First Lien',
  second_lien: 'Second Lien',
  mezzanine: 'Mezzanine',
  unitranche: 'Unitranche',
  equity_co_invest: 'Equity Co-Inv',
};

const INSTRUMENT_COLORS: Record<string, string> = {
  first_lien: 'bg-blue-100 text-blue-700',
  second_lien: 'bg-pink-100 text-pink-700',
  mezzanine: 'bg-amber-100 text-amber-800',
  unitranche: 'bg-violet-100 text-violet-700',
  equity_co_invest: 'bg-emerald-100 text-emerald-700',
};

type CovenantStatus = 'breach' | 'warning' | 'current' | 'n/a';

function StatusBadge({ status }: { status: CovenantStatus }) {
  if (status === 'breach') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">● Breach</span>;
  if (status === 'warning') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">● Warning</span>;
  if (status === 'current') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">● Current</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">N/A</span>;
}

function MetricCell({ value, formatted, status, threshold, label }: {
  value: number | null; formatted: string; status: CovenantStatus; threshold: number | null; label: string;
}) {
  if (status === 'n/a') return <td className="px-4 py-3 text-gray-400 text-sm">—</td>;
  return (
    <td className="px-4 py-3">
      <div className={`text-sm font-semibold ${status === 'breach' ? 'text-red-600' : status === 'warning' ? 'text-amber-600' : 'text-gray-900'}`}>
        {formatted}
      </div>
      {threshold && value != null && (
        <div className="text-xs text-gray-400 mt-0.5">
          {label === 'leverage' ? `Max ${threshold}x` : `Min ${threshold}x`}
        </div>
      )}
    </td>
  );
}

interface Covenant {
  deal_id: number;
  deal_name: string;
  borrower: string;
  instrument_type: string;
  drawn_amount: number;
  fair_value: number;
  period_end_date: string;
  revenue: number;
  ebitda: number;
  leverage_ratio: number | null;
  leverage_threshold: number | null;
  leverage_status: CovenantStatus;
  interest_coverage: number | null;
  icov_threshold: number | null;
  icov_status: CovenantStatus;
  reporting_obligations: any[];
  reporting_status: CovenantStatus;
  overall_status: CovenantStatus;
  last_updated: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CovenantMonitoring() {
  const [filter, setFilter] = useState<'all' | 'breach' | 'warning' | 'current'>('all');
  const [selected, setSelected] = useState<Covenant | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [search, setSearch] = useState('');
  const [instrFilter, setInstrFilter] = useState('');
  const [covenantTypeFilter, setCovenantTypeFilter] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery<{ summary: any; covenants: Covenant[] }>({
    queryKey: ['covenants'],
    queryFn: () => fetch(`${API}/api/portfolio/covenants`).then(r => r.json()),
    refetchInterval: 60000,
    enabled: !demoMode,
  });

  const mockCovenants = useMemo(() => demoMode ? generateMockCovenants(500) : [], [demoMode]);

  const allCovenants: Covenant[] = demoMode ? mockCovenants : (data?.covenants ?? []);

  const filtered = useMemo(() => {
    return allCovenants.filter(c => {
      if (filter !== 'all' && c.overall_status !== filter) return false;
      if (instrFilter && c.instrument_type !== instrFilter) return false;
      if (covenantTypeFilter) {
        if (covenantTypeFilter === 'leverage') {
          if (c.leverage_ratio == null) return false;
        } else if (covenantTypeFilter === 'interest_coverage') {
          if (c.interest_coverage == null) return false;
        } else {
          // reporting obligation type
          if (!c.reporting_obligations.some((o: any) => o.obligation_type === covenantTypeFilter)) return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        return c.deal_name.toLowerCase().includes(q) || c.borrower.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allCovenants, filter, instrFilter, covenantTypeFilter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  const setFilterAndReset = (f: typeof filter) => { setFilter(f); setPage(0); };
  const setSearchAndReset = (s: string) => { setSearch(s); setPage(0); };
  const setInstrAndReset = (s: string) => { setInstrFilter(s); setPage(0); };
  const setCovenantTypeAndReset = (s: string) => { setCovenantTypeFilter(s); setPage(0); };

  // Summary from live or computed from mock
  const summary = useMemo(() => {
    if (!demoMode) return data?.summary;
    return {
      total: allCovenants.length,
      breach: allCovenants.filter(c => c.overall_status === 'breach').length,
      warning: allCovenants.filter(c => c.overall_status === 'warning').length,
      current: allCovenants.filter(c => c.overall_status === 'current').length,
    };
  }, [demoMode, allCovenants, data]);

  const isPageLoading = !demoMode && isLoading;

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Covenant Monitoring</h1>
          <p className="text-gray-500 text-sm mt-1">Financial and reporting covenant compliance across funded positions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setDemoMode(v => !v); setPage(0); setSelected(null); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              demoMode
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            ⚡ {demoMode ? '500 Demo Records' : 'Load 500 Demo'}
          </button>
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            ↓ Export
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <button onClick={() => setFilterAndReset('all')}
          className={`text-left p-4 rounded-xl border-2 transition-all ${filter === 'all' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
          <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Monitored</div>
          <div className="text-3xl font-bold text-gray-900">{summary?.total ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">funded positions</div>
        </button>
        <button onClick={() => setFilterAndReset('breach')}
          className={`text-left p-4 rounded-xl border-2 transition-all ${filter === 'breach' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-200'}`}>
          <div className="text-xs font-bold uppercase tracking-wide text-red-500 mb-1">Breaches</div>
          <div className="text-3xl font-bold text-red-600">{summary?.breach ?? '—'}</div>
          <div className="text-xs text-red-400 mt-1">require immediate action</div>
        </button>
        <button onClick={() => setFilterAndReset('warning')}
          className={`text-left p-4 rounded-xl border-2 transition-all ${filter === 'warning' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-200'}`}>
          <div className="text-xs font-bold uppercase tracking-wide text-amber-500 mb-1">Warnings</div>
          <div className="text-3xl font-bold text-amber-600">{summary?.warning ?? '—'}</div>
          <div className="text-xs text-amber-400 mt-1">approaching threshold</div>
        </button>
        <button onClick={() => setFilterAndReset('current')}
          className={`text-left p-4 rounded-xl border-2 transition-all ${filter === 'current' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-200'}`}>
          <div className="text-xs font-bold uppercase tracking-wide text-emerald-500 mb-1">Current</div>
          <div className="text-3xl font-bold text-emerald-600">{summary?.current ?? '—'}</div>
          <div className="text-xs text-emerald-400 mt-1">in compliance</div>
        </button>
      </div>

      {/* Filter bar + legend */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search deals or borrowers…"
            value={search}
            onChange={e => setSearchAndReset(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-52"
          />
          <select
            value={covenantTypeFilter}
            onChange={e => setCovenantTypeAndReset(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Covenant Types</option>
            <optgroup label="Financial Covenants">
              <option value="leverage">Leverage (Debt/EBITDA)</option>
              <option value="interest_coverage">Interest Coverage</option>
            </optgroup>
            <optgroup label="Reporting Covenants">
              <option value="monthly_financials">Monthly Financials</option>
              <option value="quarterly_financials">Quarterly Financials</option>
              <option value="annual_audit">Annual Audit</option>
              <option value="compliance_certificate">Compliance Certificate</option>
            </optgroup>
          </select>
          <select
            value={instrFilter}
            onChange={e => setInstrAndReset(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Instruments</option>
            <option value="first_lien">First Lien</option>
            <option value="second_lien">Second Lien</option>
            <option value="mezzanine">Mezzanine</option>
            <option value="equity_co_invest">Equity Co-Invest</option>
          </select>
          {(search || instrFilter || covenantTypeFilter || filter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setInstrFilter(''); setCovenantTypeFilter(''); setFilter('all'); setPage(0); }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="flex gap-5 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>Lev &lt; 4.5x · Cov &gt; 2.0x</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span>Lev 4.5–5.25x · Cov 1.75–2.0x</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span>Lev &gt; 5.25x · Cov &lt; 1.75x</span>
        </div>
      </div>

      {isPageLoading ? (
        <div className="card p-12 text-center text-gray-400">Loading covenant data…</div>
      ) : (
        <div className="flex gap-5">
          {/* Main table */}
          <div className="flex-1 min-w-0 card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Deal / Borrower</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-500">Drawn</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Leverage</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Int. Coverage</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Reporting</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">As Of</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No positions match this filter</td></tr>
                  ) : paginated.map(c => (
                    <tr
                      key={c.deal_id}
                      onClick={() => setSelected(selected?.deal_id === c.deal_id ? null : c)}
                      className={`cursor-pointer transition-colors hover:bg-gray-50 ${selected?.deal_id === c.deal_id ? 'bg-blue-50' : ''} ${c.overall_status === 'breach' ? 'border-l-4 border-l-red-400' : c.overall_status === 'warning' ? 'border-l-4 border-l-amber-400' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/covenants/${c.deal_id}`}
                          state={demoMode ? { covenant: c } : undefined}
                          onClick={e => e.stopPropagation()}
                          className="font-semibold text-gray-900 hover:text-blue-600 transition-colors leading-tight block"
                        >
                          {c.deal_name}
                        </Link>
                        <div className="text-xs text-gray-400 mt-0.5">{c.borrower}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${INSTRUMENT_COLORS[c.instrument_type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {INSTRUMENT_LABELS[c.instrument_type] ?? c.instrument_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(c.drawn_amount)}</td>
                      <MetricCell value={c.leverage_ratio} formatted={fmtX(c.leverage_ratio)} status={c.leverage_status} threshold={c.leverage_threshold} label="leverage" />
                      <MetricCell value={c.interest_coverage} formatted={fmtX(c.interest_coverage)} status={c.icov_status} threshold={c.icov_threshold} label="coverage" />
                      <td className="px-4 py-3">
                        <StatusBadge status={c.reporting_status} />
                        {covenantTypeFilter && !['leverage', 'interest_coverage'].includes(covenantTypeFilter) ? (
                          <div className="text-xs text-indigo-600 font-medium mt-0.5 capitalize">
                            {covenantTypeFilter.replace(/_/g, ' ')}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 mt-0.5">{c.reporting_obligations.length} obligation{c.reporting_obligations.length !== 1 ? 's' : ''}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(c.period_end_date)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.overall_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                <p className="text-xs text-gray-500">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} positions
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(0)} disabled={page === 0}
                    className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100">«</button>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100">‹</button>
                  {/* Page number pills */}
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 7) pageNum = i;
                    else if (page < 4) pageNum = i;
                    else if (page > totalPages - 5) pageNum = totalPages - 7 + i;
                    else pageNum = page - 3 + i;
                    return (
                      <button key={pageNum} onClick={() => setPage(pageNum)}
                        className={`px-2.5 py-1 text-xs rounded border ${page === pageNum ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 hover:bg-gray-100'}`}>
                        {pageNum + 1}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100">›</button>
                  <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                    className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100">»</button>
                </div>
              </div>
            )}
          </div>

          {/* Detail drawer */}
          {selected && (
            <div className="w-80 flex-shrink-0 card p-5 self-start sticky top-6">
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0 pr-2">
                  <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{selected.deal_name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{selected.borrower}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0">×</button>
              </div>

              <StatusBadge status={selected.overall_status} />

              {/* Key metrics */}
              <div className="mt-4 space-y-1">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Financial Covenants</div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Leverage (Debt/EBITDA)</span>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${selected.leverage_status === 'breach' ? 'text-red-600' : selected.leverage_status === 'warning' ? 'text-amber-600' : 'text-gray-900'}`}>
                      {fmtX(selected.leverage_ratio)}
                    </span>
                    {selected.leverage_threshold && <div className="text-xs text-gray-400">max {selected.leverage_threshold}x</div>}
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Interest Coverage</span>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${selected.icov_status === 'breach' ? 'text-red-600' : selected.icov_status === 'warning' ? 'text-amber-600' : 'text-gray-900'}`}>
                      {fmtX(selected.interest_coverage)}
                    </span>
                    {selected.icov_threshold && <div className="text-xs text-gray-400">min {selected.icov_threshold}x</div>}
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">EBITDA</span>
                  <span className="text-sm font-semibold text-gray-900">{fmt(selected.ebitda)}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Revenue</span>
                  <span className="text-sm font-semibold text-gray-900">{fmt(selected.revenue)}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Drawn</span>
                  <span className="text-sm font-semibold text-gray-900">{fmt(selected.drawn_amount)}</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-500">As of</span>
                  <span className="text-xs text-gray-700">{fmtDate(selected.period_end_date)}</span>
                </div>
              </div>

              {/* Reporting obligations */}
              {selected.reporting_obligations.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Reporting Obligations</div>
                  <div className="space-y-2">
                    {selected.reporting_obligations.map((r, i) => (
                      <div key={i} className="flex items-start justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <div>
                          <div className="text-xs font-medium text-gray-700 capitalize">
                            {r.obligation_type.replace(/_/g, ' ')}
                          </div>
                          <div className="text-xs text-gray-400">{r.frequency} · {r.days_after_period_end}d after period</div>
                        </div>
                        <StatusBadge status={r.status === 'overdue' ? 'breach' : 'current'} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <Link
                  to={`/covenants/${selected.deal_id}`}
                  state={demoMode ? { covenant: selected } : undefined}
                  className="block w-full text-center py-2 px-4 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  View Full Detail →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
