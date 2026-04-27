import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useParams } from 'react-router-dom';

// ─── Context Hook ─────────────────────────────────────────────────────────────

interface PageContext {
  page: string;
  pageLabel: string;
  dealId?: number;
  dealName?: string;
  activeTab?: string;
  suggestions: string[];
}

function usePageContext(): PageContext {
  const location = useLocation();
  const params = useParams();
  const path = location.pathname;

  if (path.startsWith('/portfolio/positions/') && params.id) {
    return {
      page: 'position_detail',
      pageLabel: 'Investment Detail',
      dealId: parseInt(params.id),
      suggestions: [
        'How has leverage trended over the past year?',
        'Are there any overdue reporting obligations?',
        'Summarize the most recent call notes',
        'What are the covenant thresholds for this deal?',
      ],
    };
  }
  if (path === '/portfolio') {
    return {
      page: 'portfolio',
      pageLabel: 'Portfolio Monitoring',
      suggestions: [
        'Which positions are in covenant breach or warning?',
        'Show me first lien deals with leverage above 4.5x',
        'What is our total drawn capital and average yield?',
        'Which deals are maturing in the next 12 months?',
      ],
    };
  }
  if (path === '/covenants') {
    return {
      page: 'covenants',
      pageLabel: 'Covenant Monitoring',
      suggestions: [
        'How many deals are in breach vs. warning?',
        'Show me all deals with leverage above 5x',
        'Which deals have overdue reporting obligations?',
        'What is the average leverage across the portfolio?',
      ],
    };
  }
  if (path.startsWith('/lp-management')) {
    return {
      page: 'lp_management',
      pageLabel: 'LP Management',
      suggestions: [
        'How many active vs. prospect LPs do we have?',
        'Show me pension funds by AUM',
        'Which LPs have the largest commitments?',
        'List LPs managed by Sarah Chen',
      ],
    };
  }
  if (path === '/deal-flow') {
    return {
      page: 'deal_flow',
      pageLabel: 'Deal Flow',
      suggestions: [
        'What deals are currently in due diligence?',
        'Show me funded deals from this year',
        'Which deals are in the term sheet stage?',
        'Summarize the pipeline by stage',
      ],
    };
  }
  if (path === '/tasks') {
    return {
      page: 'tasks',
      pageLabel: 'Tasks',
      suggestions: [
        'What high-priority tasks are overdue?',
        'Show me open tasks assigned to Sarah Chen',
        'Which deals have the most open action items?',
        'List tasks waiting for admin confirmation',
      ],
    };
  }
  if (path === '/') {
    return {
      page: 'dashboard',
      pageLabel: 'Dashboard',
      suggestions: [
        'What is our total portfolio exposure?',
        'Which deals have the highest leverage?',
        'How many LP relationships are active?',
        'Show me deals maturing in 2025',
      ],
    };
  }

  return {
    page: 'general',
    pageLabel: 'GP OS',
    suggestions: [
      'Give me a portfolio overview',
      'Which deals are in covenant breach?',
      'Show me active LP relationships',
      'What high-priority tasks are open?',
    ],
  };
}

