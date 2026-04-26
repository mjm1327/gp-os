import { useQuery } from '@tanstack/react-query';
import { getAssetClasses } from '../../api';
import Layout from '../../components/Layout';

export default function AssetClasses() {
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['asset-classes'],
    queryFn: () => getAssetClasses(),
  });

  const assetClasses = response?.data || [];

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Asset Classes</h1>
        <p className="text-gray-600 mt-2">Manage firm asset classes and sub-categories</p>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading asset classes...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Error loading asset classes: {(error as any).message}</p>
        </div>
      )}

      <div className="space-y-6">
        {assetClasses.map((ac) => (
          <div key={ac.id} className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{ac.name}</h2>
                  <p className="text-sm text-gray-600 mt-1">{ac.description}</p>
                </div>
                <div className="bg-blue-100 rounded-full w-10 h-10 flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">
                    {ac.sub_class_count || 0}
                  </span>
                </div>
              </div>
            </div>

            {ac.sub_classes && ac.sub_classes.length > 0 && (
              <div className="divide-y divide-gray-200">
                {ac.sub_classes.map((subClass) => (
                  <div key={subClass.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{subClass.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{subClass.description}</p>
                      </div>
                      <span className="badge badge-info">Sub-Class</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {!isLoading && assetClasses.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-gray-500">No asset classes configured</p>
        </div>
      )}
    </Layout>
  );
}
