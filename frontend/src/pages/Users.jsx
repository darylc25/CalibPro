import React, { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import BaseModal from '../components/BaseModal.jsx';

// Default permissions pre-filled when role is selected
const ROLE_DEFAULTS = {
  administrator: { can_edit: true, can_delete: true, can_audit: true, can_send_report: true },
  engineer:      { can_edit: true, can_delete: false, can_audit: false, can_send_report: false },
  admin_assist:  { can_edit: true, can_delete: false, can_audit: true,  can_send_report: true },
  viewer:        { can_edit: false, can_delete: false, can_audit: false, can_send_report: false },
};

const EMPTY = {
  username: '', role: 'engineer', name: '', email: '', active: true,
  permissions: { can_edit: true, can_delete: false, can_audit: false, can_send_report: false },
};

const PERM_OPTIONS = [
  { key: 'can_edit',        label: 'Edit',         desc: 'Add & edit records', icon: '✏️' },
  { key: 'can_delete',      label: 'Delete',        desc: 'Delete records & equipment', icon: '🗑️' },
  { key: 'can_audit',       label: 'Audit Log',     desc: 'View audit trail', icon: '📋' },
  { key: 'can_send_report', label: 'Send Report',   desc: 'Email calibration reports', icon: '📤' },
];

function Toggle({ checked, onChange, disabled }) {
  return (
    <label className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <div className="relative inline-flex items-center">
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
        <div className={`w-9 h-5 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-300'}`} />
        <div className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
    </label>
  );
}

function UserModal({ user, onClose, onSave }) {
  const isEdit = !!user;
  const initPerms = isEdit
    ? (user.permissions || { can_edit: false, can_delete: false, can_audit: false, can_send_report: false })
    : EMPTY.permissions;

  const [form, setForm] = useState(isEdit ? { ...user, password: '', permissions: { ...initPerms } } : { ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [tempPassword, setTempPassword] = useState(null); // shown after creation

  const isAdminRole = form.role === 'administrator';

  function set(field) {
    return e => {
      const val = e.target.value;
      setForm(f => {
        const next = { ...f, [field]: val };
        if (field === 'role') next.permissions = { ...ROLE_DEFAULTS[val] };
        return next;
      });
    };
  }
  function setCheck(field) { return e => setForm(f => ({ ...f, [field]: e.target.checked })); }
  function setPerm(key) {
    return e => setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: e.target.checked } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await onSave(form, user?.id);
      if (!isEdit && result?.temp_password) {
        setTempPassword(result.temp_password);
      } else {
        onClose();
      }
    } catch {
      // error already toasted by onSave
    } finally {
      setLoading(false);
    }
  }

  // After creation — show temp password screen
  if (tempPassword) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">User Created</h2>
          <p className="text-sm text-gray-500 mb-6">
            Account for <strong>{form.name || form.username}</strong> has been created.
            {form.email ? ' A welcome email has been sent.' : ''}
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-6">
            <p className="text-xs text-blue-600 font-semibold mb-2 uppercase tracking-wide">Temporary Password</p>
            <p className="font-mono text-2xl font-bold text-blue-900 tracking-widest select-all">{tempPassword}</p>
            <p className="text-xs text-blue-500 mt-2">
              {form.email
                ? 'This password was also emailed to the user.'
                : 'Share this password with the user — they must change it on first login.'}
            </p>
          </div>

          <button onClick={onClose}
            className="w-full py-2.5 text-sm font-semibold text-white rounded-lg hover:opacity-90"
            style={{ background: '#1A4B8C' }}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <BaseModal title={isEdit ? 'Edit User' : 'Add User'} onClose={onClose} maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name + Username */}
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Email (new users) or Password (edit) */}
          {!isEdit ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-gray-400 font-normal">(for welcome email with temp password)</span>
              </label>
              <input type="email" value={form.email} onChange={set('email')}
                placeholder="e.g. ahmad@diatec.com.my"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">
                🔐 A temporary password will be auto-generated. Leave email blank to skip sending.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
              </label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs hover:text-gray-600">{showPass ? 'Hide' : 'Show'}</button>
              </div>
            </div>
          )}

          {/* Role + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={form.role} onChange={set('role')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="administrator">👑 Administrator</option>
                <option value="engineer">🔧 Engineer</option>
                <option value="admin_assist">🗂️ Admin Assist</option>
                <option value="viewer">👁 Viewer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <label className="flex items-center gap-3 border border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
                <Toggle checked={!!form.active} onChange={setCheck('active')} />
                <span className={`text-sm font-medium ${form.active ? 'text-green-700' : 'text-gray-500'}`}>
                  {form.active ? 'Active' : 'Inactive'}
                </span>
              </label>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Permissions</label>
              {isAdminRole && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  👑 Admin has all permissions
                </span>
              )}
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {PERM_OPTIONS.map(({ key, label, desc, icon }, i) => {
                const isChecked = isAdminRole || !!form.permissions?.[key];
                return (
                  <div key={key} className={`flex items-center justify-between px-4 py-3 ${i < PERM_OPTIONS.length - 1 ? 'border-b border-gray-100' : ''} ${isAdminRole ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-base">{icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                    </div>
                    <Toggle
                      checked={isChecked}
                      onChange={setPerm(key)}
                      disabled={isAdminRole}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50" style={{ background: '#1A4B8C' }}>
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
    </BaseModal>
  );
}

function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '', password_hint: '' });
  const [loading, setLoading] = useState(false);
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const toast = useToast();

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.new_password !== form.confirm) { toast('New passwords do not match', 'error'); return; }
    if (form.new_password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    if (!form.password_hint.trim()) { toast('Password hint is required', 'error'); return; }
    setLoading(true);
    try {
      await api.changePassword({ current_password: form.current_password, new_password: form.new_password, password_hint: form.password_hint });
      toast('Password changed successfully');
      onClose();
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <BaseModal title="🔑 Change My Password" onClose={onClose} maxWidth="max-w-sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <div className="relative">
              <input type={showCur ? 'text' : 'password'} value={form.current_password} onChange={set('current_password')} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16" />
              <button type="button" onClick={() => setShowCur(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">{showCur ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={form.new_password} onChange={set('new_password')} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16" />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">{showNew ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" value={form.confirm} onChange={set('confirm')} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password Hint <span className="text-red-500">*</span></label>
            <input type="text" value={form.password_hint} onChange={set('password_hint')} required
              placeholder="e.g. My dog's name + birth year"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">💡 Shown on the login page to help you remember your password.</p>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50" style={{ background: '#1A4B8C' }}>
              {loading ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
    </BaseModal>
  );
}

function ResetPasswordModal({ user, onClose, onDone }) {
  const [form, setForm] = useState({ new_password: '', confirm: '', password_hint: '' });
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const toast = useToast();

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.new_password !== form.confirm) { toast('Passwords do not match', 'error'); return; }
    if (form.new_password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    setLoading(true);
    try {
      await api.resetUserPassword(user.id, { new_password: form.new_password, password_hint: form.password_hint });
      toast(`Password reset for ${user.name || user.username}`);
      onDone();
      onClose();
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <BaseModal title="🔑 Reset Password" onClose={onClose} zIndex={50} maxWidth="max-w-sm">
        <div className="px-6 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            Resetting password for <strong>{user.name || user.username}</strong> (@{user.username})
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={form.new_password} onChange={set('new_password')} required autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16" />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">{showNew ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" value={form.confirm} onChange={set('confirm')} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password Hint <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" value={form.password_hint} onChange={set('password_hint')}
              placeholder="e.g. First pet + favourite number"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">💡 Shown on the login page to help the user remember.</p>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50 bg-red-600 hover:bg-red-700">
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </form>
    </BaseModal>
  );
}

const ROLE_BADGE = {
  administrator: { label: '👑 Administrator', color: 'bg-blue-100 text-blue-800' },
  engineer:      { label: '🔧 Engineer',       color: 'bg-green-100 text-green-800' },
  admin_assist:  { label: '🗂️ Admin Assist',   color: 'bg-purple-100 text-purple-800' },
  viewer:        { label: '👁 Viewer',          color: 'bg-gray-100 text-gray-600' },
};

function StaffDirectory() {
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
    (s.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.position || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff Directory</h1>
        <p className="text-sm text-gray-500 mt-0.5">{staff.length} active staff</p>
      </div>

      <input
        placeholder="Search by name, username, position or email…"
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
            <p className="text-gray-500 font-medium">No staff found</p>
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
                    <td className="py-3 px-4 text-gray-600">{s.position || <span className="text-gray-300">—</span>}</td>
                    <td className="py-3 px-4">
                      {s.email ? <a href={`mailto:${s.email}`} className="text-blue-600 hover:underline">{s.email}</a> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{s.phone || <span className="text-gray-300">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null); // null | 'add' | user object
  const [showChangePw, setShowChangePw] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const { user: me, isAdmin } = useAuth();
  const toast = useToast();

  // All hooks must be called before any conditional return
  async function load() {
    try { setUsers(await api.getUsers()); } catch (e) { toast(e.message, 'error'); }
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function handleSave(form, id) {
    try {
      let result;
      if (id) { await api.updateUser(id, form); toast('User updated'); }
      else { result = await api.createUser(form); toast('User created'); }
      load();
      return result;
    } catch (e) { toast(e.message, 'error'); throw e; }
  }

  async function handleDelete(u) {
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    try { await api.deleteUser(u.id); toast('User deleted'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  if (!isAdmin) {
    return <StaffDirectory />;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage login accounts and access levels</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowChangePw(true)}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            🔑 Change My Password
          </button>
          <button onClick={() => setModal('add')}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 flex items-center gap-2"
            style={{ background: '#1A4B8C' }}>
            + Add User
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: '#1A4B8C' }}>
            <tr>
              {['Name', 'Username', 'Role', 'Permissions', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-white/80 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const perms = u.permissions || {};
              const isAdminUser = u.role === 'administrator' || u.role === 'admin';
              return (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: isAdminUser ? '#1A4B8C' : '#6B7280' }}>
                        {(u.name || u.username).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900">{u.name || u.username}</span>
                          {u.id === me?.id && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">You</span>}
                        </div>
                        {u.position && <p className="text-xs text-gray-400">{u.position}</p>}
                        {u.email && <p className="text-xs text-gray-400">{u.email}</p>}
                        {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3">
                    {isAdminUser
                      ? <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">👑 Administrator</span>
                      : u.role === 'engineer'
                      ? <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">🔧 Engineer</span>
                      : u.role === 'admin_assist'
                      ? <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">🗂️ Admin Assist</span>
                      : <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">👁 Viewer</span>}
                  </td>
                  <td className="px-4 py-3">
                    {isAdminUser ? (
                      <span className="text-xs text-blue-600 font-medium">All access</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {PERM_OPTIONS.map(({ key, label, icon }) => {
                          const on = perms[key];
                          return (
                            <span key={key} className={`text-xs px-1.5 py-0.5 rounded font-medium ${on ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                              {icon} {label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => setModal(u)} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">Edit</button>
                      <button onClick={() => setResetUser(u)} className="text-xs px-3 py-1.5 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50">🔑 Reset PW</button>
                      {u.id !== me?.id && (
                        <button onClick={() => handleDelete(u)} className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Remove</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Note:</strong> Administrator has full access to all features. Other roles use individually assigned permissions. Profile details (position, email, phone) are filled in by each user from their own Profile page.
      </div>

      {modal && (
        <UserModal
          user={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
      {resetUser && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} onDone={load} />}
    </div>
  );
}
