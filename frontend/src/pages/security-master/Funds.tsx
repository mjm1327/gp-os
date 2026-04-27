import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getFunds, getAssetClasses } from '../../api';
import Layout from '../../components/Layout';
import { Fund, AssetClass } from '../../types';

const SAMPLE_PPM = `PRIVATE PLACEMENT MEMORANDUM

Stonecrest Capital Partners V, L.P.
A Delaware Limited Partnership

STRATEGY
Stonecrest Capital Partners V is a senior secured direct lending fund targeting middle market companies with $25–150M in EBITDA. The fund will make asset-backed loans with advance rates of 75–90% of collateral value, targeting levered yields of 9–12%. Expected portfolio of 15–20 positions with average hold size of $35–55M.

FUND ECONOMICS
Target Fund Size: $750,000,000 (Seven Hundred Fifty Million US Dollars)
Hard Cap: $1,000,000,000 (One Billion US Dollars)
Management Fee: 1.50% per annum on committed capital during the Investment Period; 1.50% per annum on invested capital thereafter
Carried Interest: 20% of net profits above the hurdle rate
Hurdle Rate: 8.00% per annum (cumulative, non-compounded)
Preferred Return: 8.00%
Fund Term: 10 years from Final Closing Date (subject to two one-year extensions)
Investment Period: 3 years from Final Closing Date
Domicile: Delaware, United States of America
Currency: US Dollars (USD)
Vintage Year: 2026

INVESTMENT VEHICLES
1. Stonecrest Capital Partners V, L.P. — Delaware Limited Partnership (U.S. taxable investors)
2. Stonecrest Capital Partners V (Cayman), L.P. — Cayman Islands Limited Partnership (non-U.S. investors and U.S. tax-exempt investors)

SHARE CLASSES
Class A — Standard institutional terms: 1.50% management fee / 20% carried interest / 8% hurdle
Class B — Reduced fee class for first-close investors: 1.25% management fee / 17.5% carried interest / 8% hurdle`;

interface ExtractedField {
  value: any;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source_text: string | null;
}

interface ExtractedFundData {
  fund_name: ExtractedField;
  vintage_year: ExtractedField;
  target_size: ExtractedField;
  hard_cap: ExtractedField;
  management_fee_rate: ExtractedField;
  carried_interest_rate: ExtractedField;
  hurdle_rate: ExtractedField;
  preferred_return: ExtractedField;
  fund_term_years: ExtractedField;
  investment_period_years: ExtractedField;
  domicile: ExtractedField;
  currency: ExtractedField;
  strategy: ExtractedField;
  vehicles: ExtractedField;
  share_classes: ExtractedField;
}

interface VehicleRow {
  name: string;
  legal_entity_type: string;
  domicile: string;
}

interface ShareClassRow {
  name: string;
  management_fee_rate: string;
  carried_interest_rate: string;
}

