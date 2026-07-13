import React, { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import BaseModal from '../components/BaseModal.jsx';

// ─── Role & Permission constants ─────────────────────────────────────────────

const MENUS = [
  'Dashboard', 'Customers', 'Equipment', 'Jobs', 'Schedule',
  'Contracts', 'Pipeline', 'Export', 'Users & Staff',
  'Delete Requests', 'Audit Log', 'Access Control',
];

const ROLES = [
  { key: 'administrator', label: 'Administrator' },
  { key: 'engineer',      label: 'Engineer' },
  { key: 'admin_assist',  label: 'Admin Assist' },
  { key: 'viewer',        label: 'Viewer' },
];

const ACTIONS = ['can_view', 'can_add', 'can_edit', 'can_delete'];
const ACTION_LABELS = { can_view: 'View', can_add: 'Add', can_edit: 'Edit', can_delete: 'Delete' };
const ACTION_COLORS = {
  can_view:   'text-blue-600',
  can_add:    'text-green-600',
  can_edit:   'text-amber-600',
  can_delete: 'text-red-500',
};

// ─── Staff / User management constants ───────────────────────────────────────

const ROLE_BADGE = {
  administrator: { label: '👑 Administrator', color: 'bg-blue-100 text-blue-800' },
  engineer:      { label: '🔧 Engineer',       color: 'bg-green-100 text-green-800' },
  admin_assist:  { label: '🗂️ Admin Assist',   color: 'bg-purple-100 text-purple-800' },
  viewer:        { label: '👁 Viewer',          color: 'bg-gray-100 text-gray-600' },
};

const EMPTY_USER = { username: '', role: 'engineer', name: '', email: '', active: true };

// ─── Shared Toggle ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-blue-600' : 'bg-gray-200'} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

// ─── User Modal (no permissions) ─────────────────────────────────────────────

function UserModal({ user, onClose, onSave }) {
  const isEdit = !!user;
  const [form, setForm] = useState(isEdit ? { ...user, password: '' } : { ...EMPTY_USER });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }
  function setCheck(field) { return v => setForm(f => ({ ...f, [field]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await onSave(form, user?.id);
      if (!isEdit && result?.temp_password) setTempPassword(result.temp_password);
      else onClose();
    } catch { /* error already toasted */ }
    finally { setLoading(false); }
  }

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
            <p className="text-xs text-blue-500 mt-2">Share this password — user must change it on first login.</p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 text-sm font-semibold text-white rounded-lg hover:opacity-90" style={{ background: '#1A4B8C' }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <BaseModal title={isEdit ? 'Edit User' : 'Add User'} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

        {!isEdit ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400 font-normal">(for welcome email)</span></label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="e.g. ahmad@diatec.com.my"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">🔐 A temporary password will be auto-generated.</p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span></label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16" />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs hover:text-gray-600">{showPass ? 'Hide' : 'Show'}</button>
            </div>
          </div>
        )}

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

// ─── Change / Reset Password Modals ──────────────────────────────────────────

function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '', password_hint: '' });
  const [loading, setLoading] = useState(false);
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const toast = useToast();

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.new_password !== form.confirm) { toast('Passwords do not match', 'error'); return; }
    if (form.new_password.length < 6) { toast('Minimum 6 characters', 'error'); return; }
    if (!form.password_hint.trim()) { toast('Password hint is required', 'error'); return; }
    setLoading(true);
    try {
      await api.changePassword({ current_password: form.current_password, new_password: form.new_password, password_hint: form.password_hint });
      toast('Password changed');
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <input type="password" value={form.confirm} onChange={set('confirm')} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password Hint <span className="text-red-500">*</span></label>
          <input type="text" value={form.password_hint} onChange={set('password_hint')} required placeholder="e.g. My dog's name + birth year"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
    if (form.new_password.length < 6) { toast('Minimum 6 characters', 'error'); return; }
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <input type="password" value={form.confirm} onChange={set('confirm')} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password Hint <span className="text-gray-400 font-normal">(optional)</span></label>
          <input type="text" value={form.password_hint} onChange={set('password_hint')} placeholder="e.g. First pet + favourite number"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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

// ─── Staff Tab ────────────────────────────────────────────────────────────────

function StaffTab() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);
  const [showChangePw, setShowChangePw] = useState(false);
  const [resetUser, setResetUser] = useState(null);

  async function load() {
    try { setUsers(await api.getUsers()); } catch (e) { toast(e.message, 'error'); }
  }

  useEffect(() => { load(); }, []);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{users.length} user accounts</p>
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
              {['Name', 'Username', 'Role', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-white/80 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const badge = ROLE_BADGE[u.role] || { label: u.role, color: 'bg-gray-100 text-gray-600' };
              return (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: u.role === 'administrator' ? '#1A4B8C' : '#6B7280' }}>
                        {(u.name || u.username).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900">{u.name || u.username}</span>
                          {u.id === me?.id && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">You</span>}
                        </div>
                        {u.email && <p className="text-xs text-gray-400">{u.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.color}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Edit */}
                      <button onClick={() => setModal(u)} title="Edit user"
                        className="text-gray-500 hover:text-gray-800 p-1.5 rounded hover:bg-gray-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                        </svg>
                      </button>
                      {/* Reset PW */}
                      <button onClick={() => setResetUser(u)} title="Reset password"
                        className="text-amber-500 hover:text-amber-700 p-1.5 rounded hover:bg-amber-50 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd"/>
                        </svg>
                      </button>
                      {/* Remove */}
                      {u.id !== me?.id && (
                        <button onClick={() => handleDelete(u)} title="Remove user"
                          className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <UserModal user={modal === 'add' ? null : modal} onClose={() => setModal(null)} onSave={handleSave} />
      )}
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
      {resetUser && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} onDone={load} />}
    </div>
  );
}

