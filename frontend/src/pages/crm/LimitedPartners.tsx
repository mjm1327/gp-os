import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getLimitedPartners } from '../../api';
import Layout from '../../components/Layout';
import { LimitedPartner } from '../../types';

// ─── Demo Data Generator ──────────────────────────────────────────────────────

const LP_TYPES = ['pension', 'endowment', 'family_office', 'sovereign_wealth', 'foundation', 'insurance', 'fund_of_funds'] as const;
const STATUSES = ['prospect', 'active', 'closed'] as const;

const INSTITUTIONS = [
  // Pensions
  'CalPERS', 'CalSTRS', 'NYCERS', 'NYCTRS', 'STRS Ohio', 'TRS Texas', 'PERA Colorado', 'LACERA',
  'Virginia Retirement System', 'Pennsylvania PSERS', 'New York State Common', 'Illinois TRS',
  'Washington State Investment Board', 'Oregon PERS', 'Maryland State Retirement', 'INPRS',
  'TMRS', 'Florida SBA', 'KPERS', 'Missouri PSRS', 'OMERS', 'Ontario Teachers', 'CPPIB',
  'ATP Denmark', 'ABP Netherlands', 'PGGM', 'USS UK', 'CDPQ', 'BCI Canada',
  // Endowments
  'Harvard Management Company', 'Yale Investments Office', 'MIT Investment Management',
  'Princeton University Endowment', 'Stanford Management Company', 'University of Texas UTIMCO',
  'Duke University Endowment', 'Dartmouth College Endowment', 'Cornell University Endowment',
  'Columbia University Endowment', 'Penn Endowment', 'Michigan Investment Office',
  'Virginia Investment Management', 'Notre Dame Investment Office', 'Vanderbilt Endowment',
  // Sovereign Wealth
  'GIC Singapore', 'Temasek Holdings', 'ADIA Abu Dhabi', 'Mubadala Investment', 'QIA Qatar',
  'NBIM Norway', 'SAMA Saudi Arabia', 'CIC China', 'SAFE China', 'KIA Kuwait', 'PIF Saudi Arabia',
  'ICD Dubai', 'ADIA Investments', 'KKIA Kazakhstan', 'GPFG Norway',
  // Family Offices
  'Bezos Family Office', 'Gates Ventures', 'Walton Enterprises', 'Koch Industries Family',
  'Dell Family Office', 'Ellison Family Trust', 'Bloomberg Family Office', 'Buffett Family Office',
  'Mars Family Office', 'Pritzker Organization', 'Soros Family Office', 'Griffin Family Office',
  'Shaw Family Office', 'Renaissance Family Trust', 'Citadel Family Office',
  'Bridgewater Family Trust', 'DE Shaw Family', 'Two Sigma Family', 'Point72 Family',
  // Foundations
  'Gates Foundation', 'Ford Foundation', 'MacArthur Foundation', 'Rockefeller Foundation',
  'Carnegie Corporation', 'Mellon Foundation', 'Hewlett Foundation', 'Packard Foundation',
  'Kresge Foundation', 'Lumina Foundation', 'Knight Foundation', 'Arnold Foundation',
  'Kauffman Foundation', 'Bloomberg Philanthropies', 'Chan Zuckerberg Initiative',
  // Insurance
  'MetLife Investments', 'Prudential Private Capital', 'TIAA Investments', 'New York Life',
  'Pacific Life Capital', 'Principal Global Investors', 'Lincoln Financial', 'MassMutual Ventures',
  'Northwestern Mutual Capital', 'Guardian Life Investments', 'Nationwide Investments',
  // Fund of Funds
  'Hamilton Lane', 'Adams Street Partners', 'HarbourVest Partners', 'Pantheon Ventures',
  'Portfolio Advisors', 'Abbott Capital', 'Commonfund Capital', 'AlpInvest Partners',
  'LGT Capital Partners', 'Neuberger Berman Private Equity', 'Goldman Sachs AIMS',
  'BlackRock Private Equity', 'Partners Group', 'Pathway Capital', 'Grosvenor Capital',
];

