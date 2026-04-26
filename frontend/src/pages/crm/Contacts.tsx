import { useQuery } from '@tanstack/react-query';
import { getContacts } from '../../api';
import Layout from '../../components/Layout';
import { Contact } from '../../types';

export default function Contacts() {
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => getContacts(),
  });

  const contacts = response?.data || [];

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'decision_maker': return 'badge-success';
      case 'gatekeeper': return 'badge-info';
      case 'operations': return 'badge-warning';
      case 'legal': return 'badge-danger';
      case 'tax': return 'badge-info';
      default: return 'badge-info';
    }
  };

  const getRelationshipColor = (strength?: string) => {
    switch (strength) {
      case 'strong': return 'text-green-600';
      case 'moderate': return 'text-blue-600';
      case 'weak': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
        <p className="text-gray-600 mt-2">LP contact management and relationship tracking</p>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading contacts...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Error loading contacts: {(error as any).message}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Title</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">LP</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Strength</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {contacts.map((contact: Contact) => (
              <tr key={contact.id} className="table-row">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{contact.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{contact.title || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{contact.lp_name || '-'}</td>
                <td className="px-6 py-4">
                  <span className={`badge ${getRoleColor(contact.role)}`}>
                    {contact.role ? contact.role.replace('_', ' ') : 'Other'}
                  </span>
                </td>
                <td className={`px-6 py-4 text-sm font-medium ${getRelationshipColor(contact.relationship_strength)}`}>
                  {contact.relationship_strength || 'Unknown'}
                </td>
                <td className="px-6 py-4 text-sm text-blue-600">
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="hover:underline">
                      {contact.email}
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isLoading && contacts.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No contacts found</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
