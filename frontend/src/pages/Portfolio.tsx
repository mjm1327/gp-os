import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { getPortfolioOverview, getPositions, analyzePortfolio } from '../api';
import Layout from '../components/Layout';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, suffix = 'M', decimals = 1) {
  if (n == null) return '—';
  return `$${(n / 1_000_000).toFixed(decimals)}${suffix}`;
}
function fmtB(n: number) { return `$${(n / 1_000_000_000).toFixed(2)}B`; }
function fmtPct(n: number | null | undefined, decimals = 2) {
  if (n == null) return '—';
  return `${(n * 100).toFixed(decimals)}%`;
}
function fmtX(n: number | null | undefined) {
  if (n == null) return '—';
  return `${n.toFixed(1)}x`;
}

// ─── Mock Data Generator ───────────────────────────────────────────────────────
const SECTORS = [
  { name: 'Technology', color: '#3b82f6', weight: 0.22 },
  { name: 'Healthcare', color: '#10b981', weight: 0.16 },
  { name: 'Consumer & Retail', color: '#f59e0b', weight: 0.14 },
  { name: 'Industrials', color: '#6366f1', weight: 0.12 },
  { name: 'Real Estate', color: '#ec4899', weight: 0.09 },
  { name: 'Energy & Utilities', color: '#f97316', weight: 0.08 },
  { name: 'Financial Services', color: '#14b8a6', weight: 0.08 },
  { name: 'Media & Telecom', color: '#8b5cf6', weight: 0.07 },
  { name: 'Education', color: '#84cc16', weight: 0.04 },
];

const GEOGRAPHIES = [
  { country: 'United States', code: 'US', region: 'North America', x: 195, y: 165, weight: 0.38 },
  { country: 'United Kingdom', code: 'GB', region: 'Europe', x: 435, y: 120, weight: 0.14 },
  { country: 'Canada', code: 'CA', region: 'North America', x: 185, y: 120, weight: 0.08 },
  { country: 'Germany', code: 'DE', region: 'Europe', x: 465, y: 118, weight: 0.07 },
  { country: 'France', code: 'FR', region: 'Europe', x: 448, y: 128, weight: 0.05 },
  { country: 'Australia', code: 'AU', region: 'Asia Pacific', x: 680, y: 275, weight: 0.05 },
  { country: 'Netherlands', code: 'NL', region: 'Europe', x: 456, y: 114, weight: 0.04 },
  { country: 'Sweden', code: 'SE', region: 'Europe', x: 470, y: 102, weight: 0.03 },
  { country: 'Japan', code: 'JP', region: 'Asia Pacific', x: 700, y: 148, weight: 0.03 },
  { country: 'India', code: 'IN', region: 'Asia Pacific', x: 605, y: 178, weight: 0.03 },
  { country: 'Brazil', code: 'BR', region: 'Latin America', x: 265, y: 248, weight: 0.03 },
  { country: 'Singapore', code: 'SG', region: 'Asia Pacific', x: 656, y: 210, weight: 0.02 },
  { country: 'Ireland', code: 'IE', region: 'Europe', x: 425, y: 117, weight: 0.02 },
  { country: 'Spain', code: 'ES', region: 'Europe', x: 440, y: 138, weight: 0.01 },
];

const INSTRUMENT_TYPES = [
  { type: 'first_lien', weight: 0.5 },
  { type: 'second_lien', weight: 0.15 },
  { type: 'mezzanine', weight: 0.2 },
  { type: 'equity_co_invest', weight: 0.15 },
];

const COMPANY_PREFIXES = [
  'Apex', 'Summit', 'Nexus', 'Vertex', 'Horizon', 'Atlas', 'Titan', 'Pinnacle', 'Vector', 'Quantum',
  'Crest', 'Meridian', 'Zenith', 'Orbit', 'Ridge', 'Peak', 'Arc', 'Core', 'Prime', 'Volt',
  'Flux', 'Wave', 'Craft', 'Nova', 'Pulse', 'Forge', 'Bridge', 'Shield', 'Trident', 'Beacon',
  'Eagle', 'Falcon', 'Griffin', 'Hawk', 'Raven', 'Osprey', 'Lark', 'Kite', 'Swift', 'Heron',
];

