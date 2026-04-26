import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLimitedPartnerById } from '../../api';
import Layout from '../../components/Layout';

function fmtDate(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function typeLabel(type?: string) {
  const map: Record<string, string> = {
    pension: 'Pension Fund', endowment: 'Endowment', family_office: 'Family Office',
    sovereign_wealth: 'Sovereign Wealth', foundation: 'Foundation', insurance: 'Insurance', other: 'Other',
  };
  return map[type ?? ''] ?? type ?? '—';
}

function typeColor(type?: string) {
  const map: Record<string, string> = {
    pension: 'bg-blue-100 text-blue-800', endowment: 'bg-purple-100 text-purple-800',
    family_office: 'bg-green-100 text-green-800', sovereign_wealth: 'bg-indigo-100 text-indigo-800',
    foundation: 'bg-amber-100 text-amber-800',
  };
  return map[type ?? ''] ?? 'bg-gray-100 text-gray-800';
}

function statusColor(s?: string) {
  return s === 'active' ? 'badge-success' : s === 'prospect' ? 'badge-info' : 'badge-danger';
}

function amlColor(s?: string) {
  return s === 'approved' ? 'badge-success' : s === 'pending' ? 'badge-info' : 'badge-danger';
}

function roleColor(r?: string) {
  return r === 'decision_maker' ? 'bg-blue-100 text-blue-700' : r === 'operations' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700';
}

function strengthColor(s?: string) {
  return s === 'strong' ? 'text-green-600' : s === 'moderate' ? 'text-amber-600' : 'text-gray-400';
}

const EMPTY_CONTACT = {
  name: '', title: '', email: '', phone: '',
  role: 'ir_contact', relationship_strength: 'moderate',
  last_interaction_date: '', notes: '',
};

interface ContactModalProps {
  lpId: number;
  contact?: any; // null = create, object = edit
  onClose: () => void;
  onSaved: () => void;
}

function ContactModal({ lpId, contact, onClose, onSaved }: ContactModalProps) {
  const isEdit = !!contact;
  const [form, setForm] = useState({
    name: contact?.name || '',
    title: contact?.title || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    role: contact?.role || 'ir_contact',
    relationship_strength: contact?.relationship_strength || 'moderate',
    last_interaction_date: contact?.last_interaction_date?.substring(0, 10) || '',
    notes: contact?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const field = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const url = isEdit
        ? `http://localhost:3002/api/contacts/${contact.id}`
        : `http://localhost:3002/api/contacts`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lp_id: lpId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Contact' : 'Add Contact'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
              <input
                type="text" required value={form.name} onChange={field('name')}
                placeholder="Jane Smith"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text" value={form.title} onChange={field('title')}
                placeholder="Managing Director"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={form.role} onChange={field('role')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="decision_maker">Decision Maker</option>
                <option value="ir_contact">IR Contact</option>
                <option value="operations">Operations</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email" value={form.email} onChange={field('email')}
                placeholder="jane@calpers.ca.gov"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text" value={form.phone} onChange={field('phone')}
                placeholder="+1 (415) 555-0100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Relationship Strength</label>
              <select
                value={form.relationship_strength} onChange={field('relationship_strength')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="strong">Strong</option>
                <option value="moderate">Moderate</option>
                <option value="weak">Weak</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Interaction</label>
              <input
                type="date" value={form.last_interaction_date} onChange={field('last_interaction_date')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes} onChange={field('notes')} rows={3}
                placeholder="Key relationship notes, preferences, context..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 btn btn-primary disabled:opacity-50">
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Contact'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 btn btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LPDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'entities' | 'contacts'>('entities');
  const [contactModal, setContactModal] = useState<{ open: boolean; contact: any | null }>({ open: false, contact: null });

  const { data, isLoading, error } = useQuery({
    queryKey: ['lp-detail', id],
    queryFn: () => getLimitedPartnerById(parseInt(id!)),
    enabled: !!id,
  });

  const lp = data?.data;

  const handleContactSaved = () => {
    setContactModal({ open: false, contact: null });
    queryClient.invalidateQueries({ queryKey: ['lp-detail', id] });
    queryClient.invalidateQueries({ queryKey: ['limited-partners'] });
  };

  if (isLoading) return (
    <Layout>
      <div className="p-12 text-center text-gray-500">Loading...</div>
    </Layout>
  );

  if (error || !lp) return (
    <Layout>
      <div className="p-8">
        <div className="card p-6 text-center">
          <p className="text-red-600">Limited partner not found.</p>
          <Link to="/lp-management/partners" className="text-blue-600 text-sm mt-2 block">← Back to LP Management</Link>
        </div>
      </div>
    </Layout>
  );

  const entities = lp.entities || [];
  const contacts = lp.contacts || [];

  return (
    <Layout>
      {contactModal.open && (
        <ContactModal
          lpId={parseInt(id!)}
          contact={contactModal.contact}
          onClose={() => setContactModal({ open: false, contact: null })}
          onSaved={handleContactSaved}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link to="/lp-management/partners" className="hover:text-blue-600 transition-colors">LP Management</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{lp.name}</span>
      </div>

      {/* Header */}
      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lp.name}</h1>
            <p className="text-gray-500 mt-1">{lp.headquarters}</p>
          </div>
          <div className="flex gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${typeColor(lp.type)}`}>
              {typeLabel(lp.type)}
            </span>
            <span className={`badge ${statusColor(lp.status)} capitalize`}>{lp.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">AUM</p>
            <p className="text-lg font-bold text-gray-900">
              {lp.aum ? `$${(lp.aum / 1_000_000_000).toFixed(0)}B` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Relationship Owner</p>
            <p className="text-sm font-semibold text-gray-900">{lp.relationship_owner || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Investing Entities</p>
            <p className="text-lg font-bold text-gray-900">{entities.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Contacts</p>
            <p className="text-lg font-bold text-gray-900">{contacts.length}</p>
          </div>
        </div>

        {lp.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Notes</p>
            <p className="text-sm text-gray-700">{lp.notes}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { key: 'entities', label: `Investing Entities (${entities.length})` },
          { key: 'contacts', label: `Contacts (${contacts.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Entities */}
      {activeTab === 'entities' && (
        <div className="card overflow-hidden">
          {entities.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No investing entities on file</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {entities.map((e: any) => (
                <div key={e.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{e.legal_name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">{e.entity_type} · {e.domicile}</span>
                        {e.tax_id && <span className="text-xs text-gray-400">Tax ID: {e.tax_id}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${amlColor(e.aml_kyc_status)} capitalize`}>{e.aml_kyc_status || 'Unknown'}</span>
                      <span className="text-xs text-gray-400 capitalize">{e.subscription_doc_status?.replace('_', ' ')}</span>
                    </div>
                  </div>
                  {e.aml_kyc_date && (
                    <p className="text-xs text-gray-400 mt-2">AML/KYC completed {fmtDate(e.aml_kyc_date)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contacts */}
      {activeTab === 'contacts' && (
        <div>
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setContactModal({ open: true, contact: null })}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Contact
            </button>
          </div>

          <div className="card overflow-hidden">
            {contacts.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <p className="mb-3">No contacts on file</p>
                <button
                  onClick={() => setContactModal({ open: true, contact: null })}
                  className="text-blue-600 text-sm hover:underline"
                >
                  Add the first contact →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {contacts.map((c: any) => (
                  <div key={c.id} className="px-6 py-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{c.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{c.title}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${roleColor(c.role)} capitalize`}>
                          {c.role?.replace('_', ' ')}
                        </span>
                        <span className={`text-xs font-medium ${strengthColor(c.relationship_strength)} capitalize`}>
                          ● {c.relationship_strength}
                        </span>
                        <button
                          onClick={() => setContactModal({ open: true, contact: c })}
                          className="ml-2 text-xs text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-2 py-0.5 rounded transition-colors"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {c.email && <a href={`mailto:${c.email}`} className="hover:text-blue-600">{c.email}</a>}
                      {c.phone && <span>{c.phone}</span>}
                      {c.last_interaction_date && <span>Last contact: {fmtDate(c.last_interaction_date)}</span>}
                    </div>
                    {c.notes && <p className="text-xs text-gray-400 mt-2">{c.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