// ─── Simple Markdown Renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table detection
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const headers = tableLines[0].split('|').map(h => h.trim()).filter(Boolean);
      const rows = tableLines.slice(2).map(r => r.split('|').map(c => c.trim()).filter(Boolean));
      elements.push(
        <div key={i} className="overflow-x-auto my-2">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {headers.map((h, j) => (
                  <th key={j} className="px-2 py-1.5 text-left font-semibold text-gray-700 border border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, j) => (
                <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {row.map((cell, k) => (
                    <td key={k} className="px-2 py-1.5 text-gray-800 border border-gray-200">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(<p key={i} className="text-xs font-bold text-gray-800 mt-3 mb-1 uppercase tracking-wide">{line.slice(4)}</p>);
    } else if (line.startsWith('## ')) {
      elements.push(<p key={i} className="text-sm font-bold text-gray-900 mt-3 mb-1">{line.slice(3)}</p>);
    } else if (line.startsWith('# ')) {
      elements.push(<p key={i} className="text-sm font-bold text-gray-900 mt-2 mb-1">{line.slice(2)}</p>);
    }
    // Bullet lists
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="flex gap-2 items-start my-0.5">
          <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
          <span className="text-sm text-gray-800">{renderInline(line.slice(2))}</span>
        </div>
      );
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 items-start my-0.5">
          <span className="text-blue-500 font-semibold text-xs mt-0.5 flex-shrink-0 w-4">{num}.</span>
          <span className="text-sm text-gray-800">{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
        </div>
      );
    }
    // Horizontal rule
    else if (line.trim() === '---') {
      elements.push(<hr key={i} className="border-gray-200 my-2" />);
    }
    // Empty line
    else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1.5" />);
    }
    // Normal paragraph
    else {
      elements.push(
        <p key={i} className="text-sm text-gray-800 leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }

  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold**, `code`, and plain text
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-gray-100 text-blue-700 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// ─── Message Types ────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: { tool: string; input: any }[];
  isLoading?: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IntelligenceDrawer() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const context = usePageContext();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages([...updatedMessages, { role: 'assistant', content: '', isLoading: true }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('https://gp-os-production.up.railway.app/api/intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          context: {
            page: context.page,
            pageLabel: context.pageLabel,
            dealId: context.dealId,
          },
          api_key: apiKey || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Request failed');
      }

      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: json.response,
          toolCalls: json.tool_calls,
        },
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'assistant',
          content: `**Error:** ${err.message}${err.message.includes('API key') ? '\n\nClick the key icon above to add your Anthropic API key.' : ''}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, context, apiKey]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
  };

  const hasApiKey = apiKey.startsWith('sk-');

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Intelligence Assistant"
        className={`fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open
            ? 'bg-gray-800 text-white rotate-45 scale-95'
            : 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white hover:scale-110 hover:shadow-xl'
        }`}
        style={{ fontSize: open ? '20px' : '18px' }}
      >
        {open ? '×' : '✦'}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/10"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-screen z-40 flex flex-col bg-white shadow-2xl border-l border-gray-200 transition-all duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: '420px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-violet-600 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-white text-lg">✦</span>
            <div>
              <p className="text-sm font-semibold text-white leading-none">Intelligence</p>
              <p className="text-xs text-indigo-200 mt-0.5 leading-none">Stonecrest Capital</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Context pill */}
            <span className="text-xs bg-white/15 text-white px-2.5 py-1 rounded-full font-medium">
              📍 {context.pageLabel}
            </span>
            {/* API key toggle */}
            <button
              onClick={() => setShowApiKey(v => !v)}
              title={hasApiKey ? 'API key configured' : 'Add API key'}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                hasApiKey ? 'bg-green-400/30 text-green-200' : 'bg-white/15 text-white/70 hover:bg-white/25'
              }`}
            >
              {hasApiKey ? '🔑' : '🔒'}
            </button>
            {/* Clear */}
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                title="Clear conversation"
                className="w-7 h-7 rounded-full bg-white/15 text-white/70 hover:bg-white/25 flex items-center justify-center text-xs transition-colors"
              >
                ↺
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full bg-white/15 text-white/80 hover:bg-white/25 flex items-center justify-center transition-colors text-base leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* API Key input (collapsible) */}
        {showApiKey && (
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
            <p className="text-xs font-medium text-gray-600 mb-1.5">Anthropic API Key</p>
            <input
              type="password"
              value={apiKey}
              onChange={e => {
                setApiKey(e.target.value);
                localStorage.setItem('anthropic_api_key', e.target.value);
              }}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-xs text-gray-400 mt-1">Stored in your browser. Required for AI responses.</p>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              {/* Welcome */}
              <div className="text-center pt-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mx-auto mb-3 text-2xl">✦</div>
                <p className="text-sm font-semibold text-gray-900">Ask me anything about the portfolio</p>
                <p className="text-xs text-gray-500 mt-1">I have access to positions, covenants, LPs, tasks, and deal flow.</p>
              </div>

              {/* Suggestions */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Suggested for this page</p>
                <div className="space-y-1.5">
                  {context.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="w-full text-left text-xs text-gray-700 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 hover:border-indigo-200 rounded-lg px-3 py-2.5 transition-all leading-relaxed"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2 text-xs text-white">✦</div>
              )}
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white border border-gray-100 shadow-sm rounded-tl-sm'
                }`}
              >
                {msg.isLoading ? (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs text-gray-400">Thinking</span>
                    <span className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                        />
                      ))}
                    </span>
                  </div>
                ) : msg.role === 'user' ? (
                  <p className="text-sm text-white leading-relaxed">{msg.content}</p>
                ) : (
                  <div className="space-y-0.5">
                    {renderMarkdown(msg.content)}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <span>⚡</span>
                          {msg.toolCalls.map(t => t.tool.replace(/_/g, ' ')).join(' · ')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-100 px-4 py-3 flex-shrink-0 bg-white">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the portfolio..."
              rows={1}
              className="flex-1 resize-none px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder-gray-400 leading-relaxed"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>

      {/* Bounce animation */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
}