const CITIES = [
  'New York, NY', 'San Francisco, CA', 'Boston, MA', 'Chicago, IL', 'Los Angeles, CA',
  'Austin, TX', 'Houston, TX', 'Denver, CO', 'Seattle, WA', 'Miami, FL',
  'Sacramento, CA', 'Albany, NY', 'Columbus, OH', 'Nashville, TN', 'Atlanta, GA',
  'London, UK', 'Singapore', 'Abu Dhabi, UAE', 'Oslo, Norway', 'Amsterdam, Netherlands',
  'Toronto, Canada', 'Tokyo, Japan', 'Zurich, Switzerland', 'Hong Kong', 'Dubai, UAE',
  'Paris, France', 'Sydney, Australia', 'Stockholm, Sweden', 'Copenhagen, Denmark', 'Riyadh, Saudi Arabia',
];

const RELATIONSHIP_OWNERS = [
  'Sarah Chen', 'Michael Torres', 'James Wilson', 'Emily Nakamura', 'Robert Park',
  'Alexandra Singh', 'David Kim', 'Jennifer Walsh', 'Christopher Lee', 'Amanda Foster',
];

const FUND_NAMES = ['Stonecrest Capital Fund I', 'Stonecrest Capital Fund II', 'Stonecrest Capital Fund III', 'Stonecrest Credit Opportunities'];

function seededRand(seed: number): number {
  return Math.abs(Math.sin(seed) * 10000) - Math.floor(Math.abs(Math.sin(seed) * 10000));
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.floor(seededRand(seed) * arr.length)];
}

interface MockLP {
  id: number;
  name: string;
  type: string;
  status: string;
  aum: number; // in billions
  headquarters: string;
  relationship_owner: string;
  commitment_amount: number | null; // in millions
  invested_to_date: number | null; // in millions
  fund_name: string | null;
  vintage: number | null;
  irr: number | null;
  moic: number | null;
  since_date: string;
  last_contact: string;
  entity_count: number;
  contact_count: number;
}

