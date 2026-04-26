import Layout from '../components/Layout';

export default function Documents() {
  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-600 mt-2">Manage PPMs, agreements, and fund documents</p>
      </div>

      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">📁</div>
        <h3 className="text-lg font-semibold text-gray-900">Documents Module</h3>
        <p className="text-gray-600 mt-2">Document management module coming soon</p>
        <div className="mt-6 inline-block bg-blue-100 px-4 py-2 rounded text-blue-700 text-sm font-medium">
          Under Development
        </div>
      </div>
    </Layout>
  );
}
