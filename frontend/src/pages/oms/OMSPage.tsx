import React, { useState, useEffect } from 'react';
import './OMSPage.css';

interface Fund {
  id: string;
  name: string;
  vehicle_ids: string[];
}

interface InvestmentVehicle {
  id: string;
  name: string;
  share_class_ids: string[];
}

interface ShareClass {
  id: string;
  name: string;
}

interface ExtractedField {
  value: string | number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source_text: string | null;
}

interface ExtractedData {
  lp_name: ExtractedField;
  lp_type: ExtractedField;
  investing_entity_legal_name: ExtractedField;
  investing_entity_type: ExtractedField;
  investing_entity_domicile: ExtractedField;
  tax_id: ExtractedField;
  commitment_amount: ExtractedField;
  share_class: ExtractedField;
  close_number: ExtractedField;
  contact_name: ExtractedField;
  contact_email: ExtractedField;
  contact_title: ExtractedField;
  special_terms: ExtractedField;
  notes: ExtractedField;
}

const SAMPLE_DOCUMENT = `SUBSCRIPTION AGREEMENT
Stonecrest Direct Lending Fund III

SUBSCRIBER INFORMATION

Subscriber Name: Pacific Rim Capital Partners LP
Type of Investor: Limited Partnership
Jurisdiction of Organization: Delaware, United States
Tax Identification Number: 84-7654321

CONTACT INFORMATION
Primary Contact: James Nakamura
Title: Managing Director, Private Credit
Email: j.nakamura@pacificrimcapital.com

SUBSCRIPTION DETAILS
Aggregate Capital Commitment: $75,000,000 (Seventy-Five Million US Dollars)
Share Class: Class A
Requested Closing: First Close

The Subscriber represents that the foregoing information is accurate and that it is an "accredited investor" as defined under Regulation D of the Securities Act of 1933.

IN WITNESS WHEREOF, the Subscriber has executed this Subscription Agreement as of March 15, 2024.

Pacific Rim Capital Partners LP
By: Pacific Rim Capital Management LLC, its General Partner
Name: James Nakamura
Title: Managing Director`;