function generateMockLPs(count: number): MockLP[] {
  const lps: MockLP[] = [];
  const usedNames = new Set<string>();
  let institutionPool = [...INSTITUTIONS];

  for (let i = 0; i < count; i++) {
    const s = (n: number) => seededRand(i * 97 + n);

    // Pick a unique institution name
    let name: string;
    if (institutionPool.length > 0) {
      const idx = Math.floor(s(1) * institutionPool.length);
      name = institutionPool[idx];
      institutionPool.splice(idx, 1);
    } else {
      name = `${pick(['Capital', 'Investment', 'Asset', 'Wealth', 'Portfolio'], i * 3 + 1)} ${pick(['Partners', 'Advisors', 'Management', 'Group', 'Trust'], i * 3 + 2)} ${i}`;
    }
    usedNames.add(name);

    // Status distribution: ~25% prospect, ~50% active, ~25% closed
    const statusRoll = s(3);
    let status: string;
    if (statusRoll < 0.25) status = 'prospect';
    else if (statusRoll < 0.75) status = 'active';
    else status = 'closed';

    // Type based loosely on name patterns
    let type: string;
    if (name.includes('Foundation') || name.includes('Philanthropies')) type = 'foundation';
    else if (name.includes('Endowment') || name.includes('Management Company') || name.includes('Investment Office') || name.includes('Investments Office') || name.includes('UTIMCO')) type = 'endowment';
    else if (name.includes('Family') || name.includes('Ventures') || name.includes('Enterprises') || name.includes('Trust') || name.includes('Organization')) type = 'family_office';
    else if (['GIC', 'Temasek', 'ADIA', 'Mubadala', 'QIA', 'NBIM', 'SAMA', 'CIC', 'SAFE', 'KIA', 'PIF', 'ICD', 'KKIA', 'GPFG'].some(sw => name.includes(sw))) type = 'sovereign_wealth';
    else if (['MetLife', 'Prudential', 'TIAA', 'Pacific Life', 'Principal', 'Lincoln', 'MassMutual', 'Northwestern', 'Guardian', 'Nationwide'].some(ins => name.includes(ins))) type = 'insurance';
    else if (['Hamilton Lane', 'Adams Street', 'HarbourVest', 'Pantheon', 'Abbott', 'Commonfund', 'AlpInvest', 'LGT', 'Neuberger', 'Pathway', 'Grosvenor', 'Goldman Sachs AIMS', 'BlackRock', 'Partners Group', 'Portfolio Advisors'].some(fof => name.includes(fof.split(' ')[0]))) type = 'fund_of_funds';
    else {
      // Remaining: pension or random
      const typeRoll = s(4);
      if (typeRoll < 0.35) type = 'pension';
      else type = pick(LP_TYPES, i * 7 + 4);
    }

    // AUM by type
    let aumMin: number, aumMax: number;
    switch (type) {
      case 'sovereign_wealth': aumMin = 100; aumMax = 800; break;
      case 'pension': aumMin = 20; aumMax = 350; break;
      case 'endowment': aumMin = 5; aumMax = 50; break;
      case 'fund_of_funds': aumMin = 10; aumMax = 120; break;
      case 'insurance': aumMin = 30; aumMax = 200; break;
      case 'family_office': aumMin = 1; aumMax = 40; break;
      case 'foundation': aumMin = 2; aumMax = 60; break;
      default: aumMin = 5; aumMax = 80;
    }
    const aum = parseFloat((aumMin + s(5) * (aumMax - aumMin)).toFixed(1));

    // Commitment and investment data for active/closed
    let commitment_amount: number | null = null;
    let invested_to_date: number | null = null;
    let fund_name: string | null = null;
    let vintage: number | null = null;
    let irr: number | null = null;
    let moic: number | null = null;

    if (status === 'active' || status === 'closed') {
      // Commitment: typically 0.5–3% of AUM
      const commitPct = 0.005 + s(6) * 0.025;
      commitment_amount = parseFloat((aum * 1000 * commitPct).toFixed(1)); // in millions

      if (status === 'active') {
        // Invested 20–90% of commitment
        const drawPct = 0.2 + s(7) * 0.7;
        invested_to_date = parseFloat((commitment_amount * drawPct).toFixed(1));
        irr = parseFloat((8 + s(8) * 18).toFixed(1)); // 8–26%
        moic = parseFloat((1.1 + s(9) * 0.8).toFixed(2)); // 1.1–1.9x
      } else {
        // Closed: fully deployed, higher returns
        invested_to_date = commitment_amount;
        irr = parseFloat((12 + s(8) * 20).toFixed(1)); // 12–32%
        moic = parseFloat((1.6 + s(9) * 1.2).toFixed(2)); // 1.6–2.8x
      }

      fund_name = pick(FUND_NAMES, i * 13 + 10);
      vintage = 2015 + Math.floor(s(11) * 9); // 2015–2023
    }

    // Dates
    const daysAgo = Math.floor(s(12) * 1000);
    const sinceDate = new Date(Date.now() - daysAgo * 86400000);
    const lastContactDays = Math.floor(s(13) * 180);
    const lastContact = new Date(Date.now() - lastContactDays * 86400000);

    lps.push({
      id: i + 1000,
      name,
      type,
      status,
      aum,
      headquarters: pick(CITIES, i * 5 + 14),
      relationship_owner: pick(RELATIONSHIP_OWNERS, i * 3 + 15),
      commitment_amount,
      invested_to_date,
      fund_name,
      vintage,
      irr,
      moic,
      since_date: sinceDate.toISOString().split('T')[0],
      last_contact: lastContact.toISOString().split('T')[0],
      entity_count: Math.floor(s(16) * 5) + 1,
      contact_count: Math.floor(s(17) * 8) + 1,
    });
  }

  return lps;
}

const MOCK_LPS = generateMockLPs(300);
const PAGE_SIZE = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  pension: 'bg-blue-100 text-blue-800',
  endowment: 'bg-purple-100 text-purple-800',
  family_office: 'bg-green-100 text-green-800',
  sovereign_wealth: 'bg-indigo-100 text-indigo-800',
  foundation: 'bg-amber-100 text-amber-800',
  insurance: 'bg-rose-100 text-rose-800',
  fund_of_funds: 'bg-cyan-100 text-cyan-800',
};

