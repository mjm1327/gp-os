import { useQuery } from '@tanstack/react-query';
import { getFirms } from '../../api';
import Layout from '../../components/Layout';

export default function FirmProfile() {
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['firms'],
    queryFn: () => getFirms(),
  });

  const firms = response?.data || [];

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Firm Profile</h1>
        <p className="text-gray-600 mt-2">Manage firm information and AUM</p>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading firm data...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Error loading firms: {(error as any).message}</p>
        </div>
      )}

      {firms.length > 0 && (
        <div className="space-y-6">
          {firms.map((firm) => (
            <div key={firm.id} className="card p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{firm.name}</h2>
                  <p className="text-sm text-gray-600 mt-1">{firm.headquarters}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">
                    ${firm.aum ? (firm.aum / 1000000000).toFixed(1) : 0}B
                  </p>
                  <p className="text-xs text-gray-500 mt-1">AUM</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Founded</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {firm.founded_date ? new Date(firm.founded_date).getFullYear() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Website</p>
                  <a href={`https://${firm.website}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 mt-1 hover:underline">
                    {firm.website || 'N/A'}
                  </a>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Status</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">Active</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && firms.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-gray-500">No firms configured</p>
        </div>
      )}
    </Layout>
  );
}