export default function Funds() {
  const navigate = useNavigate();

  const { data: fundsResponse, isLoading: fundsLoading, error: fundsError, refetch: refetchFunds } = useQuery({
    queryKey: ['funds'],
    queryFn: () => getFunds(),
  });

  const { data: classesResponse } = useQuery({
    queryKey: ['asset-classes'],
    queryFn: () => getAssetClasses(),
  });

  const funds = fundsResponse?.data || [];
  const assetClasses: AssetClass[] = classesResponse?.data || [];

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') || '');

  // Step 1
  const [documentText, setDocumentText] = useState('');
  const [documentType, setDocumentType] = useState('ppm');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');

  // Step 2 (review)
  const [editedFund, setEditedFund] = useState<any>({});
  const [assetClassId, setAssetClassId] = useState('');
  const [subAssetClassId, setSubAssetClassId] = useState('');
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [shareClassRows, setShareClassRows] = useState<ShareClassRow[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Step 3 (success)
  const [createdFund, setCreatedFund] = useState<{ id: number; name: string } | null>(null);

  const selectedAssetClass = assetClasses.find(a => a.id === parseInt(assetClassId));

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'fundraising': return 'badge-info';
      case 'investing': return 'badge-success';
      case 'harvesting': return 'badge-warning';
      case 'liquidating': return 'badge-danger';
      default: return 'badge-info';
    }
  };

  const confColor = (c: string) => {
    if (c === 'HIGH') return 'bg-green-100 text-green-800';
    if (c === 'MEDIUM') return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  const setField = (key: string, value: any) => {
    setEditedFund((prev: any) => ({ ...prev, [key]: { ...prev[key], value } }));
  };

  const openWizard = () => {
    setWizardStep(1);
    setDocumentText('');
    setDocumentType('ppm');
    setExtractError('');
    setCreateError('');
    setCreatedFund(null);
    setEditedFund({});
    setAssetClassId('');
    setSubAssetClassId('');
    setVehicles([]);
    setShareClassRows([]);
    setWizardOpen(true);
  };

  const closeWizard = () => setWizardOpen(false);

  const handleExtract = async () => {
    if (!documentText.trim()) {
      setExtractError('Please paste or type document text.');
      return;
    }
    const key = apiKey.trim();
    if (!key) {
      setExtractError('An Anthropic API key is required to extract data.');
      return;
    }
    localStorage.setItem('anthropic_api_key', key);
    setIsExtracting(true);
    setExtractError('');
    try {
      const resp = await fetch('https://gp-os-production.up.railway.app/api/funds/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({ document_text: documentText }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Extraction failed');
      }
      const { extracted }: { extracted: ExtractedFundData } = await resp.json();
      setEditedFund(extracted);
      setVehicles(
        Array.isArray(extracted.vehicles?.value)
          ? extracted.vehicles.value.map((v: any) => ({
              name: v.name || '',
              legal_entity_type: v.legal_entity_type || '',
              domicile: v.domicile || '',
            }))
          : []
      );
      setShareClassRows(
        Array.isArray(extracted.share_classes?.value)
          ? extracted.share_classes.value.map((sc: any) => ({
              name: sc.name || '',
              management_fee_rate: sc.management_fee_rate != null ? String(parseFloat((sc.management_fee_rate * 100).toFixed(4))) : '',
              carried_interest_rate: sc.carried_interest_rate != null ? String(parseFloat((sc.carried_interest_rate * 100).toFixed(4))) : '',
            }))
          : []
      );
      setWizardStep(2);
    } catch (err) {
      setExtractError((err as Error).message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCreateFund = async () => {
    if (!subAssetClassId) {
      setCreateError('Please select an Asset Class and Sub-Asset Class.');
      return;
    }
    setIsCreating(true);
    setCreateError('');
    try {
      // 1. Create fund
      const fundPayload = {
        sub_asset_class_id: parseInt(subAssetClassId),
        name: editedFund.fund_name?.value || 'New Fund',
        vintage_year: editedFund.vintage_year?.value ? parseInt(editedFund.vintage_year.value) : null,
        target_size: editedFund.target_size?.value ? parseFloat(editedFund.target_size.value) * 1_000_000 : null,
        hard_cap: editedFund.hard_cap?.value ? parseFloat(editedFund.hard_cap.value) * 1_000_000 : null,
        management_fee_rate: editedFund.management_fee_rate?.value ?? null,
        carried_interest_rate: editedFund.carried_interest_rate?.value ?? null,
        hurdle_rate: editedFund.hurdle_rate?.value ?? null,
        preferred_return: editedFund.preferred_return?.value ?? null,
        fund_term: editedFund.fund_term_years?.value ? parseFloat(editedFund.fund_term_years.value) : null,
        investment_period_end: editedFund.investment_period_years?.value
          ? `${(editedFund.vintage_year?.value || new Date().getFullYear()) + parseInt(editedFund.investment_period_years.value)}-12-31`
          : null,
        currency: editedFund.currency?.value || 'USD',
        domicile: editedFund.domicile?.value || null,
        status: 'fundraising',
      };

      const fundResp = await fetch('https://gp-os-production.up.railway.app/api/funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fundPayload),
      });
      if (!fundResp.ok) {
        const e = await fundResp.json();
        throw new Error(e.error || 'Failed to create fund');
      }
      const newFund = await fundResp.json();
      const fundId = newFund.id;

      // 2. Create vehicles
      for (const v of vehicles) {
        if (!v.name.trim()) continue;
        await fetch(`https://gp-os-production.up.railway.app/api/funds/${fundId}/vehicles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: v.name,
            legal_entity_type: v.legal_entity_type || null,
            domicile: v.domicile || null,
            status: 'active',
          }),
        });
      }

      // 3. Create share classes
      for (const sc of shareClassRows) {
        if (!sc.name.trim()) continue;
        await fetch(`https://gp-os-production.up.railway.app/api/funds/${fundId}/share-classes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sc.name,
            management_fee_rate: sc.management_fee_rate ? parseFloat(sc.management_fee_rate) / 100 : null,
            carried_interest_rate: sc.carried_interest_rate ? parseFloat(sc.carried_interest_rate) / 100 : null,
            status: 'active',
          }),
        });
      }

      // 4. Save document
      await fetch(`https://gp-os-production.up.railway.app/api/funds/${fundId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: documentType === 'ppm' ? 'Private Placement Memorandum' :
                 documentType === 'lpa' ? 'Limited Partnership Agreement' :
                 documentType === 'subscription' ? 'Subscription Agreement' : 'Fund Document',
          document_type: documentType,
          status: 'final',
        }),
      });

      setCreatedFund({ id: fundId, name: newFund.name });
      setWizardStep(3);
      refetchFunds();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const updateVehicle = (i: number, field: keyof VehicleRow, val: string) => {
    setVehicles(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: val } : v));
  };
  const removeVehicle = (i: number) => setVehicles(prev => prev.filter((_, idx) => idx !== i));
  const addVehicle = () => setVehicles(prev => [...prev, { name: '', legal_entity_type: '', domicile: '' }]);

  const updateSC = (i: number, field: keyof ShareClassRow, val: string) => {
    setShareClassRows(prev => prev.map((sc, idx) => idx === i ? { ...sc, [field]: val } : sc));
  };
  const removeSC = (i: number) => setShareClassRows(prev => prev.filter((_, idx) => idx !== i));
  const addSC = () => setShareClassRows(prev => [...prev, { name: '', management_fee_rate: '', carried_interest_rate: '' }]);

  const pctDisplay = (val: any) => {
    if (val == null) return '';
    const n = parseFloat(val);
    return isNaN(n) ? '' : (n * 100).toFixed(2);
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Security Master</h1>
          <p className="text-gray-600 mt-2">Funds & Investment Vehicles</p>
        </div>
        <button onClick={openWizard} className="btn btn-primary">
          New Fund
        </button>
      </div>

      {fundsLoading && (
        <div className="text-center py-12"><p className="text-gray-500">Loading funds...</p></div>
      )}
      {fundsError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Error loading funds: {(fundsError as any).message}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Fund Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Asset Class</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Target Size</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Committed</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Vehicles</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Share Classes</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">LPs</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {funds.map((fund: Fund) => (
              <tr key={fund.id} className="table-row">
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">{fund.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{fund.vintage_year}</p>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {fund.asset_class_name}<br />
                  <span className="text-xs text-gray-500">{fund.sub_asset_class}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`badge ${getStatusColor(fund.status)}`}>
                    {fund.status ? fund.status.charAt(0).toUpperCase() + fund.status.slice(1) : 'Unknown'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  ${fund.target_size ? (fund.target_size / 1_000_000).toFixed(0) : 0}M
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div>${fund.total_committed ? (fund.total_committed / 1_000_000).toFixed(0) : 0}M</div>
                  <div className="text-xs text-gray-500">
                    {fund.target_size ? ((fund.total_committed! / fund.target_size) * 100).toFixed(0) : 0}%
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{fund.vehicle_count || 0}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{fund.share_class_count || 0}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{fund.committed_lp_count || 0}</td>
                <td className="px-6 py-4 text-sm">
                  <button
                    onClick={() => navigate(`/security-master/funds/${fund.id}`)}
                    className="text-blue-600 hover:text-blue-900 font-medium"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!fundsLoading && funds.length === 0 && (
          <div className="px-6 py-12 text-center"><p className="text-gray-500">No funds configured</p></div>
        )}
      </div>

      {/* New Fund Wizard */}
      {wizardOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Create New Fund</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {wizardStep === 1 && 'Upload fund documents — AI will extract the terms'}
                  {wizardStep === 2 && 'Review extracted data and confirm before creating'}
                  {wizardStep === 3 && 'Fund created successfully'}
                </p>
              </div>
              <button onClick={closeWizard} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center px-6 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
              {['Upload Document', 'Review & Confirm', 'Done'].map((label, i) => {
                const step = i + 1;
                const active = wizardStep === step;
                const done = wizardStep > step;
                return (
                  <div key={step} className="flex items-center">
                    <div className={`flex items-center gap-2 text-sm font-medium ${done ? 'text-green-600' : active ? 'text-blue-700' : 'text-gray-400'}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2
                        ${done ? 'bg-green-600 border-green-600 text-white' : active ? 'bg-blue-700 border-blue-700 text-white' : 'border-gray-300'}`}>
                        {done ? '✓' : step}
                      </span>
                      {label}
                    </div>
                    {i < 2 && <div className="w-12 h-px bg-gray-300 mx-3" />}
                  </div>
                );
              })}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* ── STEP 1: Upload ── */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                    <strong>How it works:</strong> Paste text from your PPM, LPA, or subscription agreement below. AI extracts fund terms, vehicles, and share classes — you review everything before anything is created.
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Anthropic API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Stored locally, never sent to our servers.</p>
                  </div>

                  {/* Document type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                    <select
                      value={documentType}
                      onChange={e => setDocumentType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ppm">Private Placement Memorandum (PPM)</option>
                      <option value="lpa">Limited Partnership Agreement (LPA)</option>
                      <option value="subscription">Subscription Agreement</option>
                      <option value="term_sheet">Term Sheet</option>
                      <option value="other">Other Fund Document</option>
                    </select>
                  </div>

                  {/* Document text */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">Document Text</label>
                      <button
                        onClick={() => setDocumentText(SAMPLE_PPM)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Load Sample PPM
                      </button>
                    </div>
                    <textarea
                      value={documentText}
                      onChange={e => setDocumentText(e.target.value)}
                      rows={12}
                      placeholder="Paste document text here — PPM term sheet, LPA economics section, or any section describing the fund structure..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {extractError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{extractError}</div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={handleExtract}
                      disabled={isExtracting || !documentText.trim()}
                      className="btn btn-primary px-8"
                    >
                      {isExtracting ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Extracting...
                        </span>
                      ) : 'Extract Fund Data →'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Review ── */}
              {wizardStep === 2 && (
                <div className="space-y-6">
                  {/* Fund Details */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Fund Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Fund Name */}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-2">
                          Fund Name
                          {editedFund.fund_name?.confidence && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${confColor(editedFund.fund_name.confidence)}`}>
                              {editedFund.fund_name.confidence}
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={editedFund.fund_name?.value || ''}
                          onChange={e => setField('fund_name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Strategy */}
                      {editedFund.strategy?.value && (
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Strategy (extracted — for context)</label>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 italic">
                            {editedFund.strategy.value}
                          </div>
                        </div>
                      )}

                      {/* Asset Class — manual */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Asset Class <span className="text-red-500">*</span></label>
                        <select
                          value={assetClassId}
                          onChange={e => { setAssetClassId(e.target.value); setSubAssetClassId(''); }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Asset Class</option>
                          {assetClasses.map(ac => (
                            <option key={ac.id} value={ac.id}>{ac.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Sub-Asset Class <span className="text-red-500">*</span></label>
                        <select
                          value={subAssetClassId}
                          onChange={e => setSubAssetClassId(e.target.value)}
                          disabled={!assetClassId}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        >
                          <option value="">Select Sub-Asset Class</option>
                          {selectedAssetClass?.sub_classes?.map(sac => (
                            <option key={sac.id} value={sac.id}>{sac.name}</option>
                          ))}
                        </select>
                      </div>

                      {[
                        { key: 'vintage_year', label: 'Vintage Year', type: 'number' },
                        { key: 'domicile', label: 'Domicile', type: 'text' },
                        { key: 'currency', label: 'Currency', type: 'text' },
                        { key: 'fund_term_years', label: 'Fund Term (years)', type: 'number' },
                        { key: 'investment_period_years', label: 'Investment Period (years)', type: 'number' },
                      ].map(({ key, label, type }) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-2">
                            {label}
                            {editedFund[key]?.confidence && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${confColor(editedFund[key].confidence)}`}>
                                {editedFund[key].confidence}
                              </span>
                            )}
                          </label>
                          <input
                            type={type}
                            value={editedFund[key]?.value ?? ''}
                            onChange={e => setField(key, type === 'number' ? (e.target.value ? parseFloat(e.target.value) : null) : e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fund Economics */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Economics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'target_size', label: 'Target Size ($M)' },
                        { key: 'hard_cap', label: 'Hard Cap ($M)' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-2">
                            {label}
                            {editedFund[key]?.confidence && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${confColor(editedFund[key].confidence)}`}>
                                {editedFund[key].confidence}
                              </span>
                            )}
                          </label>
                          <input
                            type="number"
                            value={editedFund[key]?.value ?? ''}
                            onChange={e => setField(key, e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                      {[
                        { key: 'management_fee_rate', label: 'Mgmt Fee (%)' },
                        { key: 'carried_interest_rate', label: 'Carry (%)' },
                        { key: 'hurdle_rate', label: 'Hurdle Rate (%)' },
                        { key: 'preferred_return', label: 'Preferred Return (%)' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-2">
                            {label}
                            {editedFund[key]?.confidence && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${confColor(editedFund[key].confidence)}`}>
                                {editedFund[key].confidence}
                              </span>
                            )}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={pctDisplay(editedFund[key]?.value)}
                            onChange={e => setField(key, e.target.value ? parseFloat(e.target.value) / 100 : null)}
                            placeholder="e.g. 1.5"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Investment Vehicles */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Investment Vehicles</h3>
                      <button onClick={addVehicle} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Vehicle</button>
                    </div>
                    {vehicles.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No vehicles extracted — add one manually.</p>
                    ) : (
                      <div className="space-y-2">
                        {vehicles.map((v, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <input
                              type="text"
                              placeholder="Vehicle name"
                              value={v.name}
                              onChange={e => updateVehicle(i, 'name', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Entity type (e.g. LP)"
                              value={v.legal_entity_type}
                              onChange={e => updateVehicle(i, 'legal_entity_type', e.target.value)}
                              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Domicile"
                              value={v.domicile}
                              onChange={e => updateVehicle(i, 'domicile', e.target.value)}
                              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button onClick={() => removeVehicle(i)} className="text-red-400 hover:text-red-600 mt-2 text-lg leading-none">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Share Classes */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Share Classes</h3>
                      <button onClick={addSC} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Share Class</button>
                    </div>
                    {shareClassRows.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No share classes extracted — add one manually.</p>
                    ) : (
                      <div className="space-y-2">
                        {shareClassRows.map((sc, i) => (
                          <div key={i} className="flex gap-2 items-start">
                            <input
                              type="text"
                              placeholder="Class name (e.g. Class A)"
                              value={sc.name}
                              onChange={e => updateSC(i, 'name', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Mgmt Fee %"
                              value={sc.management_fee_rate}
                              onChange={e => updateSC(i, 'management_fee_rate', e.target.value)}
                              className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Carry %"
                              value={sc.carried_interest_rate}
                              onChange={e => updateSC(i, 'carried_interest_rate', e.target.value)}
                              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button onClick={() => removeSC(i)} className="text-red-400 hover:text-red-600 mt-2 text-lg leading-none">×</button>
                          </div>
                        ))}
                        <p className="text-xs text-gray-400">Fee fields are percentages (e.g. 1.5 for 1.5%)</p>
                      </div>
                    )}
                  </div>

                  {createError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{createError}</div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setWizardStep(1)} className="btn btn-secondary flex-1">
                      ← Back
                    </button>
                    <button
                      onClick={handleCreateFund}
                      disabled={isCreating || !subAssetClassId}
                      className="btn btn-primary flex-1"
                    >
                      {isCreating ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Creating...
                        </span>
                      ) : 'Create Fund →'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Success ── */}
              {wizardStep === 3 && createdFund && (
                <div className="flex flex-col items-center py-8 gap-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl">✓</div>
                  <h3 className="text-xl font-bold text-gray-900">{createdFund.name}</h3>
                  <p className="text-gray-500 text-sm">Fund created with vehicles, share classes, and document saved.</p>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => navigate(`/security-master/funds/${createdFund.id}`)}
                      className="btn btn-primary"
                    >
                      View Fund Detail →
                    </button>
                    <button onClick={openWizard} className="btn btn-secondary">
                      Create Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
