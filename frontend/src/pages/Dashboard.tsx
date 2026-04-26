import { useQuery } from '@tanstack/react-query';
import { getDashboardFunds } from '../api';
import Layout from '../components/Layout';

interface DashboardFund {
  fund_id: number;
  fund_name: string;
  vintage_year: number | null;
  asset_class: string;
  sub_asset_class: string;
  lifecycle_stage: string;
  vehicle_count: number;
  committed_lp_count: number;
  total_committed: number;
  lps_in_pipeline: number;
  funded_deals: number;
  pipeline_deals: number;
  total_drawn: number;
  total_undrawn: number;
}

const formatAmount = (amount: number): string => {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(0)}M`;
  return `$${amount.toLocaleString()}`;
};

const getLifecycleStageColor = (stage: string): string => {
  switch (stage) {
    case 'Capital Raising':
      return 'bg-blue-100 text-blue-800';
    case 'Capital Raising & Investing':
      return 'bg-purple-100 text-purple-800';
    case 'Closed & Investing':
      return 'bg-green-100 text-green-800';
    case 'Closed & Harvesting':
      return 'bg-orange-100 text-orange-800';
    case 'Liquidating':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function Dashboard() {
  const { data: fundsResponse, isLoading } = useQuery({
    queryKey: ['dashboard-funds'],
    queryFn: () => getDashboardFunds(),
  });

  const funds = (fundsResponse?.data || []) as DashboardFund[];

  // Calculate summary stats
  const stats = {
    totalFunds: funds.length,
    totalAumCommitted: funds.reduce((sum, f) => sum + f.total_committed, 0),
    totalDrawn: funds.reduce((sum, f) => sum + f.total_drawn, 0),
    totalLPs: new Set(funds.map(f => f.committed_lp_count)).size,
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">GP Operating System</h1>
        <p className="text-gray-600 mt-2">Stonecrest Capital Management</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card p-6">
          <p className="text-sm text-gray-600 font-medium">Total Funds</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {isLoading ? '-' : stats.totalFunds}
          </p>
        </div>

        <div className="card p-6">
          <p className="text-sm text-gray-600 font-medium">Total AUM Committed</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {isLoading ? '-' : formatAmount(stats.totalAumCommitted)}
          </p>
        </div>

        <div className="card p-6">
          <p className="text-sm text-gray-600 font-medium">Total Drawn</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {isLoading ? '-' : formatAmount(stats.totalDrawn)}
          </p>
        </div>

        <div className="card p-6">
          <p className="text-sm text-gray-600 font-medium">Total LPs</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {isLoading ? '-' : funds.reduce((sum, f) => sum + f.committed_lp_count, 0)}
          </p>
        </div>
      </div>

      {/* Funds Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#0f1629' }}>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white">Fund Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white">Asset Class</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white">Lifecycle Stage</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-white">Vehicles</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-white">Committed LPs</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-white">Total Committed</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-white">Pipeline LPs</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-white">Funded Deals</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-white">Pipeline Deals</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-white">Drawn</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-white">Undrawn</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-4 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : funds.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-4 text-center text-gray-500">
                    No funds found
                  </td>
                </tr>
              ) : (
                funds.map((fund) => (
                  <tr key={fund.fund_id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{fund.fund_name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {fund.vintage_year ? `Vintage ${fund.vintage_year}` : 'No vintage'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{fund.asset_class}</div>
                      <div className="text-xs text-gray-500 mt-1">{fund.sub_asset_class}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getLifecycleStageColor(fund.lifecycle_stage)}`}
                      >
                        {fund.lifecycle_stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">{fund.vehicle_count}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">{fund.committed_lp_count}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900 font-medium">
                      {formatAmount(fund.total_committed)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">{fund.lps_in_pipeline}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">{fund.funded_deals}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">{fund.pipeline_deals}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">{formatAmount(fund.total_drawn)}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">{formatAmount(fund.total_undrawn)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