const TYPE_LABELS: Record<string, string> = {
  pension: 'Pension',
  endowment: 'Endowment',
  family_office: 'Family Office',
  sovereign_wealth: 'Sovereign Wealth',
  foundation: 'Foundation',
  insurance: 'Insurance',
  fund_of_funds: 'Fund of Funds',
};

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-sky-100 text-sky-800',
  active: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-gray-100 text-gray-600',
  inactive: 'bg-red-100 text-red-700',
};

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LimitedPartners() {
  const queryClient = useQueryClient();
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['limited-partners'],
    queryFn: () => getLimitedPartners(),
  });

  const realPartners = response?.data || [];

  const [demoMode, setDemoMode] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [showNewLP, setShowNewLP] = useState(false);
  const [lpForm, setLpForm] = useState({
    name: '', type: 'pension', aum: '', headquarters: '', relationship_owner: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const allLPs = demoMode ? MOCK_LPS : realPartners;

  const filteredLPs = useMemo(() => {
    let list = allLPs as MockLP[];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(lp => lp.name.toLowerCase().includes(q) || lp.headquarters?.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') list = list.filter(lp => lp.status === statusFilter);
    if (typeFilter !== 'all') list = list.filter(lp => lp.type === typeFilter);
    if (ownerFilter !== 'all') list = list.filter(lp => lp.relationship_owner === ownerFilter);
    return list;
  }, [allLPs, search, statusFilter, typeFilter, ownerFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLPs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredLPs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Summary stats
  const summary = useMemo(() => {
    const all = allLPs as MockLP[];
    return {
      total: all.length,
      prospect: all.filter(lp => lp.status === 'prospect').length,
      active: all.filter(lp => lp.status === 'active').length,
      closed: all.filter(lp => lp.status === 'closed').length,
      totalCommitment: all.filter(lp => lp.commitment_amount != null)
        .reduce((s, lp) => s + (lp.commitment_amount || 0), 0),
      totalAUM: all.reduce((s, lp) => s + lp.aum, 0),
    };
  }, [allLPs]);

  const owners = useMemo(() => {
    const s = new Set((allLPs as MockLP[]).map(lp => lp.relationship_owner).filter(Boolean));
    return Array.from(s).sort();
  }, [allLPs]);

  const handlePageChange = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = () => setPage(1);

  const handleCreateLP = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const resp = await fetch('https://gp-os-production.up.railway.app/api/limited-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lpForm.name,
          type: lpForm.type,
          aum: lpForm.aum ? parseFloat(lpForm.aum) * 1_000_000_000 : null,
          headquarters: lpForm.headquarters || null,
          relationship_owner: lpForm.relationship_owner || null,
          notes: lpForm.notes || null,
          status: 'prospect',
        }),
      });
      if (!resp.ok) throw new Error('Failed to create LP');
      queryClient.invalidateQueries({ queryKey: ['limited-partners'] });
      setShowNewLP(false);
      setLpForm({ name: '', type: 'pension', aum: '', headquarters: '', relationship_owner: '', notes: '' });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Limited Partners</h1>
          <p className="text-gray-600 mt-2">Manage investor relationships and commitments</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setDemoMode(!demoMode); setPage(1); setSearch(''); setStatusFilter('all'); setTypeFilter('all'); }}
            className={`btn text-sm ${demoMode ? 'bg-violet-600 hover:bg-violet-700 text-white border-violet-600' : 'btn-secondary'}`}
          >
            {demoMode ? '✦ 300 Demo LPs' : 'Load 300 Demo LPs'}
          </button>
          {!demoMode && (
            <button onClick={() => setShowNewLP(true)} className="btn btn-primary">
              New LP
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total LPs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Prospects</p>
          <p className="text-2xl font-bold text-sky-600 mt-1">{summary.prospect}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{summary.active}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Closed</p>
          <p className="text-2xl font-bold text-gray-600 mt-1">{summary.closed}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total Committed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${summary.totalCommitment >= 1000
              ? `${(summary.totalCommitment / 1000).toFixed(1)}B`
              : `${summary.totalCommitment.toFixed(0)}M`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name or location..."
          value={search}
          onChange={e => { setSearch(e.target.value); handleFilterChange(); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); handleFilterChange(); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="prospect">Prospect</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); handleFilterChange(); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          {LP_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        {demoMode && (
          <select
            value={ownerFilter}
            onChange={e => { setOwnerFilter(e.target.value); handleFilterChange(); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Owners</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <span className="text-sm text-gray-500 ml-auto">
          {filteredLPs.length} LP{filteredLPs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Loading / Error states */}
      {!demoMode && isLoading && (
        <div className="text-center py-12"><p className="text-gray-500">Loading limited partners...</p></div>
      )}
      {!demoMode && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Error loading partners: {(error as any).message}</p>
        </div>
      )}

      {/* Table */}
      {pageItems.length > 0 && (
        <div className="card overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">LP Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">AUM</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Commitment</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Invested</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Net IRR</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">MOIC</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">HQ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageItems.map((lp) => {
                const lastDays = daysSince(lp.last_contact);
                const contactStale = lastDays > 90;

                return (
                  <tr key={lp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      {demoMode ? (
                        <span className="font-medium text-gray-900">{lp.name}</span>
                      ) : (
                        <Link to={`/lp-management/partners/${lp.id}`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                          {lp.name}
                        </Link>
                      )}
                      {lp.fund_name && (
                        <p className="text-xs text-gray-400 mt-0.5">{lp.fund_name} · {lp.vintage}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[lp.type] || 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABELS[lp.type] || lp.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lp.status] || 'bg-gray-100 text-gray-600'}`}>
                        {lp.status === 'prospect' ? '● Prospect' : lp.status === 'active' ? '● Active' : '◉ Closed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 font-medium">
                      ${lp.aum >= 100 ? `${fmt(lp.aum / 1, 0)}B` : `${fmt(lp.aum, 1)}B`}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {lp.commitment_amount != null ? `$${fmt(lp.commitment_amount, 0)}M` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {lp.invested_to_date != null ? (
                        <div>
                          <span>${fmt(lp.invested_to_date, 0)}M</span>
                          {lp.commitment_amount && (
                            <div className="w-16 ml-auto mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, (lp.invested_to_date / lp.commitment_amount) * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {lp.irr != null ? (
                        <span className={`font-medium ${lp.irr >= 15 ? 'text-emerald-600' : lp.irr >= 10 ? 'text-blue-600' : 'text-gray-700'}`}>
                          {fmt(lp.irr, 1)}%
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {lp.moic != null ? (
                        <span className={`font-medium ${lp.moic >= 2.0 ? 'text-emerald-600' : lp.moic >= 1.5 ? 'text-blue-600' : 'text-gray-700'}`}>
                          {fmt(lp.moic, 2)}x
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{lp.headquarters || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{lp.relationship_owner || '—'}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span className={contactStale ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                        {contactStale ? `${lastDays}d ago` : lp.last_contact}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && pageItems.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-gray-500">No limited partners match your filters</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 mb-6">
          <p className="text-sm text-gray-500">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredLPs.length)} of {filteredLPs.length}
          </p>
          <div className="flex gap-1 items-center">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) p = i + 1;
              else if (currentPage <= 4) p = i + 1;
              else if (currentPage >= totalPages - 3) p = totalPages - 6 + i;
              else p = currentPage - 3 + i;
              return (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  className={`w-8 h-8 text-sm rounded-lg border transition-colors ${
                    p === currentPage
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* New LP Modal */}
      {showNewLP && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Add Limited Partner</h2>
              <button onClick={() => setShowNewLP(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleCreateLP} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  type="text" required value={lpForm.name}
                  onChange={e => setLpForm({ ...lpForm, name: e.target.value })}
                  placeholder="CalPERS"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={lpForm.type} onChange={e => setLpForm({ ...lpForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="pension">Pension</option>
                    <option value="endowment">Endowment</option>
                    <option value="family_office">Family Office</option>
                    <option value="sovereign_wealth">Sovereign Wealth</option>
                    <option value="foundation">Foundation</option>
                    <option value="insurance">Insurance</option>
                    <option value="fund_of_funds">Fund of Funds</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">AUM ($B)</label>
                  <input type="number" step="0.1" value={lpForm.aum}
                    onChange={e => setLpForm({ ...lpForm, aum: e.target.value })}
                    placeholder="42.5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Headquarters</label>
                  <input type="text" value={lpForm.headquarters}
                    onChange={e => setLpForm({ ...lpForm, headquarters: e.target.value })}
                    placeholder="Sacramento, CA"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relationship Owner</label>
                  <input type="text" value={lpForm.relationship_owner}
                    onChange={e => setLpForm({ ...lpForm, relationship_owner: e.target.value })}
                    placeholder="Sarah Chen"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={lpForm.notes} onChange={e => setLpForm({ ...lpForm, notes: e.target.value })}
                  rows={2} placeholder="Warm intro via placement agent, interested in credit strategies..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 btn btn-primary">
                  {saving ? 'Creating...' : 'Create LP'}
                </button>
                <button type="button" onClick={() => setShowNewLP(false)} className="flex-1 btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