const COMPANY_SUFFIXES_BY_SECTOR: Record<string, string[]> = {
  'Technology': ['Labs', 'Systems', 'Tech', 'Digital', 'Cloud', 'AI', 'Networks', 'Platforms', 'Analytics', 'Solutions'],
  'Healthcare': ['Health', 'Bio', 'Medical', 'Pharma', 'Therapeutics', 'Diagnostics', 'Care', 'Sciences', 'Wellness', 'Rx'],
  'Consumer & Retail': ['Brands', 'Retail', 'Commerce', 'Direct', 'Foods', 'Beauty', 'Lifestyle', 'Home', 'Goods', 'Market'],
  'Industrials': ['Industries', 'Manufacturing', 'Logistics', 'Engineering', 'Automation', 'Industrial', 'Works', 'Supply', 'Operations', 'Corp'],
  'Real Estate': ['Properties', 'Realty', 'Development', 'REIT', 'Capital', 'Equity', 'Assets', 'Holdings', 'Group', 'Fund'],
  'Energy & Utilities': ['Energy', 'Power', 'Resources', 'Renewables', 'Utilities', 'Gas', 'Petroleum', 'Solar', 'Wind', 'Grid'],
  'Financial Services': ['Financial', 'Capital', 'Partners', 'Asset Management', 'Advisors', 'Wealth', 'Ventures', 'Credit', 'Finance', 'Funding'],
  'Media & Telecom': ['Media', 'Communications', 'Broadcasting', 'Telecom', 'Publishing', 'Entertainment', 'Studios', 'Networks', 'Digital', 'Content'],
  'Education': ['Education', 'Learning', 'Academy', 'Institute', 'EdTech', 'Training', 'Skills', 'Campus', 'Knowledge', 'Scholars'],
};

const FUND_NAMES = [
  { id: 101, name: 'Stonecrest Direct Lending Fund III' },
  { id: 102, name: 'Stonecrest Growth Equity Fund I' },
  { id: 103, name: 'Stonecrest Mezzanine Fund II' },
  { id: 104, name: 'Stonecrest Opportunistic Credit Fund I' },
];

function pickWeighted<T extends { weight: number }>(arr: T[], rand: number): T {
  let cumulative = 0;
  for (const item of arr) {
    cumulative += item.weight;
    if (rand < cumulative) return item;
  }
  return arr[arr.length - 1];
}

