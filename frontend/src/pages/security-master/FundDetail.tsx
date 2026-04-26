import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFundById, createShareClass, updateShareClass, createVehicle, createFundDocument } from '../../api';
import Layout from '../../components/Layout';
import { Fund, ShareClass, InvestmentVehicle, Document } from '../../types';

export default function FundDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fundId = parseInt(id || '0');

  const [activeTab, setActiveTab] = useState<'share-classes' | 'vehicles' | 'documents'>('share-classes');
  const [showShareClassModal, setShowShareClassModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareLinks, setShareLinks] = useState<{ email: string; link: string; fund_name: string }[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [editingShareClass, setEditingShareClass] = useState<ShareClass | null>(null);

  const [scFormData, setScFormData] = useState({
    name: '',
    management_fee_rate: '',
    carried_interest_rate: '',
    hurdle_rate: '',
    preferred_return: '',
    description: '',
  });

  const [vehicleFormData, setVehicleFormData] = useState({
    name: '',
    legal_entity_type: 'LP',
    domicile: 'Delaware',
    formation_date: '',
    tax_id: '',
  });

  const [docFormData, setDocFormData] = useState({
    title: '',
    document_type: 'LPA',
    version: '1',
    status: 'draft',
  });

  const { data: fundResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['fund', fundId],
    queryFn: () => getFundById(fundId),
  });

  const fund = fundResponse?.data as Fund | undefined;

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'fundraising': return 'bg-blue-100 text-blue-800';
      case 'investing': return 'bg-green-100 text-green-800';
      case 'harvesting': return 'bg-yellow-100 text-yellow-800';
      case 'liquidating': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'fundraising': return 'Fundraising';
      case 'investing': return 'Investing';
      case 'harvesting': return 'Harvesting';
      case 'liquidating': return 'Liquidating';
      default: return 'Unknown';
    }
  };

  const getDocumentTypeBadge = (type?: string) => {
    switch (type) {
      case 'LPA': return 'bg-purple-100 text-purple-800';
      case 'PPM': return 'bg-blue-100 text-blue-800';
      case 'subscription_agreement': return 'bg-green-100 text-green-800';
      case 'side_letter_template': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateShareClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingShareClass) {
        await updateShareClass(fundId, editingShareClass.id!, {
          name: scFormData.name,
          management_fee_rate: scFormData.management_fee_rate ? parseFloat(scFormData.management_fee_rate) / 100 : null,
          carried_interest_rate: scFormData.carried_interest_rate ? parseFloat(scFormData.carried_interest_rate) / 100 : null,
          hurdle_rate: scFormData.hurdle_rate ? parseFloat(scFormData.hurdle_rate) / 100 : null,
          preferred_return: scFormData.preferred_return ? parseFloat(scFormData.preferred_return) / 100 : null,
          description: scFormData.description || null,
        });
      } else {
        await createShareClass(fundId, {
          name: scFormData.name,
          management_fee_rate: scFormData.management_fee_rate ? parseFloat(scFormData.management_fee_rate) / 100 : null,
          carried_interest_rate: scFormData.carried_interest_rate ? parseFloat(scFormData.carried_interest_rate) / 100 : null,
          hurdle_rate: scFormData.hurdle_rate ? parseFloat(scFormData.hurdle_rate) / 100 : null,
          preferred_return: scFormData.preferred_return ? parseFloat(scFormData.preferred_return) / 100 : null,
          description: scFormData.description || null,
        });
      }
      setShowShareClassModal(false);
      setEditingShareClass(null);
      setScFormData({
        name: '',
        management_fee_rate: '',
        carried_interest_rate: '',
        hurdle_rate: '',
        preferred_return: '',
        description: '',
      });
      refetch();
    } catch (error) {
      console.error('Error saving share class:', error);
      alert('Failed to save share class');
    }
  };

  const handleEditShareClass = (sc: ShareClass) => {
    setEditingShareClass(sc);
    setScFormData({
      name: sc.name,
      management_fee_rate: sc.management_fee_rate ? (sc.management_fee_rate * 100).toString() : '',
      carried_interest_rate: sc.carried_interest_rate ? (sc.carried_interest_rate * 100).toString() : '',
      hurdle_rate: sc.hurdle_rate ? (sc.hurdle_rate * 100).toString() : '',
      preferred_return: sc.preferred_return ? (sc.preferred_return * 100).toString() : '',
      description: sc.description || '',
    });
    setShowShareClassModal(true);
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createVehicle(fundId, {
        name: vehicleFormData.name,
        legal_entity_type: vehicleFormData.legal_entity_type,
        domicile: vehicleFormData.domicile,
        formation_date: vehicleFormData.formation_date || null,
        tax_id: vehicleFormData.tax_id || null,
      });
      setShowVehicleModal(false);
      setVehicleFormData({
        name: '',
        legal_entity_type: 'LP',
        domicile: 'Delaware',
        formation_date: '',
        tax_id: '',
      });
      refetch();
    } catch (error) {
      console.error('Error creating vehicle:', error);
      alert('Failed to create vehicle');
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFundDocument(fundId, {
        title: docFormData.title,
        document_type: docFormData.document_type,
        version: parseInt(docFormData.version),
        status: docFormData.status as 'draft' | 'executed' | 'superseded',
      });
      setShowDocumentModal(false);
      setDocFormData({
        title: '',
        document_type: 'LPA',
        version: '1',
        status: 'draft',
      });
      refetch();
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Failed to create document');
    }
  };

  const handleGenerateLink = async () => {
    setShareLoading(true);
    try {
      const resp = await fetch('http://localhost:3002/api/investor-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fund_id: fundId, recipient_email: shareEmail || null }),
      });
      if (!resp.ok) throw new Error('Failed to generate link');
      const result = await resp.json();
      const fullLink = `${window.location.origin}/investor/${result.token}`;
      setShareLinks(prev => [{ email: shareEmail, link: fullLink, fund_name: result.fund_name }, ...prev]);
      setShareEmail('');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setShareLoading(false);
    }
  };

  const copyToClipboard = (text: string, token: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading fund details...</p>
        </div>
      </Layout>
    );
  }

  if (error || !fund) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading fund: {(error as any)?.message}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Breadcrumb */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/security-master/funds')}
          className="text-blue-600 hover:text-blue-800 text-sm mb-3"
        >
          ← Back to Funds
        </button>

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{fund.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(fund.status)}`}>
                {getStatusLabel(fund.status)}
              </span>
              <span className="text-gray-600">Vintage {fund.vintage_year}</span>
              <span className="text-gray-600">{fund.asset_class_name} / {fund.sub_asset_class}</span>
            </div>
          </div>
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            🔗 Share Fund Page
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600 uppercase">Target Size</p>
            <p className="text-lg font-bold text-gray-900">${fund.target_size ? (fund.target_size / 1000000).toFixed(0) : 0}M</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600 uppercase">Hard Cap</p>
            <p className="text-lg font-bold text-gray-900">${fund.hard_cap ? (fund.hard_cap / 1000000).toFixed(0) : 0}M</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600 uppercase">Mgmt Fee</p>
            <p className="text-lg font-bold text-gray-900">{fund.management_fee_rate ? (fund.management_fee_rate * 100).toFixed(2) : 'N/A'}%</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600 uppercase">Carry</p>
            <p className="text-lg font-bold text-gray-900">{fund.carried_interest_rate ? (fund.carried_interest_rate * 100).toFixed(0) : 'N/A'}%</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600 uppercase">Hurdle</p>
            <p className="text-lg font-bold text-gray-900">{fund.hurdle_rate ? (fund.hurdle_rate * 100).toFixed(0) : 'N/A'}%</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600 uppercase">Pref Return</p>
            <p className="text-lg font-bold text-gray-900">{fund.preferred_return ? (fund.preferred_return * 100).toFixed(0) : 'N/A'}%</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600 uppercase">IP End</p>
            <p className="text-lg font-bold text-gray-900">{fund.investment_period_end ? new Date(fund.investment_period_end).getFullYear() : 'N/A'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600 uppercase">Term</p>
            <p className="text-lg font-bold text-gray-900">{fund.fund_term ? fund.fund_term + ' yrs' : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mt-8 mb-6">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('share-classes')}
            className={`pb-3 border-b-2 font-medium transition ${
              activeTab === 'share-classes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Share Classes
          </button>
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`pb-3 border-b-2 font-medium transition ${
              activeTab === 'vehicles'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Investment Vehicles
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-3 border-b-2 font-medium transition ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Documents
          </button>
        </div>
      </div>

      {/* Share Classes Tab */}
      {activeTab === 'share-classes' && (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Share Classes</h2>
            <button
              onClick={() => {
                setEditingShareClass(null);
                setScFormData({
                  name: '',
                  management_fee_rate: '',
                  carried_interest_rate: '',
                  hurdle_rate: '',
                  preferred_return: '',
                  description: '',
                });
                setShowShareClassModal(true);
              }}
              className="btn btn-primary text-sm"
            >
              Add Share Class
            </button>
          </div>

          {!fund.share_classes || fund.share_classes.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500">No share classes yet. Add the first one.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full">
                <thead className="table-header">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Mgmt Fee</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Carry</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Hurdle</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Pref Return</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {fund.share_classes.map((sc: ShareClass) => (
                    <tr key={sc.id} className="table-row">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{sc.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {sc.management_fee_rate ? (sc.management_fee_rate * 100).toFixed(2) : 'N/A'}%
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {sc.carried_interest_rate ? (sc.carried_interest_rate * 100).toFixed(1) : 'N/A'}%
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {sc.hurdle_rate ? (sc.hurdle_rate * 100).toFixed(1) : 'N/A'}%
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {sc.preferred_return ? (sc.preferred_return * 100).toFixed(1) : 'N/A'}%
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{sc.description || '—'}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          sc.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {sc.status === 'active' ? 'Active' : 'Closed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => handleEditShareClass(sc)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Investment Vehicles Tab */}
      {activeTab === 'vehicles' && (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Investment Vehicles</h2>
            <button
              onClick={() => setShowVehicleModal(true)}
              className="btn btn-primary text-sm"
            >
              Add Vehicle
            </button>
          </div>

          {!fund.vehicles || fund.vehicles.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500">No vehicles yet. Add the first one.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full">
                <thead className="table-header">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Entity Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Domicile</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Formation</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Committed LPs</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Total Committed</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {fund.vehicles.map((v: InvestmentVehicle) => (
                    <tr key={v.id} className="table-row">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{v.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{v.legal_entity_type || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{v.domicile || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {v.formation_date ? new Date(v.formation_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{(v as any).lp_count || 0}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        ${(v as any).total_committed ? ((v as any).total_committed / 1000000).toFixed(0) : 0}M
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          v.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {v.status === 'active' ? 'Active' : v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Fund Documents</h2>
            <button
              onClick={() => setShowDocumentModal(true)}
              className="btn btn-primary text-sm"
            >
              Upload Document
            </button>
          </div>

          {!fund.documents || fund.documents.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-500">No documents yet. Upload the first one.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full">
                <thead className="table-header">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Version</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Upload Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {fund.documents.map((doc: Document) => (
                    <tr key={doc.id} className="table-row">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{doc.title}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getDocumentTypeBadge(doc.document_type)}`}>
                          {doc.document_type || 'Other'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">v{doc.version}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          doc.status === 'executed'
                            ? 'bg-green-100 text-green-800'
                            : doc.status === 'draft'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {doc.status === 'draft' ? 'Draft' : doc.status === 'executed' ? 'Executed' : 'Superseded'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Share Fund Page Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Share Investor Page</h2>
                <p className="text-sm text-gray-500 mt-0.5">Generate a private link to this fund's investor page</p>
              </div>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
                Each link is unique and gives the recipient read-only access to <strong>{fund.name}</strong>'s investor page — economics, vehicles, share classes, and documents.
              </div>

              <div className="flex gap-2">
                <input
                  type="email"
                  value={shareEmail}
                  onChange={e => setShareEmail(e.target.value)}
                  placeholder="investor@institution.com (optional)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => e.key === 'Enter' && handleGenerateLink()}
                />
                <button
                  onClick={handleGenerateLink}
                  disabled={shareLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {shareLoading ? 'Generating...' : 'Generate Link'}
                </button>
              </div>

              {shareLinks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Generated Links</p>
                  {shareLinks.map((sl, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        {sl.email && <p className="text-xs text-gray-500 truncate">{sl.email}</p>}
                        <p className="text-xs text-blue-700 font-mono truncate">{sl.link}</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(sl.link, sl.link)}
                        className="shrink-0 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      >
                        {copiedToken === sl.link ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400">Links are active immediately. Share via email or message.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Class Modal */}
      {showShareClassModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingShareClass ? 'Edit Share Class' : 'Add Share Class'}
              </h2>
              <button
                onClick={() => setShowShareClassModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateShareClass} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={scFormData.name}
                  onChange={(e) => setScFormData({ ...scFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mgmt Fee (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={scFormData.management_fee_rate}
                    onChange={(e) => setScFormData({ ...scFormData, management_fee_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Carry (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={scFormData.carried_interest_rate}
                    onChange={(e) => setScFormData({ ...scFormData, carried_interest_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hurdle (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={scFormData.hurdle_rate}
                    onChange={(e) => setScFormData({ ...scFormData, hurdle_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pref Return (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={scFormData.preferred_return}
                    onChange={(e) => setScFormData({ ...scFormData, preferred_return: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={scFormData.description}
                  onChange={(e) => setScFormData({ ...scFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="border-t border-gray-200 pt-4 flex gap-3">
                <button type="submit" className="flex-1 btn btn-primary">
                  {editingShareClass ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowShareClassModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vehicle Modal */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Add Investment Vehicle</h2>
              <button
                onClick={() => setShowVehicleModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={vehicleFormData.name}
                  onChange={(e) => setVehicleFormData({ ...vehicleFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type *</label>
                <select
                  value={vehicleFormData.legal_entity_type}
                  onChange={(e) => setVehicleFormData({ ...vehicleFormData, legal_entity_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="LP">LP</option>
                  <option value="LLC">LLC</option>
                  <option value="Corp">Corp</option>
                  <option value="trust">Trust</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Domicile</label>
                <input
                  type="text"
                  value={vehicleFormData.domicile}
                  onChange={(e) => setVehicleFormData({ ...vehicleFormData, domicile: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Formation Date</label>
                <input
                  type="date"
                  value={vehicleFormData.formation_date}
                  onChange={(e) => setVehicleFormData({ ...vehicleFormData, formation_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                <input
                  type="text"
                  value={vehicleFormData.tax_id}
                  onChange={(e) => setVehicleFormData({ ...vehicleFormData, tax_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="border-t border-gray-200 pt-4 flex gap-3">
                <button type="submit" className="flex-1 btn btn-primary">
                  Create Vehicle
                </button>
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Modal */}
      {showDocumentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Upload Document</h2>
              <button
                onClick={() => setShowDocumentModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateDocument} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={docFormData.title}
                  onChange={(e) => setDocFormData({ ...docFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                <select
                  value={docFormData.document_type}
                  onChange={(e) => setDocFormData({ ...docFormData, document_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="LPA">LPA</option>
                  <option value="PPM">PPM</option>
                  <option value="subscription_agreement">Subscription Agreement</option>
                  <option value="side_letter_template">Side Letter Template</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                  <input
                    type="number"
                    value={docFormData.version}
                    onChange={(e) => setDocFormData({ ...docFormData, version: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={docFormData.status}
                    onChange={(e) => setDocFormData({ ...docFormData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="executed">Executed</option>
                    <option value="superseded">Superseded</option>
                  </select>
                </div>
              </div>

              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                Note: File upload is a placeholder for now. This form captures document metadata only.
              </p>

              <div className="border-t border-gray-200 pt-4 flex gap-3">
                <button type="submit" className="flex-1 btn btn-primary">
                  Upload Document
                </button>
                <button
                  type="button"
                  onClick={() => setShowDocumentModal(false)}
                  className="flex-1 btn btn-secondary"
                >
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
