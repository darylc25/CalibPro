import React, { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { useToast } from '../components/Toast.jsx';

const ROLE_BADGE = {
  engineer:    { label: '🔧 Engineer',    color: 'bg-green-100 text-green-800' },
  admin_assist:{ label: '🗂️ Admin Assist', color: 'bg-purple-100 text-purple-800' },
};

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const toast = useToast();

  useEffect(() => {
    api.getStaff()
      .then(setStaff)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = staff.filter(s =>
    !search ||
    (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.position || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Technical Staff</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {staff.length} active staff · Managed via User Management
        </p>
      </div>

      <input
        placeholder="Search by name, email or position…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-3xl mb-3">👷</p>
            <p className="text-gray-500 font-medium">No technical staff found</p>
            <p className="text-sm text-gray-400 mt-1">
              Add users with the <strong>Engineer</strong> or <strong>Admin Assist</strong> role in User Management to see them here.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ background: '#1A4B8C' }}>
              <tr>
                {['Name', 'Role', 'Position', 'Email', 'Phone'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-white/80 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const badge = ROLE_BADGE[s.role] || { label: s.role, color: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={s.id} className={`border-b border-gray-50 hover:bg-blue-50/30 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ background: '#1A4B8C' }}>
                          {(s.name || s.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{s.name || s.username}</p>
                          <p className="text-xs text-gray-400">@{s.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{s.position || <span className="text-gray-300 italic">—</span>}</td>
                    <td className="py-3 px-4">
                      {s.email
                        ? <a href={`mailto:${s.email}`} className="text-blue-600 hover:underline">{s.email}</a>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{s.phone || <span className="text-gray-300">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 flex items-center gap-2">
        <span>💡</span>
        <span>Staff are automatically pulled from <strong>User Management</strong>. To add or update staff, create or edit a user with the <strong>Engineer</strong> or <strong>Admin Assist</strong> role.</span>
      </div>
    </div>
  );
}