export default function OMSPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [apiKey, setApiKey] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [vehicles, setVehicles] = useState<InvestmentVehicle[]>([]);
  const [shareClasses, setShareClasses] = useState<ShareClass[]>([]);

  // Step 1 state
  const [selectedFund, setSelectedFund] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedShareClass, setSelectedShareClass] = useState('');

  // Step 2 state
  const [documentText, setDocumentText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState('');

  // Step 3 state
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [editedData, setEditedData] = useState<any>({});

  // Step 4 state
  const [createdCommitment, setCreatedCommitment] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Load funds on mount
  useEffect(() => {
    loadFunds();
  }, []);

  // Load vehicles when fund changes
  useEffect(() => {
    if (selectedFund) {
      loadVehiclesForFund(selectedFund);
    }
  }, [selectedFund]);

  // Load share classes when vehicle changes
  useEffect(() => {
    if (selectedVehicle) {
      loadShareClassesForVehicle(selectedVehicle);
    }
  }, [selectedVehicle]);

  const loadFunds = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/funds');
      const data = await response.json();
      setFunds(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading funds:', error);
    }
  };

  const loadVehiclesForFund = async (fundId: string) => {
    try {
      const response = await fetch(`http://localhost:3002/api/investment-vehicles?fund_id=${fundId}`);
      const data = await response.json();
      setVehicles(Array.isArray(data) ? data : []);
      setSelectedVehicle('');
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const loadShareClassesForVehicle = async (vehicleId: string) => {
    try {
      const response = await fetch(`http://localhost:3002/api/investment-vehicles/${vehicleId}/share-classes`);
      const data = await response.json();
      setShareClasses(Array.isArray(data) ? data : []);
      setSelectedShareClass('');
    } catch (error) {
      console.error('Error loading share classes:', error);
    }
  };

  const handleSetApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('anthropic_api_key', apiKey);
      setApiKeySet(true);
    }
  };

  const handleLoadSample = () => {
    setDocumentText(SAMPLE_DOCUMENT);
  };

  const handleExtract = async () => {
    if (!documentText.trim()) {
      setExtractionError('Please enter or paste a document');
      return;
    }

    if (!apiKey.trim() && !localStorage.getItem('anthropic_api_key')) {
      setExtractionError('API key is required');
      return;
    }

    setIsExtracting(true);
    setExtractionError('');

    try {
      const key = apiKey || localStorage.getItem('anthropic_api_key') || '';
      const response = await fetch('http://localhost:3002/api/oms/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key
        },
        body: JSON.stringify({
          document_text: documentText,
          fund_name: funds.find((f) => f.id === selectedFund)?.name,
          vehicle_name: vehicles.find((v) => v.id === selectedVehicle)?.name
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Extraction failed');
      }

      const result = await response.json();
      setExtracted(result.extracted);
      setEditedData({ ...result.extracted });
      setStep(3);
    } catch (error) {
      setExtractionError((error as Error).message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirm = async () => {
    if (!apiKey.trim() && !localStorage.getItem('anthropic_api_key')) {
      alert('API key is required');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('http://localhost:3002/api/oms/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || localStorage.getItem('anthropic_api_key') || ''
        },
        body: JSON.stringify({
          fund_id: selectedFund,
          vehicle_id: selectedVehicle,
          share_class_id: selectedShareClass,
          lp_name: editedData.lp_name.value,
          lp_type: editedData.lp_type.value,
          investing_entity_legal_name: editedData.investing_entity_legal_name.value,
          investing_entity_type: editedData.investing_entity_type.value,
          investing_entity_domicile: editedData.investing_entity_domicile.value,
          tax_id: editedData.tax_id.value,
          commitment_amount: Number(editedData.commitment_amount.value),
          close_number: editedData.close_number.value,
          contact_name: editedData.contact_name.value,
          contact_email: editedData.contact_email.value,
          contact_title: editedData.contact_title.value,
          special_terms: editedData.special_terms.value,
          document_title: 'Subscription Agreement'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Creation failed');
      }

      const result = await response.json();
      setCreatedCommitment(result);
      setStep(4);
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setDocumentText('');
    setExtracted(null);
    setEditedData({});
    setCreatedCommitment(null);
    setExtractionError('');
  };

  const updateEditedField = (field: string, value: any) => {
    setEditedData({
      ...editedData,
      [field]: {
        ...editedData[field],
        value
      }
    });
  };

  const getConfidenceBadgeClass = (confidence: string) => {
    switch (confidence) {
      case 'HIGH':
        return 'badge-high';
      case 'MEDIUM':
        return 'badge-medium';
      case 'LOW':
        return 'badge-low';
      default:
        return '';
    }
  };

  return (
    <div className="oms-page">
      <div className="oms-container">
        <div className="oms-header">
          <h1>Order Management System</h1>
          <p>Upload and process subscription documents with AI-powered extraction</p>
        </div>

        {/* Step Indicator */}
        <div className="step-indicator">
          <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">Fund & Vehicle</div>
          </div>
          <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">Upload Document</div>
          </div>
          <div className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">Review & Confirm</div>
          </div>
          <div className={`step ${step >= 4 ? 'active' : ''}`}>
            <div className="step-number">4</div>
            <div className="step-label">Success</div>
          </div>
        </div>

        {/* API Key Setup */}
        {!apiKeySet && step < 4 && (
          <div className="api-key-section">
            <div className="api-key-content">
              <label>Anthropic API Key:</label>
              <div className="api-key-input-group">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Anthropic API key"
                />
                <button onClick={handleSetApiKey} className="btn-secondary">
                  Set Key
                </button>
              </div>
              <p className="api-key-hint">Your API key is stored locally and used only for extraction requests.</p>
            </div>
          </div>
        )}

        {/* Step 1: Fund & Vehicle Selection */}
        {step === 1 && (
          <div className="wizard-panel">
            <h2>Select Fund & Investment Vehicle</h2>

            <div className="form-group">
              <label>Fund</label>
              <select value={selectedFund} onChange={(e) => setSelectedFund(e.target.value)}>
                <option value="">-- Select Fund --</option>
                {funds.map((fund) => (
                  <option key={fund.id} value={fund.id}>
                    {fund.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Investment Vehicle</label>
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                disabled={!selectedFund}
              >
                <option value="">-- Select Vehicle --</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Share Class</label>
              <select
                value={selectedShareClass}
                onChange={(e) => setSelectedShareClass(e.target.value)}
                disabled={!selectedVehicle}
              >
                <option value="">-- Select Share Class --</option>
                {shareClasses.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="wizard-actions">
              <button
                onClick={() => setStep(2)}
                disabled={!selectedFund || !selectedVehicle || !selectedShareClass}
                className="btn-primary"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Document Upload */}
        {step === 2 && (
          <div className="wizard-panel">
            <h2>Upload Subscription Document</h2>

            <div className="form-group">
              <label>Document Text</label>
              <textarea
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                placeholder="Paste your subscription document text here..."
                rows={12}
              />
              <button onClick={handleLoadSample} className="btn-secondary btn-small">
                Load Sample Document
              </button>
            </div>

            {extractionError && <div className="error-message">{extractionError}</div>}

            <div className="wizard-actions">
              <button onClick={() => setStep(1)} className="btn-secondary">
                Back
              </button>
              <button
                onClick={handleExtract}
                disabled={isExtracting || !documentText.trim()}
                className="btn-primary"
              >
                {isExtracting ? 'Analyzing document...' : 'Extract Information'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === 3 && extracted && (
          <div className="wizard-panel">
            <h2>Review Extracted Information</h2>

            <div className="form-section">
              <h3>LP Information</h3>

              <div className="form-group">
                <label>
                  LP Name
                  <span className={`confidence-badge ${getConfidenceBadgeClass(editedData.lp_name.confidence)}`}>
                    {editedData.lp_name.confidence}
                  </span>
                </label>
                <input
                  type="text"
                  value={editedData.lp_name.value}
                  onChange={(e) => updateEditedField('lp_name', e.target.value)}
                />
                {editedData.lp_name.source_text && (
                  <details className="source-text">
                    <summary>Source</summary>
                    <p>{editedData.lp_name.source_text}</p>
                  </details>
                )}
              </div>

              <div className="form-group">
                <label>
                  LP Type
                  <span className={`confidence-badge ${getConfidenceBadgeClass(editedData.lp_type.confidence)}`}>
                    {editedData.lp_type.confidence}
                  </span>
                </label>
                <select
                  value={editedData.lp_type.value || ''}
                  onChange={(e) => updateEditedField('lp_type', e.target.value || null)}
                >
                  <option value="">-- Select --</option>
                  <option value="pension">Pension</option>
                  <option value="endowment">Endowment</option>
                  <option value="family_office">Family Office</option>
                  <option value="sovereign_wealth">Sovereign Wealth</option>
                  <option value="foundation">Foundation</option>
                  <option value="insurance">Insurance</option>
                  <option value="fund_of_funds">Fund of Funds</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-section">
              <h3>Investing Entity</h3>

              <div className="form-group">
                <label>
                  Legal Name
                  <span
                    className={`confidence-badge ${getConfidenceBadgeClass(editedData.investing_entity_legal_name.confidence)}`}
                  >
                    {editedData.investing_entity_legal_name.confidence}
                  </span>
                </label>
                <input
                  type="text"
                  value={editedData.investing_entity_legal_name.value}
                  onChange={(e) => updateEditedField('investing_entity_legal_name', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>
                  Entity Type
                  <span
                    className={`confidence-badge ${getConfidenceBadgeClass(editedData.investing_entity_type.confidence)}`}
                  >
                    {editedData.investing_entity_type.confidence}
                  </span>
                </label>
                <select
                  value={editedData.investing_entity_type.value || ''}
                  onChange={(e) => updateEditedField('investing_entity_type', e.target.value || null)}
                >
                  <option value="">-- Select --</option>
                  <option value="LP">LP</option>
                  <option value="LLC">LLC</option>
                  <option value="trust">Trust</option>
                  <option value="corporation">Corporation</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  Domicile/Jurisdiction
                  <span
                    className={`confidence-badge ${getConfidenceBadgeClass(editedData.investing_entity_domicile.confidence)}`}
                  >
                    {editedData.investing_entity_domicile.confidence}
                  </span>
                </label>
                <input
                  type="text"
                  value={editedData.investing_entity_domicile.value || ''}
                  onChange={(e) => updateEditedField('investing_entity_domicile', e.target.value || null)}
                />
              </div>

              <div className="form-group">
                <label>
                  Tax ID
                  <span className={`confidence-badge ${getConfidenceBadgeClass(editedData.tax_id.confidence)}`}>
                    {editedData.tax_id.confidence}
                  </span>
                </label>
                <input
                  type="text"
                  value={editedData.tax_id.value || ''}
                  onChange={(e) => updateEditedField('tax_id', e.target.value || null)}
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Investment Terms</h3>

              <div className="form-group">
                <label>
                  Commitment Amount
                  <span
                    className={`confidence-badge ${getConfidenceBadgeClass(editedData.commitment_amount.confidence)}`}
                  >
                    {editedData.commitment_amount.confidence}
                  </span>
                </label>
                <input
                  type="number"
                  value={editedData.commitment_amount.value || ''}
                  onChange={(e) => updateEditedField('commitment_amount', e.target.value ? Number(e.target.value) : null)}
                />
              </div>

              <div className="form-group">
                <label>
                  Share Class
                  <span className={`confidence-badge ${getConfidenceBadgeClass(editedData.share_class.confidence)}`}>
                    {editedData.share_class.confidence}
                  </span>
                </label>
                <input
                  type="text"
                  value={editedData.share_class.value || ''}
                  onChange={(e) => updateEditedField('share_class', e.target.value || null)}
                />
              </div>

              <div className="form-group">
                <label>
                  Close Number
                  <span className={`confidence-badge ${getConfidenceBadgeClass(editedData.close_number.confidence)}`}>
                    {editedData.close_number.confidence}
                  </span>
                </label>
                <select
                  value={editedData.close_number.value || ''}
                  onChange={(e) => updateEditedField('close_number', e.target.value || null)}
                >
                  <option value="">-- Select --</option>
                  <option value="first">First Close</option>
                  <option value="second">Second Close</option>
                  <option value="third">Third Close</option>
                  <option value="final">Final Close</option>
                </select>
              </div>
            </div>

            <div className="form-section">
              <h3>Contact</h3>

              <div className="form-group">
                <label>
                  Contact Name
                  <span className={`confidence-badge ${getConfidenceBadgeClass(editedData.contact_name.confidence)}`}>
                    {editedData.contact_name.confidence}
                  </span>
                </label>
                <input
                  type="text"
                  value={editedData.contact_name.value || ''}
                  onChange={(e) => updateEditedField('contact_name', e.target.value || null)}
                />
              </div>

              <div className="form-group">
                <label>
                  Contact Title
                  <span className={`confidence-badge ${getConfidenceBadgeClass(editedData.contact_title.confidence)}`}>
                    {editedData.contact_title.confidence}
                  </span>
                </label>
                <input
                  type="text"
                  value={editedData.contact_title.value || ''}
                  onChange={(e) => updateEditedField('contact_title', e.target.value || null)}
                />
              </div>

              <div className="form-group">
                <label>
                  Contact Email
                  <span className={`confidence-badge ${getConfidenceBadgeClass(editedData.contact_email.confidence)}`}>
                    {editedData.contact_email.confidence}
                  </span>
                </label>
                <input
                  type="email"
                  value={editedData.contact_email.value || ''}
                  onChange={(e) => updateEditedField('contact_email', e.target.value || null)}
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Special Terms & Notes</h3>

              <div className="form-group">
                <label>
                  Special Terms
                  <span className={`confidence-badge ${getConfidenceBadgeClass(editedData.special_terms.confidence)}`}>
                    {editedData.special_terms.confidence}
                  </span>
                </label>
                <textarea
                  value={editedData.special_terms.value || ''}
                  onChange={(e) => updateEditedField('special_terms', e.target.value || null)}
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label>
                  Notes
                  <span className={`confidence-badge ${getConfidenceBadgeClass(editedData.notes.confidence)}`}>
                    {editedData.notes.confidence}
                  </span>
                </label>
                <textarea
                  value={editedData.notes.value || ''}
                  onChange={(e) => updateEditedField('notes', e.target.value || null)}
                  rows={4}
                />
              </div>
            </div>

            <div className="wizard-actions">
              <button onClick={() => setStep(2)} className="btn-secondary">
                Back
              </button>
              <button onClick={handleConfirm} disabled={isCreating} className="btn-primary">
                {isCreating ? 'Creating...' : 'Confirm & Create Commitment'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && createdCommitment && (
          <div className="wizard-panel success-panel">
            <div className="success-icon">✓</div>
            <h2>Commitment Created Successfully</h2>

            <div className="success-details">
              <div className="detail-row">
                <span className="detail-label">LP Name:</span>
                <span className="detail-value">{createdCommitment.lp.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Investing Entity:</span>
                <span className="detail-value">{createdCommitment.entity.legal_name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Commitment Amount:</span>
                <span className="detail-value">
                  ${Number(createdCommitment.commitment.commitment_amount).toLocaleString()}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Vehicle ID:</span>
                <span className="detail-value">{createdCommitment.commitment.investment_vehicle_id}</span>
              </div>
            </div>

            <div className="wizard-actions">
              <button
                onClick={() =>
                  (window.location.href = `/crm/lps/${createdCommitment.lp.id}/entities/${createdCommitment.entity.id}/commitments/${createdCommitment.commitment.id}`)
                }
                className="btn-primary"
              >
                View Commitment
              </button>
              <button onClick={handleReset} className="btn-secondary">
                Create Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
