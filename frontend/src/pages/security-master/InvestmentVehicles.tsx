import { useQuery } from '@tanstack/react-query';
import { getInvestmentVehicles } from '../../api';
import Layout from '../../components/Layout';
import { InvestmentVehicle } from '../../types';

export default function InvestmentVehicles() {
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['investment-vehicles'],
    queryFn: () => getInvestmentVehicles(),
  });

  const vehicles = response?.data || [];

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'badge-success';
      case 'closed': return 'badge-danger';
      case 'liquidating': return 'badge-warning';
      default: return 'badge-info';
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Investment Vehicles</h1>
        <p className="text-gray-600 mt-2">Manage fund vehicles and entities</p>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading investment vehicles...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Error loading vehicles: {(error as any).message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {vehicles.map((vehicle: InvestmentVehicle) => (
          <div key={vehicle.id} className="card p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{vehicle.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{vehicle.fund_name}</p>
              </div>
              <span className={`badge ${getStatusColor(vehicle.status)}`}>
                {vehicle.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Entity Type</p>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {vehicle.legal_entity_type || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Domicile</p>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {vehicle.domicile || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Formation Date</p>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {vehicle.formation_date ? new Date(vehicle.formation_date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Tax ID</p>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {vehicle.tax_id || 'N/A'}
                </p>
              </div>
            </div>

            {vehicle.latest_nav && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Latest NAV</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">NAV</p>
                    <p className="text-sm font-medium text-gray-900">
                      ${(vehicle.latest_nav.nav ? vehicle.latest_nav.nav / 1000000 : 0).toFixed(1)}M
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Net IRR</p>
                    <p className="text-sm font-medium text-gray-900">
                      {vehicle.latest_nav.net_irr ? (vehicle.latest_nav.net_irr * 100).toFixed(1) : 'N/A'}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!isLoading && vehicles.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-gray-500">No investment vehicles configured</p>
        </div>
      )}
    </Layout>
  );
}
