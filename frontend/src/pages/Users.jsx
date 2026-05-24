import React, { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

const EMPTY = { username: '', password: '', role: 'user', name: '' };

function UserModal({ user, onClose, onSave }) {
  const isEdit = !!user;
  const [form, setForm] = useState(isEdit ? { ...user, password: '' } : EMPTY);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try { await onSave(form, user?.id); onClose(); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit User' : 'Add User'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Ahmad bin Razak" required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input value={form.username} onChange={set('username')} placeholder="e.g. ahmad" required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password {isEdit && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
            </label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                placeholder={isEdit ? '••••••••' : 'Min 6 characters'} required={!isEdit}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10" />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{showPass ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={form.role} onChange={set('role')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="admin">👑 Admin — full access</option>
              <option value="user">👤 User — view only</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50" style={{ background: '#0D2847' }}>
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null); // null | 'add' | user object
  const { user: me } = useAuth();
  const toast = useToast();

  async function load() {
    try { setUsers(await api.getUsers()); } catch (e) { toast(e.message, 'error'); }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(form, id) {
    try {
      if (id) await api.updateUser(id, form);
      else await api.createUser(form);
      toast(id ? 'User updated' : 'User created');
      load();
    } catch (e) { toast(e.message, 'error'); throw e; }
  }

  async function handleDelete(u) {
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    try { await api.deleteUser(u.id); toast('User deleted'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage login accounts and access levels</p>
        </div>
        <button onClick={() => setModal('add')}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 flex items-center gap-2"
          style={{ background: '#0D2847' }}>
          + Add User
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: '#0D2847' }}>
            <tr>
              {['Name', 'Username', 'Role', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-white/80 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: u.role === 'admin' ? '#0D2847' : '#6B7280' }}>
                      {(u.name || u.username).charAt(0).toUpperCase()}
                    </div>
                    {u.name || u.username}
                    {u.id === me?.id && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">You</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3">
                  {u.role === 'admin'
                    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">👑 Admin</span>
                    : <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">👤 User</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setModal(u)} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">Edit</button>
                    {u.id !== me?.id && (
                      <button onClick={() => handleDelete(u)} className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Remove</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Role permissions:</strong> Admins have full access to create, edit and delete all records. Users can view everything but cannot make any changes.
      </div>

      {modal && (
        <UserModal
          user={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
