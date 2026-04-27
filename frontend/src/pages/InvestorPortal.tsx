import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface FundData {
  id: number;
  name: string;
  status: string;
  vintage_year: number;
  target_size: number;
  hard_cap: number;
  management_fee_rate: number;
  carried_interest_rate: number;
  hurdle_rate: number;
  preferred_return: number;
  fund_term: number;
  investment_period_end: string;
  domicile: string;
  currency: string;
  asset_class_name: string;
  sub_asset_class_name: string;
}

interface ShareClass {
  name: string;
  management_fee_rate: number | null;
  carried_interest_rate: number | null;
  hurdle_rate: number | null;
  preferred_return: number | null;
  description: string | null;
}

interface Vehicle {
  name: string;
  legal_entity_type: string | null;
  domicile: string | null;
}

interface Document {
  title: string;
  document_type: string;
  upload_date: string;
}

interface PortalData {
  fund: FundData;
  share_classes: ShareClass[];
  vehicles: Vehicle[];
  documents: Document[];
  access: {
    recipient_email: string | null;
    created_at: string;
  };
}

function fmt$M(val: number | null | undefined) {
  if (!val) return '—';
  return `$${(val / 1_000_000).toFixed(0)}M`;
}

function fmtPct(val: number | null | undefined) {
  if (val == null) return '—';
  return `${(val * 100).toFixed(2)}%`;
}

function docTypeLabel(type: string) {
  const labels: Record<string, string> = {
    ppm: 'Private Placement Memorandum',
    lpa: 'Limited Partnership Agreement',
    subscription: 'Subscription Agreement',
    term_sheet: 'Term Sheet',
    other: 'Fund Document',
  };
  return labels[type] || type.toUpperCase();
}

