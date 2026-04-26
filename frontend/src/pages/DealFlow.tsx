import { useQuery } from '@tanstack/react-query';
import { getDeals } from '../api';
import Layout from '../components/Layout';
import { Deal } from '../types';

export default function DealFlow() {
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['deals'],
    queryFn: () => getDeals(),
  });

  const deals = response?.data || [];

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'funded': return 'badge-success';
      case 'approved': return 'badge-info';
      case 'pipeline': return 'badge-warning';
      case 'passed': return 'badge-danger';
      default: return 'badge-info';
    }
  };

  const getInstrumentType = (type?: string) => {
    switch (type) {
      case 'first_lien': return 'First Lien';
      case 'second_lien': return 'Second Lien';
      case 'mezzanine': return 'Mezzanine';
      case 'unitranche': return 'Unitranche';
      case 'equity_co_invest': return 'Equity Co-Invest';
      default: return 'Other';
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Deal Flow</h1>
        <p className="text-gray-600 mt-2">Track pipeline, approved, and funded deals</p>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading deals...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Error loading deals: {(error as any).message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {deals.map((deal: Deal) => (
          <div key={deal.id} className="card p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{deal.name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {deal.borrower_entity_name}
                  {deal.ultimate_parent_name && ` / ${deal.ultimate_parent_name}`}
                </p>
              </div>
              <span className={`badge ${getStatusColor(deal.status)}`}>
                {deal.status}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 py-4 border-t border-b border-gray-200">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Asset Class</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{deal.asset_class_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Instrument</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{getInstrumentType(deal.instrument_type)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Facility Size</p>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  ${deal.total_facility_size ? (deal.total_facility_size / 1000000).toFixed(0) : 0}M
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Deal Team</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{deal.deal_team_lead || 'Unassigned'}</p>
              </div>
            </div>

            {deal.coupon_rate && (
              <div className="grid grid-cols-3 gap-4 py-4 border-b border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Coupon Rate</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{(deal.coupon_rate * 100).toFixed(2)}%</p>
                </div>
                {deal.pik_rate && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">PIK Rate</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">{(deal.pik_rate * 100).toFixed(2)}%</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Rate Type</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{deal.interest_rate_type}</p>
                </div>
              </div>
            )}

            {deal.description && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Description</p>
                <p className="text-sm text-gray-700">{deal.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {!isLoading && deals.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-gray-500">No deals in pipeline</p>
        </div>
      )}
    </Layout>
  );
}
