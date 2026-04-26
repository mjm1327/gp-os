import { useQuery } from '@tanstack/react-query';
import { getCapitalCalls, getDistributions } from '../api';
import Layout from '../components/Layout';
import { CapitalCall, Distribution } from '../types';

export default function CapitalAccounting() {
  const { data: callsResponse, isLoading: callsLoading } = useQuery({
    queryKey: ['capital-calls'],
    queryFn: () => getCapitalCalls(),
  });

  const { data: distResponse, isLoading: distLoading } = useQuery({
    queryKey: ['distributions'],
    queryFn: () => getDistributions(),
  });

  const calls = callsResponse?.data || [];
  const distributions = distResponse?.data || [];

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'fully_paid': return 'badge-success';
      case 'partially_paid': return 'badge-warning';
      case 'issued': return 'badge-info';
      default: return 'badge-info';
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Capital Accounting</h1>
        <p className="text-gray-600 mt-2">Manage capital calls, distributions, and fund NAV</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Capital Calls</h2>

          {callsLoading && <p className="text-gray-500">Loading...</p>}

          {!callsLoading && calls.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {calls.slice(0, 5).map((call: CapitalCall) => (
                <div key={call.id} className="pb-3 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{call.fund_name}</p>
                      <p className="text-xs text-gray-500 mt-1">Call #{call.call_number}</p>
                    </div>
                    <span className={`badge ${getStatusColor(call.status)}`}>
                      {call.status}
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm font-bold text-gray-900">
                      ${call.total_amount ? (call.total_amount / 1000000).toFixed(1) : 0}M
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{call.call_date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!callsLoading && calls.length === 0 && (
            <p className="text-gray-500 text-sm">No capital calls</p>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Distributions</h2>

          {distLoading && <p className="text-gray-500">Loading...</p>}

          {!distLoading && distributions.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {distributions.slice(0, 5).map((dist: Distribution) => (
                <div key={dist.id} className="pb-3 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{dist.fund_name}</p>
                      <p className="text-xs text-gray-500 mt-1">{dist.type ? dist.type.replace('_', ' ') : 'Mixed'}</p>
                    </div>
                    <span className={`badge ${getStatusColor(dist.status)}`}>
                      {dist.status}
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm font-bold text-green-600">
                      ${dist.total_amount ? (dist.total_amount / 1000000).toFixed(1) : 0}M
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{dist.distribution_date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!distLoading && distributions.length === 0 && (
            <p className="text-gray-500 text-sm">No distributions</p>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">All Capital Calls</h2>

        {callsLoading && <p className="text-gray-500">Loading...</p>}

        {!callsLoading && calls.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="table-header">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Fund</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Call #</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Call Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Due Date</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {calls.map((call: CapitalCall) => (
                  <tr key={call.id} className="table-row">
                    <td className="px-6 py-4 text-sm text-gray-900">{call.fund_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">#{call.call_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{call.call_date}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{call.due_date}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      ${call.total_amount ? (call.total_amount / 1000000).toFixed(1) : 0}M
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${getStatusColor(call.status)}`}>
                        {call.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!callsLoading && calls.length === 0 && (
          <p className="text-gray-500 text-sm">No capital calls</p>
        )}
      </div>
    </Layout>
  );
}