export default function InvestorPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interestSent, setInterestSent] = useState(false);
  const [interestName, setInterestName] = useState('');
  const [interestEmail, setInterestEmail] = useState('');
  const [interestNote, setInterestNote] = useState('');

  // AI Q&A state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const SUGGESTED_QUESTIONS = [
    'What share classes are available and how do the fees differ?',
    'What is the fund term and investment period?',
    'Which vehicle structure is best for a non-US investor?',
    'How does the carried interest waterfall work?',
  ];

  const handleAsk = async (question: string) => {
    const q = question.trim();
    if (!q || chatLoading) return;
    setChatInput('');
    setChatError(null);
    setChatMessages(prev => [...prev, { role: 'user', content: q }]);
    setChatLoading(true);
    try {
      const resp = await fetch(`https://gp-os-production.up.railway.app/api/investor-access/${token}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to get answer');
      setChatMessages(prev => [...prev, { role: 'assistant', content: result.answer }]);
    } catch (e) {
      setChatError((e as Error).message);
      setChatMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Unable to get a response. Please try again.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  useEffect(() => {
    fetch(`https://gp-os-production.up.railway.app/api/investor-access/${token}`)
      .then(r => {
        if (!r.ok) throw new Error('Invalid or expired access link');
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading fund information...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Unavailable</h1>
          <p className="text-gray-600">{error || 'This fund page is no longer accessible. Please contact the fund manager for a new link.'}</p>
        </div>
      </div>
    );
  }

  const { fund, share_classes, vehicles, documents, access } = data;

  const statusColors: Record<string, string> = {
    fundraising: 'bg-blue-100 text-blue-800',
    investing: 'bg-green-100 text-green-800',
    harvesting: 'bg-amber-100 text-amber-800',
    liquidating: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-gray-900">Stonecrest Capital Management</span>
            <span className="ml-3 text-sm text-gray-400">Investor Portal</span>
          </div>
          {access.recipient_email && (
            <span className="text-sm text-gray-500">Shared with {access.recipient_email}</span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* Fund header */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">{fund.asset_class_name} · {fund.sub_asset_class_name}</p>
              <h1 className="text-3xl font-bold text-gray-900">{fund.name}</h1>
            </div>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold capitalize ${statusColors[fund.status] || 'bg-gray-100 text-gray-800'}`}>
              {fund.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-2">Vintage {fund.vintage_year} · {fund.domicile} · {fund.currency}</p>
        </div>

        {/* Economics grid */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Fund Economics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Target Size', value: fmt$M(fund.target_size) },
              { label: 'Hard Cap', value: fmt$M(fund.hard_cap) },
              { label: 'Management Fee', value: fmtPct(fund.management_fee_rate) },
              { label: 'Carried Interest', value: fmtPct(fund.carried_interest_rate) },
              { label: 'Hurdle Rate', value: fmtPct(fund.hurdle_rate) },
              { label: 'Preferred Return', value: fmtPct(fund.preferred_return) },
              { label: 'Fund Term', value: fund.fund_term ? `${fund.fund_term} years` : '—' },
              { label: 'Inv. Period End', value: fund.investment_period_end ? fund.investment_period_end.slice(0, 7) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Share Classes */}
        {share_classes.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Share Classes</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Mgmt Fee</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Carry</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Hurdle</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {share_classes.map((sc, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">{sc.name}</td>
                      <td className="px-6 py-4 text-gray-700">{fmtPct(sc.management_fee_rate)}</td>
                      <td className="px-6 py-4 text-gray-700">{fmtPct(sc.carried_interest_rate)}</td>
                      <td className="px-6 py-4 text-gray-700">{fmtPct(sc.hurdle_rate)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{sc.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Vehicles */}
        {vehicles.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Investment Vehicles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicles.map((v, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                  <p className="font-semibold text-gray-900">{v.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {[v.legal_entity_type, v.domicile].filter(Boolean).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents */}
        {documents.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Fund Documents</h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {documents.map((doc, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📄</span>
                    <div>
                      <p className="font-medium text-gray-900">{doc.title}</p>
                      <p className="text-xs text-gray-500">{docTypeLabel(doc.document_type)}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{doc.upload_date?.slice(0, 10)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">To request document access, contact your relationship manager.</p>
          </div>
        )}

        {/* AI Q&A */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-8 pt-7 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">🤖</span>
              <h2 className="text-xl font-bold text-gray-900">Ask About This Fund</h2>
            </div>
            <p className="text-gray-500 text-sm">Get instant answers about fund structure, terms, vehicles, and share classes from our AI assistant.</p>
          </div>

          {/* Chat history */}
          <div className="px-8 py-4 space-y-4 max-h-96 overflow-y-auto bg-gray-50">
            {chatMessages.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400 mb-4">Ask anything about the fund — or try one of these:</p>
                <div className="flex flex-col gap-2 max-w-md mx-auto">
                  {SUGGESTED_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => handleAsk(q)}
                      className="text-left px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-blue-700 text-white text-xs flex items-center justify-center shrink-0 mt-0.5 mr-2">AI</div>
                    )}
                    <div className={`max-w-[80%] px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-blue-700 text-white rounded-br-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 rounded-full bg-blue-700 text-white text-xs flex items-center justify-center shrink-0 mt-0.5 mr-2">AI</div>
                    <div className="bg-white border border-gray-200 rounded-xl rounded-bl-sm px-4 py-3 text-sm shadow-sm">
                      <span className="inline-flex gap-1">
                        <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                        <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                        <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="px-8 py-4 border-t border-gray-100 bg-white">
            {chatError && <p className="text-xs text-red-600 mb-2">{chatError}</p>}
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAsk(chatInput)}
                placeholder="Ask about fees, vehicles, terms, or anything else..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={chatLoading}
              />
              <button
                onClick={() => handleAsk(chatInput)}
                disabled={!chatInput.trim() || chatLoading}
                className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Express Interest */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          {interestSent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Thank you, {interestName.split(' ')[0]}!</h3>
              <p className="text-gray-500">Your interest has been recorded. Our IR team will be in touch shortly.</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Express Interest</h2>
              <p className="text-gray-500 text-sm mb-6">Submit your information and our investor relations team will follow up with next steps.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={interestName}
                    onChange={e => setInterestName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={interestEmail}
                    onChange={e => setInterestEmail(e.target.value)}
                    placeholder="jane@institution.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
                  <textarea
                    value={interestNote}
                    onChange={e => setInterestNote(e.target.value)}
                    rows={3}
                    placeholder="Any questions or context for the IR team..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  if (interestName && interestEmail) setInterestSent(true);
                }}
                disabled={!interestName || !interestEmail}
                className="mt-4 px-8 py-2 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Submit Interest
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 pb-6">
          This page was shared privately by Stonecrest Capital Management · {access.created_at?.slice(0, 10)}
        </p>
      </main>
    </div>
  );
}
