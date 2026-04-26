import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPositionDetail } from '../../api';
import Layout from '../../components/Layout';

function fmt(n: number | null | undefined, suffix = 'M', decimals = 1) {
  if (n == null) return '—';
  return `$${(n / 1_000_000).toFixed(decimals)}${suffix}`;
}
function fmtPct(n: number | null | undefined, decimals = 2) {
  if (n == null) return '—';
  return `${(n * 100).toFixed(decimals)}%`;
}
function fmtX(n: number | null | undefined) {
  if (n == null) return '—';
  return `${n.toFixed(1)}x`;
}
function fmtDate(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-blue-600' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function ConfBadge({ confidence }: { confidence?: string }) {
  if (!confidence) return null;
  const map: Record<string, string> = {
    HIGH: 'bg-green-100 text-green-700',
    MEDIUM: 'bg-amber-100 text-amber-700',
    LOW: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ml-1.5 ${map[confidence] || 'bg-gray-100 text-gray-600'}`}>
      {confidence}
    </span>
  );
}

// ──────────────────────────────────────────────────────────
//  Log Call Wizard
// ──────────────────────────────────────────────────────────
interface ExtractedField {
  value: any;
  confidence: string;
  source_text: string;
}
interface Extracted {
  leverage_ratio?: ExtractedField;
  interest_coverage?: ExtractedField;
  ebitda?: ExtractedField;
  revenue?: ExtractedField;
  fair_value?: ExtractedField;
  advance_rate?: ExtractedField;
  levered_yield?: ExtractedField;
  key_developments?: ExtractedField;
  summary?: ExtractedField;
}

interface LogCallWizardProps {
  positionId: number;
  dealName: string;
  onClose: () => void;
  onSaved: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  leverage_ratio: 'Leverage Ratio (x)',
  interest_coverage: 'Interest Coverage (x)',
  ebitda: 'EBITDA ($)',
  revenue: 'Revenue ($)',
  fair_value: 'Fair Value ($)',
  advance_rate: 'Advance Rate (%)',
  levered_yield: 'Levered Yield (%)',
  key_developments: 'Key Developments',
  summary: 'Call Summary',
};

function formatExtractedValue(field: string, val: any): string {
  if (val === null || val === undefined) return '';
  if (field === 'advance_rate' || field === 'levered_yield') {
    return (val * 100).toFixed(2);
  }
  if (field === 'ebitda' || field === 'revenue' || field === 'fair_value') {
    return (val / 1_000_000).toFixed(2);
  }
  if (field === 'leverage_ratio' || field === 'interest_coverage') {
    return String(val);
  }
  return String(val);
}

function LogCallWizard({ positionId, dealName, onClose, onSaved }: LogCallWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') || '');
  const [transcript, setTranscript] = useState('');
  const [callType, setCallType] = useState('monthly_update');
  const [callDate, setCallDate] = useState(new Date().toISOString().substring(0, 10));
  const [participants, setParticipants] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  // editable copies of extracted values
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleExtract = async () => {
    if (!transcript.trim()) { setExtractError('Please paste a transcript or call notes.'); return; }
    const key = apiKey || localStorage.getItem('anthropic_api_key') || '';
    setExtracting(true);
    setExtractError('');
    try {
      const res = await fetch(`http://localhost:3002/api/portfolio/positions/${positionId}/ingest-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({ transcript, call_type: callType, call_date: callDate, participants }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Extraction failed');
      setExtracted(json.extracted);
      // Populate editable values from extracted
      const ev: Record<string, string> = {};
      for (const [field, ef] of Object.entries(json.extracted as Extracted)) {
        if ((ef as ExtractedField).value !== null && (ef as ExtractedField).value !== undefined) {
          ev[field] = formatExtractedValue(field, (ef as ExtractedField).value);
        }
      }
      setEditedValues(ev);
      setStep(2);
    } catch (err: any) {
      setExtractError(err.message || 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const parseBack = (field: string, raw: string): any => {
    if (!raw && raw !== '0') return null;
    const n = parseFloat(raw);
    if (isNaN(n)) return raw; // text fields
    if (field === 'advance_rate' || field === 'levered_yield') return n / 100;
    if (field === 'ebitda' || field === 'revenue' || field === 'fair_value') return n * 1_000_000;
    return n;
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      // Build extractions array
      const extractions = extracted
        ? Object.entries(extracted).map(([field, ef]: [string, any]) => ({
            field,
            extracted_value: editedValues[field] !== undefined ? parseBack(field, editedValues[field]) : ef.value,
            confidence_score: ef.confidence,
            extraction_rationale: ef.source_text,
            approved: true,
          }))
        : [];

      const body: any = {
        transcript,
        call_type: callType,
        call_date: callDate,
        participants,
        summary: editedValues['summary'] || extracted?.summary?.value || null,
        key_developments: editedValues['key_developments'] || extracted?.key_developments?.value || null,
        extractions,
      };

      // Pass through numeric metrics
      const numericFields = ['leverage_ratio', 'interest_coverage', 'ebitda', 'revenue', 'fair_value', 'advance_rate', 'levered_yield'];
      for (const f of numericFields) {
        const raw = editedValues[f];
        if (raw !== undefined && raw !== '') {
          body[f] = parseBack(f, raw);
        }
      }

      const res = await fetch(`http://localhost:3002/api/portfolio/positions/${positionId}/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setStep(3);
    } catch (err: any) {
      setSaveError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Log Investment Call</h2>
            <p className="text-xs text-gray-500 mt-0.5">{dealName}</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Step indicator */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              {[1, 2, 3].map(s => (
                <span key={s} className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold text-xs ${
                  step === s ? 'bg-blue-600 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{step > s ? '✓' : s}</span>
              ))}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* ── Step 1: Input ── */}
          {step === 1 && (
            <div className="p-6 space-y-5">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Paste transcript or call notes</p>
                <p className="text-xs text-gray-500 mb-3">Claude will extract financial metrics, key developments, and a call summary automatically.</p>
                <textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  rows={10}
                  placeholder="Paste the call transcript, meeting notes, or discussion points here...&#10;&#10;e.g. 'Q3 earnings call with CEO. Revenue came in at $48M, up 12% YoY. EBITDA was $14.2M with margins expanding 80bps. Leverage at 3.8x per compliance cert...'"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Call Type</label>
                  <select
                    value={callType}
                    onChange={e => setCallType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly_update">Monthly Update</option>
                    <option value="quarterly_review">Quarterly Review</option>
                    <option value="ad_hoc">Ad Hoc</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Call Date</label>
                  <input
                    type="date"
                    value={callDate}
                    onChange={e => setCallDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Participants</label>
                <input
                  type="text"
                  value={participants}
                  onChange={e => setParticipants(e.target.value)}
                  placeholder="J. Smith (PM), M. Johnson (CFO), S. Lee (IR)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anthropic API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); localStorage.setItem('anthropic_api_key', e.target.value); }}
                  placeholder="sk-ant-... (used only for extraction)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Stored in your browser. Required for AI extraction. Server uses ANTHROPIC_API_KEY if set.</p>
              </div>

              {extractError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{extractError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleExtract}
                  disabled={extracting || !transcript.trim()}
                  className="flex-1 btn btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {extracting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Extracting with AI...
                    </>
                  ) : '✦ Extract with AI →'}
                </button>
                <button onClick={onClose} className="px-4 py-2 btn btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {/* ── Step 2: Review ── */}
          {step === 2 && extracted && (
            <div className="p-6 space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <strong>Review AI extraction.</strong> Edit any values before confirming. Green = HIGH confidence, amber = MEDIUM, red = LOW.
              </div>

              {/* Summary & Key Developments */}
              <div className="space-y-4">
                {(['summary', 'key_developments'] as const).map(field => {
                  const ef = extracted[field];
                  if (!ef) return null;
                  return (
                    <div key={field}>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                        {FIELD_LABELS[field]}
                        <ConfBadge confidence={ef.confidence} />
                      </label>
                      <textarea
                        rows={field === 'summary' ? 3 : 4}
                        value={editedValues[field] ?? (ef.value || '')}
                        onChange={e => setEditedValues(prev => ({ ...prev, [field]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {ef.source_text && (
                        <p className="text-xs text-gray-400 mt-1 italic">Source: "{ef.source_text.substring(0, 120)}{ef.source_text.length > 120 ? '...' : ''}"</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Numeric Metrics Grid */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-3">Extracted Metrics</p>
                <div className="grid grid-cols-2 gap-4">
                  {(['leverage_ratio', 'interest_coverage', 'ebitda', 'revenue', 'fair_value', 'advance_rate', 'levered_yield'] as const).map(field => {
                    const ef = extracted[field];
                    const isEmpty = ef?.value === null || ef?.value === undefined;
                    return (
                      <div key={field}>
                        <label className="flex items-center text-xs font-medium text-gray-600 mb-1">
                          {FIELD_LABELS[field]}
                          {ef && <ConfBadge confidence={ef.confidence} />}
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={editedValues[field] ?? ''}
                          onChange={e => setEditedValues(prev => ({ ...prev, [field]: e.target.value }))}
                          placeholder={isEmpty ? 'Not mentioned' : undefined}
                          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            isEmpty ? 'border-gray-200 bg-gray-50 text-gray-400' : 'border-gray-300'
                          }`}
                        />
                        {ef?.source_text && (
                          <p className="text-xs text-gray-400 mt-0.5 italic truncate">"{ef.source_text.substring(0, 80)}"</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  EBITDA/Revenue/Fair Value in $M · Advance Rate/Yield in % · Leverage/Coverage in x
                </p>
              </div>

              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{saveError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 btn btn-primary disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Confirm & Save Call Record'}
                </button>
                <button onClick={() => setStep(1)} className="px-4 py-2 btn btn-secondary">← Back</button>
              </div>
            </div>
          )}

          {/* ── Step 3: Success ── */}
          {step === 3 && (
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto text-3xl">✓</div>
              <h3 className="text-xl font-bold text-gray-900">Call Logged</h3>
              <p className="text-gray-600 text-sm max-w-sm mx-auto">
                The call record, extracted metrics, and AI summary have been saved. The position's last updated timestamp has been refreshed.
              </p>
              <button
                onClick={onSaved}
                className="btn btn-primary mt-4"
              >
                View Updated Position
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
//  Main Page
// ──────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────
//  Transcript → Task Wizard
// ──────────────────────────────────────────────────────────
interface ExtractedTask {
  title: string;
  description: string;
  assigned_to_id: number;
  assigned_to_name: string;
  assigned_to_initials: string;
  source_quote: string;
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  include: boolean; // user can toggle off
}

function TranscriptTaskWizard({ dealId, dealName, onClose, onSaved }: {
  dealId: number; dealName: string; onClose: () => void; onSaved: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') || '');
  const [transcript, setTranscript] = useState('');
  const [participants, setParticipants] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [callSummary, setCallSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleExtract = async () => {
    if (!transcript.trim()) { setExtractError('Please paste a transcript.'); return; }
    const key = apiKey || localStorage.getItem('anthropic_api_key') || '';
    setExtracting(true); setExtractError('');
    try {
      const res = await fetch('http://localhost:3002/api/tasks/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({ transcript, deal_id: dealId, participants }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Extraction failed');
      setExtractedTasks((json.tasks || []).map((t: any) => ({ ...t, include: true })));
      setCallSummary(json.summary || '');
      if (key) localStorage.setItem('anthropic_api_key', key);
      setStep(2);
    } catch (err: any) {
      setExtractError(err.message || 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true); setSaveError('');
    try {
      const toSave = extractedTasks.filter(t => t.include);
      const res = await fetch('http://localhost:3002/api/tasks/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: toSave, deal_id: dealId, created_by: 1 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setStep(3);
    } catch (err: any) {
      setSaveError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Extract Tasks from Transcript</h2>
            <p className="text-xs text-gray-500 mt-0.5">{dealName}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map(s => (
                <span key={s} className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold text-xs ${
                  step === s ? 'bg-violet-600 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{step > s ? '✓' : s}</span>
              ))}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Step 1 */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Paste call transcript or meeting notes</p>
                <p className="text-xs text-gray-500 mb-3">Claude will extract action items and assign them to the right team members automatically.</p>
                <textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  rows={10}
                  placeholder="Paste the transcript here...&#10;&#10;e.g. 'Sarah said she would follow up with the CFO on the updated model by end of month. James needs to pull the compliance cert. Admin should update the advance rate in the system...'"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Participants (optional)</label>
                <input type="text" value={participants} onChange={e => setParticipants(e.target.value)}
                  placeholder="e.g. Sarah Chen, Alex Thompson, CFO"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anthropic API Key</label>
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              {extractError && <p className="text-red-600 text-sm">{extractError}</p>}
              <button onClick={handleExtract} disabled={extracting}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors">
                {extracting ? 'Extracting tasks...' : 'Extract Tasks →'}
              </button>
            </div>
          )}

          {/* Step 2 — Review */}
          {step === 2 && (
            <div className="p-6 space-y-4">
              {callSummary && (
                <div className="bg-violet-50 border border-violet-100 rounded-lg p-4 text-sm text-gray-800">
                  <p className="text-xs font-semibold text-violet-600 uppercase mb-1.5">Call Summary</p>
                  {callSummary}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">
                  {extractedTasks.length} action items extracted — review and confirm
                </p>
                <p className="text-xs text-gray-500">Uncheck any items you don't want to add. Edit titles and assignees as needed.</p>
              </div>
              <div className="space-y-3">
                {extractedTasks.map((task, i) => (
                  <div key={i} className={`border rounded-lg p-4 transition-colors ${task.include ? 'border-violet-200 bg-violet-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={task.include}
                        onChange={e => setExtractedTasks(prev => prev.map((t, j) => j === i ? { ...t, include: e.target.checked } : t))}
                        className="mt-1 w-4 h-4 rounded border-gray-300 text-violet-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={task.title}
                          onChange={e => setExtractedTasks(prev => prev.map((t, j) => j === i ? { ...t, title: e.target.value } : t))}
                          className="w-full text-sm font-medium text-gray-900 bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-violet-400 focus:outline-none pb-0.5 mb-2"
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
                            <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-center text-xs leading-4 flex-shrink-0">{task.assigned_to_initials}</span>
                            {task.assigned_to_name}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${priorityColors[task.priority]}`}>{task.priority}</span>
                          {task.due_date && <span className="text-xs text-gray-500">Due {task.due_date}</span>}
                        </div>
                        {task.source_quote && (
                          <p className="mt-2 text-xs text-gray-500 italic border-l-2 border-violet-300 pl-2">"{task.source_quote}"</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {saveError && <p className="text-red-600 text-sm">{saveError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg text-sm hover:bg-gray-50">← Back</button>
                <button onClick={handleSave} disabled={saving || extractedTasks.filter(t => t.include).length === 0}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors">
                  {saving ? 'Adding tasks...' : `Add ${extractedTasks.filter(t => t.include).length} Tasks →`}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Done */}
          {step === 3 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Tasks Added</h3>
              <p className="text-gray-500 text-sm mb-6">{extractedTasks.filter(t => t.include).length} action items added to the investment task board and each person's queue.</p>
              <button onClick={onSaved} className="px-6 py-2.5 bg-violet-600 text-white font-semibold rounded-lg text-sm hover:bg-violet-700">View Tasks</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
//  Covenant Panel
// ──────────────────────────────────────────────────────────
const LEV_WARN = 4.5;
const LEV_BREACH = 5.25;
const ICOV_WARN = 2.0;
const ICOV_BREACH = 1.75;
const LEV_MAX_DISPLAY = 7.0;
const ICOV_MAX_DISPLAY = 5.0;

function CovenantGauge({
  label, value, warnThreshold, breachThreshold, maxDisplay, isInverse, unit = 'x',
}: {
  label: string;
  value: number | null;
  warnThreshold: number;
  breachThreshold: number;
  maxDisplay: number;
  isInverse: boolean; // true = lower is worse (leverage), false = higher is worse (coverage)
  unit?: string;
}) {
  if (value == null) {
    return (
      <div className="bg-gray-50 rounded-xl p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{label}</p>
        <p className="text-2xl font-bold text-gray-400">—</p>
        <p className="text-xs text-gray-400 mt-1">No data available</p>
      </div>
    );
  }

  const pct = Math.min(value / maxDisplay * 100, 100);
  const warnPct = Math.min(warnThreshold / maxDisplay * 100, 100);
  const breachPct = Math.min(breachThreshold / maxDisplay * 100, 100);

  // Status
  const isBreach = isInverse ? value > breachThreshold : value < breachThreshold;
  const isWarn = !isBreach && (isInverse ? value > warnThreshold : value < warnThreshold);
  const statusColor = isBreach ? 'text-red-600' : isWarn ? 'text-amber-600' : 'text-emerald-600';
  const barColor = isBreach ? 'bg-red-500' : isWarn ? 'bg-amber-400' : 'bg-emerald-500';
  const statusLabel = isBreach ? 'Breach' : isWarn ? 'Warning' : 'Current';
  const statusBg = isBreach ? 'bg-red-100 text-red-700' : isWarn ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

  return (
    <div className="bg-gray-50 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBg}`}>{statusLabel}</span>
      </div>
      <p className={`text-3xl font-bold mb-1 ${statusColor}`}>{value.toFixed(1)}{unit}</p>
      <p className="text-xs text-gray-400 mb-4">
        {isInverse
          ? `Warn > ${warnThreshold}x · Breach > ${breachThreshold}x`
          : `Warn < ${warnThreshold}x · Breach < ${breachThreshold}x`}
      </p>

      {/* Gauge bar */}
      <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
        {/* Filled bar */}
        <div
          className={`absolute top-0 left-0 h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
        {/* Warning threshold marker */}
        <div
          className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-amber-500 opacity-80"
          style={{ left: `${warnPct}%` }}
          title={`Warning: ${warnThreshold}x`}
        />
        {/* Breach threshold marker */}
        <div
          className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-red-500 opacity-80"
          style={{ left: `${breachPct}%` }}
          title={`Breach: ${breachThreshold}x`}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-1.5 text-xs text-gray-400">
        <span>0{unit}</span>
        <span className="text-amber-500">{warnThreshold}{unit}</span>
        <span className="text-red-500">{breachThreshold}{unit}</span>
        <span>{maxDisplay}{unit}+</span>
      </div>
    </div>
  );
}

function CovenantPanel({ covenant, dealId }: { covenant: any | null; dealId: number }) {
  if (!covenant) {
    return (
      <div className="card p-12 text-center text-gray-500">
        <p className="text-lg mb-2">No covenant data available</p>
        <p className="text-sm text-gray-400 mb-4">Log a call or upload financials to enable covenant monitoring.</p>
        <Link to="/covenants" className="text-blue-600 text-sm hover:underline">
          View Covenant Dashboard →
        </Link>
      </div>
    );
  }

  const overall = covenant.overall_status;
  const overallConfig = {
    breach: { label: 'Breach', cls: 'bg-red-100 text-red-700 border-red-200', bar: 'bg-red-500' },
    warning: { label: 'Warning', cls: 'bg-amber-100 text-amber-700 border-amber-200', bar: 'bg-amber-500' },
    current: { label: 'Current', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
    'n/a': { label: 'N/A', cls: 'bg-gray-100 text-gray-500 border-gray-200', bar: 'bg-gray-300' },
  }[overall] || { label: 'Unknown', cls: 'bg-gray-100 text-gray-500 border-gray-200', bar: 'bg-gray-300' };

  return (
    <div className="space-y-5">
      {/* Overall status banner */}
      <div className={`flex items-center justify-between px-5 py-4 rounded-xl border-2 ${overallConfig.cls}`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-0.5">Overall Covenant Status</p>
          <p className="text-lg font-bold">{overallConfig.label}</p>
        </div>
        <div className="text-right text-xs opacity-60">
          <p>As of {covenant.period_end_date ? new Date(covenant.period_end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p>
          <p className="mt-0.5">Source: {covenant.metric_source?.replace(/_/g, ' ') || '—'}</p>
        </div>
      </div>

      {/* Financial covenant gauges */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Financial Covenants</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CovenantGauge
            label="Leverage (Debt / EBITDA)"
            value={covenant.leverage_ratio}
            warnThreshold={LEV_WARN}
            breachThreshold={LEV_BREACH}
            maxDisplay={LEV_MAX_DISPLAY}
            isInverse={true}
          />
          <CovenantGauge
            label="Interest Coverage (EBITDA / Interest)"
            value={covenant.interest_coverage}
            warnThreshold={ICOV_WARN}
            breachThreshold={ICOV_BREACH}
            maxDisplay={ICOV_MAX_DISPLAY}
            isInverse={false}
          />
        </div>
      </div>

      {/* Supporting financials */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Supporting Financials</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-gray-100">
          {[
            { label: 'EBITDA', value: covenant.ebitda != null ? `$${(covenant.ebitda / 1_000_000).toFixed(1)}M` : '—' },
            { label: 'Revenue', value: covenant.revenue != null ? `$${(covenant.revenue / 1_000_000).toFixed(1)}M` : '—' },
            { label: 'Drawn', value: covenant.drawn_amount != null ? `$${(covenant.drawn_amount / 1_000_000).toFixed(1)}M` : '—' },
            { label: 'Fair Value', value: covenant.fair_value != null ? `$${(covenant.fair_value / 1_000_000).toFixed(1)}M` : '—' },
          ].map(item => (
            <div key={item.label} className="px-5 py-4">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">{item.label}</p>
              <p className="text-sm font-semibold text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reporting covenants */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Reporting Covenants</p>
        {covenant.reporting_obligations?.length === 0 ? (
          <div className="card p-6 text-center text-gray-400 text-sm">No reporting obligations on file</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="divide-y divide-gray-100">
              {covenant.reporting_obligations?.map((ob: any, i: number) => {
                const isOverdue = ob.status === 'overdue';
                return (
                  <div key={i} className={`px-5 py-4 flex items-center justify-between ${isOverdue ? 'border-l-4 border-l-red-400' : ''}`}>
                    <div>
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {ob.obligation_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 capitalize">
                        {ob.frequency}
                        {ob.last_received_date && ` · Last received ${new Date(ob.last_received_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOverdue ? 'bg-red-500' : 'bg-emerald-500'}`} />
                      {isOverdue ? 'Overdue' : 'Current'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Link to full dashboard */}
      <div className="flex justify-end">
        <Link
          to="/covenants"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          View Full Covenant Dashboard →
        </Link>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
//  Deal Terms Panel
// ──────────────────────────────────────────────────────────
function DealTermsPanel({ pos }: { pos: any }) {
  const instrType = pos.instrument_type as string;
  const isDebt = ['first_lien', 'second_lien', 'mezzanine'].includes(instrType);

  // Seeded supplementary data for fields not stored in DB
  const seed = (pos.id || 1) * 31;
  const s = (n: number) => Math.abs(Math.sin(seed + n) * 10000) % 1;

  const sofr = 5.33;
  const couponPct = pos.coupon_rate ? pos.coupon_rate * 100 : null;
  const spread = couponPct ? parseFloat((couponPct - sofr).toFixed(2)) : null;

  const oidRanges: Record<string, [number, number]> = {
    first_lien: [98.5, 99.5], second_lien: [97.0, 98.5],
    mezzanine: [96.0, 98.0], equity_co_invest: [100, 100],
  };
  const [oMin, oMax] = oidRanges[instrType] || [98, 99];
  const oid = parseFloat((oMin + s(1) * (oMax - oMin)).toFixed(2));

  const unusedFee = parseFloat((0.25 + s(2) * 0.25).toFixed(2));
  const maxLevOptions = [4.5, 5.0, 5.5, 6.0, 6.5];
  const maxLev = maxLevOptions[Math.floor(s(3) * maxLevOptions.length)];
  const minCov = parseFloat((1.5 + s(4) * 0.75).toFixed(2));

  const collateral: Record<string, string> = {
    first_lien: 'First priority lien on substantially all assets',
    second_lien: 'Second priority lien on substantially all assets',
    mezzanine: 'Subordinated lien on equity interests of Borrower',
    equity_co_invest: 'Equity interest in holding company',
  };

  const amortz = instrType === 'first_lien'
    ? `${(s(5) * 0.75 + 0.25).toFixed(2)}% per quarter (bullet at maturity)`
    : instrType === 'second_lien' ? 'Bullet (no scheduled amortization)'
    : instrType === 'mezzanine' ? 'PIK accrual + Bullet at maturity'
    : 'N/A';

  const leverageStep = `${maxLev}x → ${(maxLev - 0.25).toFixed(2)}x (Year 3) → ${(maxLev - 0.5).toFixed(2)}x (Year 4)`;
  const callProtection = s(8) > 0.5 ? '101 soft call (12 months)' : 'NC-1 (first 12 months), then par';
  const accordionSize = pos.total_facility_size ? `$${((pos.total_facility_size / 1_000_000) * 0.3).toFixed(0)}M (subject to pro forma covenant compliance)` : '—';

  const SectionHdr = ({ children }: { children: React.ReactNode }) => (
    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{children}</p>
    </div>
  );

  const Row = ({ label, value, hi }: { label: string; value: string; hi?: boolean }) => (
    <div className="grid grid-cols-5 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
      <p className="col-span-2 text-xs font-medium text-gray-500 self-center">{label}</p>
      <p className={`col-span-3 text-sm font-medium ${hi ? 'text-blue-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Facility Overview */}
      <div className="card overflow-hidden">
        <SectionHdr>Facility Overview</SectionHdr>
        <Row label="Instrument Type" value={instrType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
        <Row label="Total Facility Size" value={fmt(pos.total_facility_size)} />
        <Row label="Drawn Commitment" value={fmt(pos.drawn_amount)} />
        <Row label="Undrawn Commitment" value={fmt(pos.undrawn_amount)} />
        <Row label="Origination Date" value={fmtDate(pos.origination_date)} />
        <Row label="Maturity Date" value={fmtDate(pos.maturity_date)} hi />
        <Row label="Amortization" value={amortz} />
        <Row label="Investment Lead" value={pos.deal_team_lead || '—'} />
        <Row label="Fund" value={pos.fund_name || '—'} />
        <Row label="Vehicle" value={pos.vehicle_name || '—'} />
      </div>

      {/* Pricing */}
      {isDebt && (
        <div className="card overflow-hidden">
          <SectionHdr>Pricing & Economics</SectionHdr>
          <Row label="Rate Type" value={pos.interest_rate_type || 'Floating (Term SOFR)'} />
          {spread != null && <Row label="Spread to SOFR" value={`SOFR + ${spread.toFixed(2)}%`} hi />}
          <Row label="All-In Coupon Rate" value={fmtPct(pos.coupon_rate)} hi />
          {pos.pik_rate > 0 && <Row label="PIK Rate" value={fmtPct(pos.pik_rate)} />}
          <Row label="Original Issue Discount" value={oid >= 100 ? 'Par (100.00)' : `${oid.toFixed(2)} — ${(100 - oid).toFixed(2)}% discount`} />
          <Row label="Unused Line Fee" value={`${unusedFee.toFixed(2)}% p.a.`} />
          <Row label="Advance Rate" value={fmtPct(pos.advance_rate, 0)} />
          <Row label="Levered Yield" value={fmtPct(pos.levered_yield)} hi />
        </div>
      )}

      {/* Security */}
      {isDebt && (
        <div className="card overflow-hidden">
          <SectionHdr>Security Package</SectionHdr>
          <Row label="Collateral" value={collateral[instrType] || '—'} />
          <Row label="Lien Position"
            value={instrType === 'first_lien' ? '1st Lien (senior secured)' : instrType === 'second_lien' ? '2nd Lien (junior secured)' : 'Subordinated'} />
          <Row label="Borrower" value={pos.borrower_entity_name || '—'} />
          <Row label="Parent Guarantor" value={pos.ultimate_parent_name || 'Holding Company LLC'} />
          <Row label="Administrative Agent" value="Stonecrest Capital Management, LP" />
        </div>
      )}

      {/* Financial Covenants */}
      {isDebt && (
        <div className="card overflow-hidden">
          <SectionHdr>Financial Covenant Thresholds (per Credit Agreement)</SectionHdr>
          <Row label="Maximum Net Leverage" value={leverageStep} hi />
          <Row label="Minimum Interest Coverage" value={`${minCov.toFixed(2)}x (EBITDA / Cash Interest Expense)`} hi />
          <Row label="Covenant Type" value="Maintenance covenants — tested quarterly" />
          <Row label="Equity Cure Right" value={`Permitted up to ${Math.floor(s(6) * 2) + 1}× over the loan term`} />
          <Row label="Applicable Period" value={`From ${fmtDate(pos.origination_date)} through ${fmtDate(pos.maturity_date)}`} />
        </div>
      )}

      {/* Structural Features */}
      {isDebt && (
        <div className="card overflow-hidden">
          <SectionHdr>Structural Features & Protections</SectionHdr>
          <Row label="Delayed Draw Tranche"
            value={pos.undrawn_amount > 0
              ? `$${(pos.undrawn_amount / 1_000_000).toFixed(0)}M available — ${Math.floor(s(7) * 12 + 6)} month availability`
              : 'Not applicable'} />
          <Row label="Accordion Facility" value={accordionSize} />
          <Row label="Mandatory Prepayment" value="Asset sale proceeds, excess cash flow (50%), debt issuance proceeds" />
          <Row label="Call Protection" value={callProtection} />
          <Row label="LIBOR / SOFR Transition" value="Term SOFR (1M or 3M), Credit Spread Adjustment per ARRC" />
        </div>
      )}

      {/* Equity terms */}
      {instrType === 'equity_co_invest' && (
        <div className="card overflow-hidden">
          <SectionHdr>Equity Co-Investment Terms</SectionHdr>
          <Row label="Investment Type" value="Common Equity Co-Investment (alongside lead sponsor)" />
          <Row label="Current Fair Value" value={fmt(pos.fair_value)} hi />
          <Row label="Pro-Rata Rights" value="Yes — subject to same terms as lead investor" />
          <Row label="Information Rights" value="Quarterly management accounts, annual audited financials, board observer seat" />
          <Row label="Governance" value="Board observer rights (non-voting)" />
          <Row label="Exit Rights" value="Tag-along, drag-along, registration rights on IPO" />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
//  Documents Panel
// ──────────────────────────────────────────────────────────
function DocumentsPanel({ pos }: { pos: any }) {
  const instrType = pos.instrument_type as string;
  const isDebt = ['first_lien', 'second_lien', 'mezzanine'].includes(instrType);
  const origin = pos.origination_date ? new Date(pos.origination_date) : new Date('2022-06-01');

  const daysFrom = (days: number) => {
    const d = new Date(origin);
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const closingDocs = [
    { name: 'Credit Agreement', type: 'Legal', status: 'executed', date: daysFrom(0), pages: '284 pp' },
    { name: 'Commitment Letter', type: 'Legal', status: 'executed', date: daysFrom(-14), pages: '12 pp' },
    ...(isDebt ? [
      { name: 'Guaranty Agreement', type: 'Legal', status: 'executed', date: daysFrom(0), pages: '48 pp' },
      { name: 'Pledge & Security Agreement', type: 'Legal', status: 'executed', date: daysFrom(0), pages: '62 pp' },
      { name: 'UCC-1 Financing Statement', type: 'Lien Filing', status: 'filed', date: daysFrom(2), pages: '4 pp' },
      { name: 'Deposit Account Control Agreement', type: 'Legal', status: 'executed', date: daysFrom(1), pages: '18 pp' },
    ] : [
      { name: 'Subscription Agreement', type: 'Legal', status: 'executed', date: daysFrom(0), pages: '38 pp' },
      { name: 'Shareholders Agreement', type: 'Legal', status: 'executed', date: daysFrom(0), pages: '92 pp' },
    ]),
    { name: 'Closing Certificate', type: 'Corporate', status: 'executed', date: daysFrom(0), pages: '8 pp' },
    { name: 'Borrower Organizational Documents', type: 'Corporate', status: 'received', date: daysFrom(-5), pages: '—' },
    { name: 'Insurance Certificate (Property & Casualty)', type: 'Insurance', status: 'received', date: daysFrom(-3), pages: '6 pp' },
    { name: 'Insurance Certificate (D&O / E&O)', type: 'Insurance', status: 'received', date: daysFrom(-3), pages: '4 pp' },
    { name: 'Legal Opinion — Borrower Counsel', type: 'Legal', status: 'executed', date: daysFrom(0), pages: '18 pp' },
    { name: 'Legal Opinion — Lender Counsel', type: 'Legal', status: 'executed', date: daysFrom(0), pages: '22 pp' },
    { name: 'Quality of Earnings Report', type: 'Diligence', status: 'received', date: daysFrom(-21), pages: '—' },
    { name: 'Environmental & Social Review', type: 'Diligence', status: 'received', date: daysFrom(-14), pages: '—' },
    { name: 'Investment Committee Memorandum', type: 'Internal', status: 'approved', date: daysFrom(-7), pages: '34 pp' },
    { name: 'Deal Summary Presentation', type: 'Internal', status: 'approved', date: daysFrom(-10), pages: '28 pp' },
  ];

  const ongoingDocs = [
    { name: 'Q4 2024 Compliance Certificate', type: 'Compliance', status: 'received', date: 'Feb 14, 2025' },
    { name: 'Q3 2024 Financial Statements', type: 'Financial', status: 'received', date: 'Nov 8, 2024' },
    { name: 'Q2 2024 Financial Statements', type: 'Financial', status: 'received', date: 'Aug 12, 2024' },
    { name: 'Q1 2024 Financial Statements', type: 'Financial', status: 'received', date: 'May 9, 2024' },
    { name: 'FY 2023 Audited Financial Statements', type: 'Financial', status: 'received', date: 'Mar 28, 2024' },
    { name: 'Q4 2023 Compliance Certificate', type: 'Compliance', status: 'received', date: 'Feb 9, 2024' },
    { name: 'Q1 2025 Financial Statements', type: 'Financial', status: 'overdue', date: null },
    { name: 'Q1 2025 Compliance Certificate', type: 'Compliance', status: 'pending', date: null },
  ];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      executed: 'bg-emerald-100 text-emerald-700',
      filed: 'bg-blue-100 text-blue-700',
      received: 'bg-gray-100 text-gray-600',
      approved: 'bg-emerald-100 text-emerald-700',
      overdue: 'bg-red-100 text-red-700',
      pending: 'bg-amber-100 text-amber-700',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  const typeColor = (type: string) => {
    const map: Record<string, string> = {
      Legal: 'text-blue-600', Corporate: 'text-purple-600', 'Lien Filing': 'text-indigo-600',
      Insurance: 'text-teal-600', Diligence: 'text-orange-600', Internal: 'text-gray-500',
      Compliance: 'text-violet-600', Financial: 'text-emerald-600',
    };
    return map[type] || 'text-gray-500';
  };

  const typeIcon: Record<string, string> = {
    Legal: '⚖️', Corporate: '🏢', 'Lien Filing': '🔒', Insurance: '🛡️',
    Diligence: '🔍', Internal: '📋', Compliance: '✅', Financial: '📊',
  };

  const DocTable = ({ docs, title }: { docs: any[]; title: string }) => (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</p>
        <span className="text-xs text-gray-400">{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase w-2/5">Document</th>
            <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Type</th>
            <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Date</th>
            <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
            <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase">Size</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {docs.map((doc, i) => (
            <tr key={i} className="hover:bg-blue-50/30 group transition-colors">
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{typeIcon[doc.type] || '📄'}</span>
                  <button className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors text-left">
                    {doc.name}
                  </button>
                </div>
              </td>
              <td className="px-5 py-3">
                <span className={`text-xs font-semibold ${typeColor(doc.type)}`}>{doc.type}</span>
              </td>
              <td className="px-5 py-3 text-xs text-gray-500">
                {doc.date
                  ? doc.date
                  : <span className="text-amber-600 font-medium">Not received</span>}
              </td>
              <td className="px-5 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(doc.status)}`}>
                  {doc.status}
                </span>
              </td>
              <td className="px-5 py-3 text-right text-xs text-gray-400">{(doc as any).pages || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const overdueCount = ongoingDocs.filter(d => d.status === 'overdue').length;

  return (
    <div className="space-y-4">
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          <span className="text-lg">⚠️</span>
          <span><strong>{overdueCount} overdue document{overdueCount !== 1 ? 's' : ''}</strong> — follow up with borrower to obtain outstanding compliance materials.</span>
        </div>
      )}
      <DocTable docs={closingDocs} title={`Closing Documents — ${fmtDate(pos.origination_date)}`} />
      <DocTable docs={ongoingDocs} title="Ongoing Compliance & Reporting" />
    </div>
  );
}

export default function PositionDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'terms' | 'documents' | 'reporting' | 'calls' | 'tasks' | 'covenants'>('overview');
  const [showLogCall, setShowLogCall] = useState(false);
  const [showTranscriptWizard, setShowTranscriptWizard] = useState(false);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<number>>(new Set());
  const [expandedQuotes, setExpandedQuotes] = useState<Set<number>>(new Set());
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', assigned_to: '1', priority: 'medium', due_date: '' });
  const [addingTask, setAddingTask] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['position-detail', id],
    queryFn: () => getPositionDetail(parseInt(id!)),
    enabled: !!id,
  });

  const { data: tasksData, refetch: refetchTasks } = useQuery({
    queryKey: ['deal-tasks', id],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3002/api/tasks?deal_id=${id}`);
      return res.json();
    },
    enabled: !!id,
  });

  const { data: covenantData } = useQuery({
    queryKey: ['deal-covenants', id],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3002/api/portfolio/covenants?deal_id=${id}`);
      const json = await res.json();
      return json.covenants?.[0] ?? null;
    },
    enabled: !!id,
  });

  // Load users for task assignment (run once)
  const [usersLoaded, setUsersLoaded] = useState(false);
  if (!usersLoaded) {
    setUsersLoaded(true);
    fetch('http://localhost:3002/api/tasks/users').then(r => r.json()).then(setUsers).catch(() => {});
  }

  const tasks: any[] = tasksData || [];

  const pos = data?.data;

  const toggleTranscript = (callId: number) => {
    setExpandedTranscripts(prev => {
      const next = new Set(prev);
      next.has(callId) ? next.delete(callId) : next.add(callId);
      return next;
    });
  };

  const handleCallSaved = () => {
    setShowLogCall(false);
    queryClient.invalidateQueries({ queryKey: ['position-detail', id] });
    setActiveTab('calls');
  };

  const handleTaskSaved = () => {
    setShowTranscriptWizard(false);
    refetchTasks();
    setActiveTab('tasks');
  };

  const handleTaskStatusToggle = async (task: any) => {
    const newStatus = task.status === 'complete' ? 'open' : 'complete';
    await fetch(`http://localhost:3002/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    refetchTasks();
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    setAddingTask(true);
    await fetch('http://localhost:3002/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deal_id: parseInt(id!),
        assigned_to: parseInt(newTask.assigned_to),
        created_by: 1,
        title: newTask.title,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
      }),
    });
    setAddingTask(false);
    setShowAddTask(false);
    setNewTask({ title: '', assigned_to: '1', priority: 'medium', due_date: '' });
    refetchTasks();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-12 text-center text-gray-500">Loading position...</div>
      </Layout>
    );
  }

  if (error || !pos) {
    return (
      <Layout>
        <div className="p-8">
          <div className="card p-6 text-center">
            <p className="text-red-600">Position not found.</p>
            <Link to="/portfolio" className="text-blue-600 text-sm mt-2 block">← Back to Portfolio</Link>
          </div>
        </div>
      </Layout>
    );
  }

  const instrumentLabels: Record<string, string> = {
    first_lien: 'First Lien',
    second_lien: 'Second Lien',
    mezzanine: 'Mezzanine',
    equity_co_invest: 'Equity Co-Invest',
  };

  const instrColors: Record<string, string> = {
    first_lien: 'bg-blue-100 text-blue-800',
    second_lien: 'bg-purple-100 text-purple-800',
    mezzanine: 'bg-amber-100 text-amber-800',
    equity_co_invest: 'bg-green-100 text-green-800',
  };

  const reportingStatusColor = (s?: string) =>
    s === 'current' ? 'badge-success' : s === 'overdue' ? 'badge-danger' : 'badge-info';

  const callTypeLabel: Record<string, string> = {
    monthly_update: 'Monthly Update',
    quarterly_review: 'Quarterly Review',
    ad_hoc: 'Ad Hoc',
  };

  const openTasks = tasks.filter((t: any) => t.status !== 'complete' && t.status !== 'cancelled');
  const covenantOverall = covenantData?.overall_status;
  const covenantLabel = covenantOverall === 'breach' ? '⚠ Breach'
    : covenantOverall === 'warning' ? '△ Warning'
    : covenantOverall === 'current' ? '✓ Current'
    : 'Covenants';
  const tabs = [
    { key: 'overview', label: 'Financial Metrics' },
    { key: 'terms', label: 'Deal Terms' },
    { key: 'documents', label: 'Documents' },
    { key: 'covenants', label: covenantData ? covenantLabel : 'Covenants' },
    { key: 'reporting', label: `Reporting (${pos.obligations?.length || 0})` },
    { key: 'calls', label: `Call Records (${pos.calls?.length || 0})` },
    { key: 'tasks', label: `Tasks (${openTasks.length} open)` },
  ];

  return (
    <Layout>
      {showLogCall && (
        <LogCallWizard
          positionId={pos.id}
          dealName={pos.deal_name}
          onClose={() => setShowLogCall(false)}
          onSaved={handleCallSaved}
        />
      )}
      {showTranscriptWizard && (
        <TranscriptTaskWizard
          dealId={pos.deal_id}
          dealName={pos.deal_name}
          onClose={() => setShowTranscriptWizard(false)}
          onSaved={handleTaskSaved}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link to="/portfolio" className="hover:text-blue-600 transition-colors">Portfolio</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{pos.deal_name}</span>
      </div>

      {/* Header */}
      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{pos.deal_name}</h1>
            <p className="text-gray-600 mt-1">{pos.borrower_entity_name}</p>
            {pos.ultimate_parent_name && pos.ultimate_parent_name !== pos.borrower_entity_name && (
              <p className="text-xs text-gray-400 mt-0.5">Ultimate Parent: {pos.ultimate_parent_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${instrColors[pos.instrument_type] || 'bg-gray-100 text-gray-800'}`}>
              {instrumentLabels[pos.instrument_type] || pos.instrument_type}
            </span>
            <span className="badge badge-success capitalize">{pos.deal_status}</span>
            <button
              onClick={() => setShowLogCall(true)}
              className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Log Call
            </button>
          </div>
        </div>

        {/* Position Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-4 border-t border-gray-100">
          <StatCell label="Commitment" value={fmt(pos.commitment_amount)} />
          <StatCell label="Drawn" value={fmt(pos.drawn_amount)} />
          <StatCell label="Undrawn" value={fmt(pos.undrawn_amount)} />
          <StatCell label="Fair Value" value={fmt(pos.fair_value)} highlight />
          <StatCell label="Levered Yield" value={fmtPct(pos.levered_yield)} highlight />
          <StatCell label="Advance Rate" value={fmtPct(pos.advance_rate, 0)} />
        </div>

        {/* Secondary Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 mt-4 border-t border-gray-100">
          <StatCell label="Coupon Rate" value={fmtPct(pos.coupon_rate)} />
          <StatCell label="PIK Rate" value={fmtPct(pos.pik_rate)} />
          <StatCell label="Rate Type" value={pos.interest_rate_type || '—'} />
          <StatCell label="Maturity" value={fmtDate(pos.maturity_date)} />
          <StatCell label="Facility Size" value={fmt(pos.total_facility_size)} />
          <StatCell label="Origination" value={fmtDate(pos.origination_date)} />
          <StatCell label="Investment Lead" value={pos.deal_team_lead || '—'} />
          <StatCell label="As of Date" value={fmtDate(pos.as_of_date)} />
        </div>

        {/* Fund / Vehicle + Last Updated */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>Fund: <span className="font-medium text-gray-700">{pos.fund_name}</span></span>
            <span>Vehicle: <span className="font-medium text-gray-700">{pos.vehicle_name}</span></span>
          </div>
          {pos.updated_at && (
            <span className="text-xs text-gray-400">
              Last updated: <span className="font-medium text-gray-600">{fmtDate(pos.updated_at)}</span>
            </span>
          )}
        </div>

        {pos.deal_description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Description</p>
            <p className="text-sm text-gray-700">{pos.deal_description}</p>
          </div>
        )}
        {pos.decision_rationale && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Investment Rationale</p>
            <p className="text-sm text-gray-700">{pos.decision_rationale}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map(t => {
          const isCovenantBreach = t.key === 'covenants' && covenantOverall === 'breach';
          const isCovenantWarn = t.key === 'covenants' && covenantOverall === 'warning';
          const activeColor = isCovenantBreach ? 'border-red-500 text-red-600'
            : isCovenantWarn ? 'border-amber-500 text-amber-600'
            : 'border-blue-600 text-blue-600';
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === t.key
                  ? activeColor
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Financial Metrics */}
      {activeTab === 'overview' && (
        <div className="card overflow-hidden">
          {pos.metrics?.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p>No financial metrics on file yet.</p>
              <button onClick={() => setShowLogCall(true)} className="mt-3 text-blue-600 text-sm hover:underline">
                Log a call to start capturing metrics →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Period</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">EBITDA</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Debt</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Net Debt</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Leverage</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Coverage</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pos.metrics.map((m: any) => (
                    <tr key={m.id} className={`hover:bg-gray-50 ${m.ai_extracted ? 'border-l-2 border-l-indigo-300' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{fmtDate(m.period_end_date)}</p>
                        <p className="text-xs text-gray-500 capitalize">{m.period_type}</p>
                        {m.ai_extracted ? (
                          <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600 font-medium">AI extracted</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(m.revenue)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(m.ebitda)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(m.total_debt)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(m.net_debt)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${(m.leverage_ratio || 0) > 4.5 ? 'text-red-600' : (m.leverage_ratio || 0) > 4.0 ? 'text-amber-600' : 'text-gray-900'}`}>
                          {fmtX(m.leverage_ratio)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${(m.interest_coverage || 99) < 2.0 ? 'text-amber-600' : 'text-gray-900'}`}>
                          {fmtX(m.interest_coverage)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-500 capitalize">{m.metric_source?.replace(/_/g, ' ')}</p>
                        {m.notes && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{m.notes}</p>}
                        <p className="text-xs text-gray-400">{fmtDate(m.upload_date)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Deal Terms */}
      {activeTab === 'terms' && <DealTermsPanel pos={pos} />}

      {/* Tab: Documents */}
      {activeTab === 'documents' && <DocumentsPanel pos={pos} />}

      {/* Tab: Covenants */}
      {activeTab === 'covenants' && (
        <CovenantPanel covenant={covenantData} dealId={parseInt(id!)} />
      )}

      {/* Tab: Reporting Obligations */}
      {activeTab === 'reporting' && (
        <div className="card overflow-hidden">
          {pos.obligations?.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No reporting obligations on file</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pos.obligations.map((ob: any) => (
                <div key={ob.id} className="px-6 py-4 flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900 capitalize">
                      {ob.obligation_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 capitalize">
                      {ob.frequency} · Due {ob.days_after_period_end} days after period end
                    </p>
                    {ob.last_received_date && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Last received: {fmtDate(ob.last_received_date)} (period: {fmtDate(ob.last_received_period)})
                      </p>
                    )}
                  </div>
                  <span className={`badge ${reportingStatusColor(ob.status)} capitalize`}>
                    {ob.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Call Records */}
      {activeTab === 'calls' && (
        <div className="space-y-4">
          {/* Log Call CTA */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowLogCall(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Log New Call
            </button>
          </div>

          {pos.calls?.length === 0 ? (
            <div className="card p-12 text-center text-gray-500">
              <p className="text-lg mb-2">No call records yet</p>
              <p className="text-sm mb-4 max-w-sm mx-auto">
                Use the agentic call ingestion wizard to paste a transcript or meeting notes — AI will extract key metrics and a summary automatically.
              </p>
              <button
                onClick={() => setShowLogCall(true)}
                className="btn btn-primary text-sm"
              >
                Log First Call →
              </button>
            </div>
          ) : (
            pos.calls.map((call: any) => (
              <div key={call.id} className="card overflow-hidden">
                {/* Call Header */}
                <div className="px-5 py-4 flex items-start justify-between border-b border-gray-100">
                  <div>
                    <p className="font-semibold text-gray-900">{fmtDate(call.call_date)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {callTypeLabel[call.call_type] || call.call_type}
                      {call.participants ? ` · ${call.participants}` : ''}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${
                    call.status === 'reviewed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {call.status?.replace('_', ' ')}
                  </span>
                </div>

                <div className="p-5 space-y-4">
                  {/* AI Summary */}
                  {call.summary && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                      <p className="text-xs font-semibold text-indigo-600 uppercase mb-1.5 flex items-center gap-1.5">
                        <span className="inline-block w-4 h-4 rounded-full bg-indigo-600 text-white text-center leading-4 text-xs">✦</span>
                        AI Summary
                      </p>
                      <p className="text-sm text-gray-800 leading-relaxed">{call.summary}</p>
                    </div>
                  )}

                  {/* Key Developments — stored in notes column of portfolio_metrics */}
                  {/* (notes column isn't directly on call_records; shown if we get it via join in the future) */}

                  {/* Transcript (expandable) */}
                  {call.transcript_text && (
                    <div>
                      <button
                        onClick={() => toggleTranscript(call.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <svg
                          className={`w-3.5 h-3.5 transition-transform ${expandedTranscripts.has(call.id) ? 'rotate-90' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {expandedTranscripts.has(call.id) ? 'Hide' : 'View'} transcript / notes
                      </button>
                      {expandedTranscripts.has(call.id) && (
                        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                            {call.transcript_text}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {openTasks.length} open · {tasks.filter((t: any) => t.status === 'complete').length} completed
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowTranscriptWizard(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <span>✦</span> Extract from Transcript
              </button>
              <button
                onClick={() => setShowAddTask(v => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
              >
                + Add Task
              </button>
            </div>
          </div>

          {showAddTask && (
            <div className="card p-4 border-2 border-dashed border-violet-200 bg-violet-50">
              <p className="text-xs font-semibold text-violet-700 uppercase mb-3">New Task</p>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newTask.title}
                  onChange={e => setNewTask(v => ({ ...v, title: e.target.value }))}
                  placeholder="Task title..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Assign to</label>
                    <select value={newTask.assigned_to} onChange={e => setNewTask(v => ({ ...v, assigned_to: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none">
                      {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                    <select value={newTask.priority} onChange={e => setNewTask(v => ({ ...v, priority: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none">
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Due date</label>
                    <input type="date" value={newTask.due_date} onChange={e => setNewTask(v => ({ ...v, due_date: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddTask(false)} className="px-3 py-1.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleAddTask} disabled={addingTask || !newTask.title.trim()}
                    className="px-4 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
                    {addingTask ? 'Adding...' : 'Add Task'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tasks.length === 0 ? (
            <div className="card p-12 text-center text-gray-500">
              <p className="text-lg mb-2">No tasks yet</p>
              <p className="text-sm mb-4">Extract action items from a call transcript or add tasks manually.</p>
              <button onClick={() => setShowTranscriptWizard(true)} className="btn btn-primary text-sm">
                Extract from Transcript →
              </button>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {(() => {
                const priorityColors: Record<string, string> = {
                  high: 'bg-red-100 text-red-700',
                  medium: 'bg-amber-100 text-amber-700',
                  low: 'bg-gray-100 text-gray-600',
                };
                const groups = [
                  { label: 'Open', items: tasks.filter((t: any) => t.status === 'open' || t.status === 'in_progress') },
                  { label: 'Completed', items: tasks.filter((t: any) => t.status === 'complete') },
                ];
                return groups.map(group => group.items.length === 0 ? null : (
                  <div key={group.label}>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 uppercase">{group.label} ({group.items.length})</span>
                    </div>
                    {group.items.map((task: any) => (
                      <div key={task.id} className={`px-4 py-3.5 border-b border-gray-100 last:border-0 flex items-start gap-3 hover:bg-gray-50 ${task.call_record_id ? 'border-l-2 border-l-violet-300' : ''}`}>
                        <button
                          onClick={() => handleTaskStatusToggle(task)}
                          className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                            task.status === 'complete' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-violet-400'
                          }`}
                        >
                          {task.status === 'complete' && <span className="text-xs">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${task.status === 'complete' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                              <span className="w-4 h-4 rounded-full bg-amber-400 text-white text-center text-xs leading-4">{task.assigned_to_initials}</span>
                              {task.assigned_to_name}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${priorityColors[task.priority]}`}>{task.priority}</span>
                            {task.due_date && (
                              <span className={`text-xs ${new Date(task.due_date) < new Date() && task.status !== 'complete' ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                Due {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            {task.call_record_id && <span className="text-xs text-violet-600 font-medium">✦ AI extracted</span>}
                          </div>
                          {task.source_quote && (
                            <button
                              onClick={() => setExpandedQuotes(prev => { const n = new Set(prev); n.has(task.id) ? n.delete(task.id) : n.add(task.id); return n; })}
                              className="mt-1.5 text-xs text-gray-400 hover:text-gray-600 italic"
                            >
                              {expandedQuotes.has(task.id) ? '▼ Hide quote' : '▶ View source quote'}
                            </button>
                          )}
                          {task.source_quote && expandedQuotes.has(task.id) && (
                            <p className="mt-1 text-xs text-gray-500 italic border-l-2 border-violet-300 pl-2">"{task.source_quote}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