function seededRand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateMockPositions(count: number) {
  const positions: any[] = [];
  const numCompanies = Math.ceil(count * 0.5);
  const companies: any[] = [];

  for (let c = 0; c < numCompanies; c++) {
    const r1 = seededRand(c * 7 + 1);
    const r2 = seededRand(c * 7 + 2);
    const sector = pickWeighted(SECTORS, r1);
    const prefix = COMPANY_PREFIXES[Math.floor(r2 * COMPANY_PREFIXES.length)];
    const suffixes = COMPANY_SUFFIXES_BY_SECTOR[sector.name] || ['Corp'];
    const suffix = suffixes[Math.floor(seededRand(c * 7 + 3) * suffixes.length)];
    const geo = pickWeighted(GEOGRAPHIES, seededRand(c * 7 + 4));
    companies.push({ id: c, name: `${prefix}${suffix}`, sector: sector.name, geo });
  }

  let posId = 1000;
  let ci = 0;

  while (positions.length < count) {
    const company = companies[ci % companies.length];
    ci++;
    const r = seededRand(ci * 13 + 5);
    const numTranches = r < 0.6 ? 1 : r < 0.82 ? 2 : r < 0.94 ? 3 : 4;
    const tranchesNeeded = Math.min(numTranches, count - positions.length);

    for (let t = 0; t < tranchesNeeded; t++) {
      const instrType = pickWeighted(INSTRUMENT_TYPES, seededRand(posId * 3 + t));
      const fund = FUND_NAMES[Math.floor(seededRand(posId * 5) * FUND_NAMES.length)];
      const drawn = Math.round((seededRand(posId * 7 + 1) * 140 + 10) * 10) * 100_000;
      const undrawn = seededRand(posId * 7 + 2) > 0.6 ? Math.round(seededRand(posId * 7 + 3) * 20 * 10) * 100_000 : 0;
      const fairValue = drawn * (0.92 + seededRand(posId * 7 + 4) * 0.2);
      const baseYield = instrType.type === 'first_lien' ? 0.075 : instrType.type === 'second_lien' ? 0.095 : instrType.type === 'mezzanine' ? 0.115 : 0.14;
      const leveredYield = instrType.type === 'equity_co_invest' ? null : baseYield + seededRand(posId) * 0.03;
      const advRate = instrType.type === 'equity_co_invest' ? null : 0.8 + seededRand(posId * 2) * 0.18;
      const leverage = instrType.type === 'equity_co_invest' ? null : 2.5 + seededRand(posId * 3) * 3.0;
      const coverage = instrType.type === 'equity_co_invest' ? null : 1.5 + seededRand(posId * 4) * 2.5;
      const daysAgo = Math.floor(seededRand(posId * 11) * 90);
      const updatedAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
      const trancheSuffix = numTranches > 1
        ? ` – ${instrType.type === 'first_lien' ? 'TLA' : instrType.type === 'second_lien' ? 'TLB' : instrType.type === 'mezzanine' ? 'Mezz' : 'Co-Inv'}`
        : ' Facility';

      positions.push({
        id: posId,
        deal_name: `${company.name}${trancheSuffix}`,
        borrower_entity_name: `${company.name} Holdings LLC`,
        company_name: company.name,
        company_id: company.id,
        fund_name: fund.name,
        fund_id: fund.id,
        instrument_type: instrType.type,
        sector: company.sector,
        geography: company.geo.country,
        geography_region: company.geo.region,
        drawn_amount: drawn,
        undrawn_amount: undrawn,
        fair_value: fairValue,
        levered_yield: leveredYield,
        advance_rate: advRate,
        latest_leverage: leverage,
        latest_coverage: coverage,
        reporting_status: daysAgo > 60 ? 'overdue' : 'current',
        updated_at: updatedAt,
      });
      posId++;
    }
  }

  return positions.slice(0, count);
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function InstrumentBadge({ type }: { type?: string }) {
  const map: Record<string, string> = {
    first_lien: 'bg-blue-100 text-blue-800',
    second_lien: 'bg-purple-100 text-purple-800',
    mezzanine: 'bg-amber-100 text-amber-800',
    equity_co_invest: 'bg-green-100 text-green-800',
  };
  const label: Record<string, string> = {
    first_lien: '1L', second_lien: '2L', mezzanine: 'Mezz', equity_co_invest: 'Equity',
  };
  const cls = map[type ?? ''] ?? 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {label[type ?? ''] ?? type ?? '—'}
    </span>
  );
}

function StalenessTag({ updatedAt }: { updatedAt?: string }) {
  if (!updatedAt) return <span className="text-xs text-gray-400">—</span>;
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  const label = days === 0 ? 'Today' : days === 1 ? '1d ago' : `${days}d ago`;
  const cls = days < 30 ? 'bg-green-100 text-green-700' : days < 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}

function ReportingBadge({ status }: { status?: string }) {
  if (status === 'current') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>Current
    </span>
  );
  if (status === 'overdue') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>Overdue
    </span>
  );
  return <span className="text-xs text-gray-400">—</span>;
}