// ─── Password Policy helpers ──────────────────────────────────────────────────

const EMPTY_POLICY = {
  min_length: 8, require_digit: 1, require_lowercase: 1,
  require_uppercase: 0, require_symbol: 0, prevent_reuse_count: 0,
  lockout_attempts: 5, lockout_duration: 30,
};

function buildPermMap(perms) {
  const map = {};
  for (const p of perms) {
    if (!map[p.role]) map[p.role] = {};
    map[p.role][p.menu] = { can_view: !!p.can_view, can_add: !!p.can_add, can_edit: !!p.can_edit, can_delete: !!p.can_delete };
  }
  return map;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccessControl() {
  const toast = useToast();
  const [tab, setTab] = useState('staff');
  const [policy, setPolicy] = useState(EMPTY_POLICY);
  const [permMap, setPermMap] = useState({});
  const [selectedRole, setSelectedRole] = useState('administrator');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getPasswordPolicy(), api.getRolePermissions()])
      .then(([pol, perms]) => {
        if (pol && pol.id) setPolicy(pol);
        setPermMap(buildPermMap(perms));
      })
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function savePolicy() {
    setSaving(true);
    try { await api.updatePasswordPolicy(policy); toast('Password policy saved'); }
    catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function savePermissions() {
    setSaving(true);
    try {
      const permissions = [];
      for (const role of ROLES.map(r => r.key)) {
        for (const menu of MENUS) {
          const p = permMap[role]?.[menu] || {};
          permissions.push({ role, menu, can_view: p.can_view ? 1 : 0, can_add: p.can_add ? 1 : 0, can_edit: p.can_edit ? 1 : 0, can_delete: p.can_delete ? 1 : 0 });
        }
      }
      await api.updateRolePermissions(permissions);
      toast('Permissions saved');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  function togglePerm(role, menu, action) {
    setPermMap(prev => ({
      ...prev,
      [role]: { ...prev[role], [menu]: { ...(prev[role]?.[menu] || {}), [action]: !(prev[role]?.[menu]?.[action]) } },
    }));
  }

  function setPol(key, val) { setPolicy(p => ({ ...p, [key]: val })); }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Access Control</h1>
        <p className="text-sm text-gray-500">Manage staff accounts, password policy and role-based permissions</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'staff',       label: '👷 Staff' },
          { key: 'permissions', label: '🛡 Role & Permission' },
          { key: 'password',    label: '🔒 Password Policy' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Staff ── */}
      {tab === 'staff' && <StaffTab />}

      {/* ── TAB 2: Password Policy ── */}
      {tab === 'password' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h2 className="text-base font-semibold text-gray-800">Password Requirements</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Min. Password Length</label>
              <div className="flex items-center gap-3">
                <input type="range" min={4} max={32} value={policy.min_length}
                  onChange={e => setPol('min_length', +e.target.value)} className="flex-1 accent-blue-600" />
                <span className="w-8 text-center text-sm font-semibold text-gray-700">{policy.min_length}</span>
              </div>
              <p className="text-xs text-gray-400">Characters required: {policy.min_length}</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Prevent Password Reuse</label>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={24} value={policy.prevent_reuse_count}
                  onChange={e => setPol('prevent_reuse_count', +e.target.value)} className="flex-1 accent-blue-600" />
                <span className="w-8 text-center text-sm font-semibold text-gray-700">{policy.prevent_reuse_count}</span>
              </div>
              <p className="text-xs text-gray-400">{policy.prevent_reuse_count === 0 ? 'No restriction' : `Cannot reuse last ${policy.prevent_reuse_count} passwords`}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Character Requirements</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'require_digit',     label: 'Require Digit (0–9)',     hint: 'At least one number' },
                { key: 'require_lowercase', label: 'Require Lowercase (a–z)', hint: 'At least one lowercase letter' },
                { key: 'require_uppercase', label: 'Require Uppercase (A–Z)', hint: 'At least one uppercase letter' },
                { key: 'require_symbol',    label: 'Require Symbol (!@#…)',   hint: 'At least one special character' },
              ].map(({ key, label, hint }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-700">{label}</div>
                    <div className="text-xs text-gray-400">{hint}</div>
                  </div>
                  <Toggle checked={!!policy[key]} onChange={v => setPol(key, v ? 1 : 0)} />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Account Lockout</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Lockout Attempts</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={20} value={policy.lockout_attempts}
                    onChange={e => setPol('lockout_attempts', +e.target.value)} className="flex-1 accent-blue-600" />
                  <span className="w-8 text-center text-sm font-semibold text-gray-700">{policy.lockout_attempts}</span>
                </div>
                <p className="text-xs text-gray-400">Lock after {policy.lockout_attempts} failed attempts</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Lock Duration (minutes)</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={1440} step={5} value={policy.lockout_duration}
                    onChange={e => setPol('lockout_duration', +e.target.value)} className="flex-1 accent-blue-600" />
                  <span className="w-12 text-center text-sm font-semibold text-gray-700">{policy.lockout_duration}m</span>
                </div>
                <p className="text-xs text-gray-400">
                  {policy.lockout_duration >= 60
                    ? `${Math.floor(policy.lockout_duration / 60)}h ${policy.lockout_duration % 60 > 0 ? `${policy.lockout_duration % 60}m` : ''} lockout`
                    : `${policy.lockout_duration} minute lockout`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={savePolicy} disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ background: '#1A4B8C' }}>
              {saving ? 'Saving…' : 'Save Policy'}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 3: Role & Permission ── */}
      {tab === 'permissions' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {ROLES.map(r => (
              <button key={r.key} onClick={() => setSelectedRole(r.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${selectedRole === r.key ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}
                style={selectedRole === r.key ? { background: '#1A4B8C' } : {}}>
                {r.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead style={{ background: '#1A4B8C' }}>
                <tr>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-white/80 uppercase tracking-wide w-48">Menu</th>
                  {ACTIONS.map(a => (
                    <th key={a} className="py-3 px-4 text-center text-xs font-semibold text-white uppercase tracking-wide">{ACTION_LABELS[a]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MENUS.map((menu, i) => (
                  <tr key={menu} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                    <td className="py-3 px-5 font-medium text-gray-800">{menu}</td>
                    {ACTIONS.map(action => {
                      const checked = !!(permMap[selectedRole]?.[menu]?.[action]);
                      return (
                        <td key={action} className="py-3 px-4 text-center">
                          <input type="checkbox" checked={checked}
                            onChange={() => togglePerm(selectedRole, menu, action)}
                            className={`w-4 h-4 rounded cursor-pointer ${ACTION_COLORS[action]}`}
                            style={{ accentColor: action === 'can_view' ? '#2563eb' : action === 'can_add' ? '#16a34a' : action === 'can_edit' ? '#d97706' : '#ef4444' }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
            {ACTIONS.map(a => (
              <span key={a} className={`flex items-center gap-1 font-medium ${ACTION_COLORS[a]}`}>
                <span className="inline-block w-3 h-3 rounded-sm border" style={{ background: a === 'can_view' ? '#dbeafe' : a === 'can_add' ? '#dcfce7' : a === 'can_edit' ? '#fef3c7' : '#fee2e2' }} />
                {ACTION_LABELS[a]}
              </span>
            ))}
          </div>

          <div className="flex justify-end">
            <button onClick={savePermissions} disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ background: '#1A4B8C' }}>
              {saving ? 'Saving…' : 'Save Permissions'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
