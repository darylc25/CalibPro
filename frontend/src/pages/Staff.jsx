import React, { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { useToast } from '../components/Toast.jsx';

const ROLES = ['Technician', 'Senior Technician', 'Engineer', 'Manager', 'Admin'];

const EMPTY = { name: '', email: '', phone: '', role: 'Technician', department: '', active: true };

function StaffModal({ onClose, onSave, initial }) {
  const [form, setForm] = useState(initial || EMPTY);
  const [loading, setLoading] = useState(false);

  function set(field) {
    return e => {
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      setForm(f => ({ ...f, [field]: val }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try { await onSave(form); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">{initial?.id ? 'Edit Staff' : 'Add Staff'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input value={form.name} onChange={set('name')} required autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email || ''} onChange={set('email')} placeholder="staff@company.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={form.phone || ''} onChange={set('phone')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={form.role} onChange={set('role')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input value={form.department || ''} onChange={set('department')} placeholder="e.g. Calibration Services"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
          </div>
          {initial?.id && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.active} onChange={set('active')} className="w-4 h-4 rounded" />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ background: '#0D2847' }}>
              {loading ? 'Saving…' : initial?.id ? 'Save Changes' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState('');
  const toast = useToast();

  function load() {
    setLoading(true);
    api.getStaff().then(setStaff).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = staff.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.role || '').toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd(form) {
    try {
      await api.createStaff(form);
      toast('Staff member added');
      setShowAdd(false);
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleEdit(form) {
    try {
      await api.updateStaff(editMember.id, form);
      toast('Staff updated');
      setEditMember(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleDelete(id) {
    try {
      await api.deleteStaff(id);
      toast('Staff member removed');
      setDeleteId(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  const activeCount = staff.filter(s => s.active).length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Technical Staff</h1>
          <p className="text-sm text-gray-500">{activeCount} active · {staff.length} total</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 flex items-center gap-2"
          style={{ background: '#0D2847' }}>
          + Add Staff
        </button>
      </div>

      <input
        placeholder="Search by name, email or role…"
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-3xl mb-3">👷</p>
            <p className="text-gray-500 font-medium">No staff added yet</p>
            <p className="text-sm text-gray-400 mt-1">Add your technical team to assign them to calibration jobs and email reports</p>
            <button onClick={() => setShowAdd(true)}
              className="mt-4 px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90"
              style={{ background: '#0D2847' }}>
              + Add First Staff Member
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ background: '#0D2847' }}>
              <tr>
                {['Name', 'Role', 'Department', 'Email', 'Phone', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-white/80 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} className={`border-b border-gray-50 hover:bg-blue-50/30 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ background: '#0D2847' }}>
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{s.role}</td>
                  <td className="py-3 px-4 text-gray-500">{s.department || '—'}</td>
                  <td className="py-3 px-4">
                    {s.email
                      ? <a href={`mailto:${s.email}`} className="text-blue-600 hover:underline">{s.email}</a>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{s.phone || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                      ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button onClick={() => setEditMember(s)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50">
                        Edit
                      </button>
                      <button onClick={() => setDeleteId(s.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50">
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && <StaffModal onClose={() => setShowAdd(false)} onSave={handleAdd} />}
      {editMember && <StaffModal onClose={() => setEditMember(null)} onSave={handleEdit} initial={editMember} />}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="font-bold text-gray-900 mb-2">Remove Staff Member?</h3>
            <p className="text-sm text-gray-500 mb-4">This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