// ─── Sector Allocation Chart ───────────────────────────────────────────────────
function SectorAllocationChart({ positions }: { positions: any[] }) {
  const data = useMemo(() => {
    const bySector: Record<string, number> = {};
    for (const p of positions) {
      const sec = p.sector || 'Other';
      bySector[sec] = (bySector[sec] || 0) + (p.drawn_amount || 0);
    }
    const total = Object.values(bySector).reduce((a, b) => a + b, 0);
    return Object.entries(bySector)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? (value / total * 100).toFixed(1) : '0',
        color: SECTORS.find(s => s.name === name)?.color || '#94a3b8',
      }));
  }, [positions]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold text-gray-900">{d.name}</p>
          <p className="text-gray-600">{fmt(d.value)} drawn ({d.pct}%)</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card p-5 mb-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Sector Allocation</h3>
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div style={{ width: 240, height: 240 }} className="flex-shrink-0 mx-auto lg:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={105} paddingAngle={2} dataKey="value">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }}></span>
              <span className="text-sm text-gray-700 flex-1 truncate">{d.name}</span>
              <span className="text-sm font-semibold text-gray-900">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Geographic Bubble Map ─────────────────────────────────────────────────────
function GeographicMap({ positions: _positions }: { positions: any[] }) {
  return (
    <div style={{ height: 'calc(100vh - 320px)', minHeight: 500, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <iframe
        src="/portfolio_map.html"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="Portfolio Geographic Map"
      />
    </div>
  );
}

// ─── Multi-Deal Company Chart ──────────────────────────────────────────────────
function CompanyDealsChart({ positions }: { positions: any[] }) {
  const data = useMemo(() => {
    const byCompany: Record<string, Record<string, number>> = {};
    for (const p of positions) {
      const name = p.company_name || p.borrower_entity_name || p.deal_name;
      if (!byCompany[name]) byCompany[name] = {};
      const type = p.instrument_type || 'other';
      byCompany[name][type] = (byCompany[name][type] || 0) + (p.drawn_amount || 0);
    }
    return Object.entries(byCompany)
      .filter(([, t]) => Object.keys(t).length >= 2)
      .map(([name, tranches]) => ({
        name: name.length > 22 ? name.slice(0, 20) + '…' : name,
        total: Object.values(tranches).reduce((a, b) => a + b, 0),
        first_lien: (tranches['first_lien'] || 0) / 1_000_000,
        second_lien: (tranches['second_lien'] || 0) / 1_000_000,
        mezzanine: (tranches['mezzanine'] || 0) / 1_000_000,
        equity_co_invest: (tranches['equity_co_invest'] || 0) / 1_000_000,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [positions]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold text-gray-900 mb-1">{label}</p>
          {payload.filter((p: any) => p.value > 0).map((p: any) => (
            <p key={p.name} style={{ color: p.fill }} className="text-xs">
              {p.name.replace(/_/g, ' ')}: ${p.value.toFixed(0)}M
            </p>
          ))}
          <p className="text-gray-800 font-semibold border-t pt-1 mt-1 text-xs">Total: ${total.toFixed(0)}M</p>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="card p-5 mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Multi-Tranche Companies</h3>
        <p className="text-sm text-gray-500">No companies with multiple tranches found in this view.</p>
      </div>
    );
  }

  return (
    <div className="card p-5 mb-6">
      <h3 className="text-base font-semibold text-gray-900 mb-1">Multi-Tranche Companies</h3>
      <p className="text-xs text-gray-500 mb-4">Companies with 2+ deal tranches — top 15 by total drawn capital ($M)</p>
      <div style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" tickFormatter={(v) => `$${v.toFixed(0)}M`} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={115} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v.replace(/_/g, ' ')} />
            <Bar dataKey="first_lien" name="first_lien" stackId="a" fill="#3b82f6" />
            <Bar dataKey="second_lien" name="second_lien" stackId="a" fill="#8b5cf6" />
            <Bar dataKey="mezzanine" name="mezzanine" stackId="a" fill="#f59e0b" />
            <Bar dataKey="equity_co_invest" name="equity_co_invest" stackId="a" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Suggested AI Questions ────────────────────────────────────────────────────
const SUGGESTED_QUESTIONS = [
  'Which positions have the lowest advance rates and should be prioritized for trimming?',
  'Give me a pro forma levered yield if we reduce the top 3 positions by 25%',
  'Which borrowers have the weakest interest coverage ratios?',
  'Summarize the credit quality of the portfolio and flag any concerns',
];

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

// ─── Main Component ────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;

export default function Portfolio() {
  const [selectedFundId, setSelectedFundId] = useState<number | undefined>(undefined);
  const [demoMode, setDemoMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'sectors' | 'geography' | 'companies'>('table');
  const [page, setPage] = useState(0);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: overviewRes } = useQuery({
    queryKey: ['portfolio-overview'],
    queryFn: getPortfolioOverview,
    enabled: !demoMode,
  });

  const { data: positionsRes, isLoading: liveLoading } = useQuery({
    queryKey: ['positions', selectedFundId],
    queryFn: () => getPositions(selectedFundId),
    enabled: !demoMode,
  });

  const mockPositions = useMemo(() => demoMode ? generateMockPositions(500) : [], [demoMode]);
  const allPositions = demoMode ? mockPositions : (positionsRes?.data || []);
  const overview = overviewRes?.data;
  const liveFunds = overview?.by_fund || [];
  const liveSummary = overview?.summary || {};
  const isLoading = !demoMode && liveLoading;

  const filteredPositions = useMemo(() => {
    if (selectedFundId === undefined) return allPositions;
    return allPositions.filter((p: any) => p.fund_id === selectedFundId);
  }, [allPositions, selectedFundId]);

  const demoSummary = useMemo(() => {
    if (!demoMode) return null;
    const fp = filteredPositions;
    const drawn = fp.reduce((s: number, p: any) => s + (p.drawn_amount || 0), 0);
    const undrawn = fp.reduce((s: number, p: any) => s + (p.undrawn_amount || 0), 0);
    const withYield = fp.filter((p: any) => p.levered_yield);
    const waYield = withYield.length > 0
      ? withYield.reduce((s: number, p: any) => s + p.levered_yield * p.drawn_amount, 0) /
        withYield.reduce((s: number, p: any) => s + p.drawn_amount, 0)
      : null;
    const withAdv = fp.filter((p: any) => p.advance_rate);
    const waAdv = withAdv.length > 0
      ? withAdv.reduce((s: number, p: any) => s + p.advance_rate * p.drawn_amount, 0) /
        withAdv.reduce((s: number, p: any) => s + p.drawn_amount, 0)
      : null;
    return {
      total_drawn: drawn,
      total_undrawn: undrawn,
      funded_positions: fp.filter((p: any) => p.drawn_amount > 0).length,
      positions_with_undrawn: fp.filter((p: any) => p.undrawn_amount > 0).length,
      wa_yield: waYield,
      wa_advance_rate: waAdv,
    };
  }, [filteredPositions, demoMode]);

  const displaySummary = demoMode ? (demoSummary || {}) : liveSummary;

  const demoFunds = FUND_NAMES.map(f => ({
    fund_id: f.id,
    fund_name: f.name,
    position_count: allPositions.filter((p: any) => p.fund_id === f.id).length,
  }));
  const displayFunds = demoMode ? demoFunds : liveFunds;

  const paginatedPositions = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredPositions.slice(start, start + PAGE_SIZE);
  }, [filteredPositions, page]);

  const totalPages = Math.ceil(filteredPositions.length / PAGE_SIZE);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);
  useEffect(() => { setPage(0); }, [selectedFundId, demoMode]);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('anthropic_api_key', key);
    setShowApiKeyInput(false);
  };

  const handleAnalyze = async (q?: string) => {
    const text = (q || question).trim();
    if (!text) return;
    if (!apiKey) { setShowApiKeyInput(true); return; }
    setChatHistory(prev => [...prev, { role: 'user', content: text }]);
    setQuestion('');
    setIsAnalyzing(true);
    setAnalyzeError('');
    try {
      const res = await analyzePortfolio(text, apiKey, selectedFundId);
      setChatHistory(prev => [...prev, { role: 'assistant', content: res.data.analysis }]);
    } catch (err: any) {
      setAnalyzeError(err?.response?.data?.error || 'Analysis failed. Check your API key.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Portfolio Monitoring</h1>
          <p className="text-gray-600 mt-1">Active positions, credit metrics, and AI portfolio analysis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setDemoMode(!demoMode); setSelectedFundId(undefined); setPage(0); }}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              demoMode
                ? 'border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100'
                : 'border-gray-300 text-gray-600 bg-white hover:bg-gray-50'
            }`}
          >
            {demoMode ? '⚡ 500-Position Demo ON' : '⚡ Load 500 Demo Positions'}
          </button>
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              apiKey ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100' : 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            {apiKey ? '🔑 AI Connected' : '🔑 Connect AI'}
          </button>
        </div>
      </div>

      {/* Demo Banner */}
      {demoMode && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-3">
          <span className="text-purple-500 text-lg flex-shrink-0">⚡</span>
          <div>
            <p className="text-sm font-medium text-purple-900">Scale Demo: 500 Synthetic Positions</p>
            <p className="text-xs text-purple-600">Realistic mock data generated client-side for UI stress-testing. All values are synthetic.</p>
          </div>
        </div>
      )}

      {/* API Key Input */}
      {showApiKeyInput && (
        <div className="card p-4 mb-6 border-l-4 border-blue-400">
          <p className="text-sm font-medium text-gray-900 mb-2">Anthropic API Key</p>
          <p className="text-xs text-gray-500 mb-3">Required for AI Portfolio Analyst. Stored in your browser only.</p>
          <div className="flex gap-2">
            <input type="password" className="form-input flex-1 text-sm" placeholder="sk-ant-..." defaultValue={apiKey}
              onKeyDown={e => e.key === 'Enter' && saveApiKey((e.target as HTMLInputElement).value)} />
            <button className="btn-primary text-sm px-4"
              onClick={(e) => {
                const input = (e.target as HTMLElement).closest('.card')?.querySelector('input') as HTMLInputElement;
                if (input) saveApiKey(input.value);
              }}>Save</button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Drawn Capital</p>
          <p className="text-2xl font-bold text-gray-900">
            {displaySummary.total_drawn != null ? fmtB(displaySummary.total_drawn) : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">{displaySummary.funded_positions || 0} funded positions</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Undrawn Commitments</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(displaySummary.total_undrawn)}</p>
          <p className="text-xs text-gray-500 mt-1">{displaySummary.positions_with_undrawn || 0} positions</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">WA Levered Yield</p>
          <p className="text-2xl font-bold text-blue-600">{fmtPct(displaySummary.wa_yield)}</p>
          <p className="text-xs text-gray-500 mt-1">Across funded positions</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">WA Advance Rate</p>
          <p className="text-2xl font-bold text-gray-900">{fmtPct(displaySummary.wa_advance_rate, 0)}</p>
          <p className="text-xs text-gray-500 mt-1">Leverage provider advance rate</p>
        </div>
      </div>

      {/* Fund Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => { setSelectedFundId(undefined); setPage(0); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedFundId === undefined ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          All Funds
        </button>
        {displayFunds.map((f: any) => (
          <button key={f.fund_id}
            onClick={() => { setSelectedFundId(f.fund_id); setPage(0); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedFundId === f.fund_id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {f.fund_name.replace('Stonecrest ', '').replace(' Fund', ' Fd')}
            <span className="ml-2 text-xs opacity-70">{f.position_count}</span>
          </button>
        ))}
      </div>

      {/* Analytics Tab Bar */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'table', label: `Positions (${filteredPositions.length})` },
          { id: 'sectors', label: 'Sector Allocation' },
          { id: 'geography', label: 'Geography' },
          { id: 'companies', label: 'Company Groups' },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {activeTab === 'sectors' && <SectorAllocationChart positions={filteredPositions} />}
      {activeTab === 'geography' && <GeographicMap positions={filteredPositions} />}
      {activeTab === 'companies' && <CompanyDealsChart positions={filteredPositions} />}

      {activeTab === 'table' && (
        <div className="card mb-6 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">Loading positions...</div>
          ) : filteredPositions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No positions found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Deal / Borrower</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                      {demoMode && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sector</th>}
                      {demoMode && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Country</th>}
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Drawn</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Undrawn</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Fair Value</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Lev. Yield</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Adv. Rate</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Leverage</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Coverage</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reporting</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedPositions.map((p: any) => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          {demoMode ? (
                            <div>
                              <p className="font-medium text-gray-900 leading-tight">{p.deal_name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{p.borrower_entity_name}</p>
                              {selectedFundId === undefined && <p className="text-xs text-gray-400 mt-0.5">{p.fund_name}</p>}
                            </div>
                          ) : (
                            <Link to={`/portfolio/positions/${p.id}`} className="group">
                              <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors leading-tight">{p.deal_name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{p.borrower_entity_name}</p>
                              {selectedFundId === undefined && <p className="text-xs text-gray-400 mt-0.5">{p.fund_name}</p>}
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-3"><InstrumentBadge type={p.instrument_type} /></td>
                        {demoMode && (
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium" style={{ color: SECTORS.find(s => s.name === p.sector)?.color || '#6b7280' }}>
                              {p.sector || '—'}
                            </span>
                          </td>
                        )}
                        {demoMode && <td className="px-4 py-3 text-xs text-gray-600">{p.geography || '—'}</td>}
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(p.drawn_amount)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(p.undrawn_amount)}</td>
                        <td className="px-4 py-3 text-right text-blue-700 font-medium">{fmt(p.fair_value)}</td>
                        <td className="px-4 py-3 text-right">
                          {p.levered_yield ? <span className="font-semibold text-gray-900">{fmtPct(p.levered_yield)}</span> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.advance_rate
                            ? <span className={`font-medium ${p.advance_rate < 0.87 ? 'text-amber-600' : 'text-gray-700'}`}>{fmtPct(p.advance_rate, 0)}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.latest_leverage
                            ? <span className={`font-medium ${p.latest_leverage > 4.5 ? 'text-red-600' : p.latest_leverage > 4.0 ? 'text-amber-600' : 'text-gray-700'}`}>{fmtX(p.latest_leverage)}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {p.latest_coverage
                            ? <span className={`font-medium ${p.latest_coverage < 2.0 ? 'text-amber-600' : 'text-gray-700'}`}>{fmtX(p.latest_coverage)}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3"><ReportingBadge status={p.reporting_status} /></td>
                        <td className="px-4 py-3"><StalenessTag updatedAt={p.updated_at} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredPositions.length)} of {filteredPositions.length} positions
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(0)} disabled={page === 0}
                      className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100">«</button>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100">‹ Prev</button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                      const pg = start + i;
                      return (
                        <button key={pg} onClick={() => setPage(pg)}
                          className={`px-3 py-1 text-xs rounded border transition-colors ${pg === page ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 hover:bg-gray-100'}`}>
                          {pg + 1}
                        </button>
                      );
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100">Next ›</button>
                    <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
                      className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100">»</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* AI Portfolio Analyst */}
      <div className="card overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">AI</div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Portfolio Analyst</h2>
            <p className="text-xs text-gray-500">Ask anything about your portfolio — yields, leverage, concentration, trim candidates</p>
          </div>
        </div>

        {chatHistory.length === 0 && (
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-3">Suggested questions</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button key={q} onClick={() => handleAnalyze(q)} disabled={isAnalyzing}
                  className="text-left text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-2 transition-colors disabled:opacity-50">{q}</button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.length > 0 && (
          <div className="px-6 py-4 max-h-96 overflow-y-auto space-y-4">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">AI</div>
                )}
                <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-50 border border-gray-200 text-gray-800'}`}>
                  <pre className="whitespace-pre-wrap font-sans leading-relaxed">{msg.content}</pre>
                </div>
              </div>
            ))}
            {isAnalyzing && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AI</div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {analyzeError && (
          <div className="mx-6 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{analyzeError}</div>
        )}

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="flex gap-3">
            <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAnalyze()}
              placeholder="Ask about your portfolio... (e.g. Which positions should we trim?)"
              className="form-input flex-1 text-sm" disabled={isAnalyzing} />
            <button onClick={() => handleAnalyze()} disabled={isAnalyzing || !question.trim()}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {isAnalyzing ? 'Analyzing...' : 'Ask'}
            </button>
            {chatHistory.length > 0 && (
              <button onClick={() => setChatHistory([])}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg bg-white">Clear</button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
