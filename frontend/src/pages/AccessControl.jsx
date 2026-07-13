import React, { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { useToast } from '../components/Toast.jsx';

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

const EMPTY_POLICY = {
  min_length: 8,
  require_digit: 1,
  require_lowercase: 1,
  require_uppercase: 0,
  require_symbol: 0,
  prevent_reuse_count: 0,
  lockout_attempts: 5,
  lockout_duration: 30,
};

function buildPermMap(perms) {
  const map = {};
  for (const p of perms) {
    if (!map[p.role]) map[p.role] = {};
    map[p.role][p.menu] = {
      can_view: !!p.can_view,
      can_add: !!p.can_add,
      can_edit: !!p.can_edit,
      can_delete: !!p.can_delete,
    };
  }
  return map;
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

export default function AccessControl() {
  const toast = useToast();
  const [tab, setTab] = useState('password');
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
    try {
      await api.updatePasswordPolicy(policy);
      toast('Password policy saved');
    } catch (e) { toast(e.message, 'error'); }
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
      [role]: {
        ...prev[role],
        [menu]: {
          ...(prev[role]?.[menu] || {}),
          [action]: !(prev[role]?.[menu]?.[action]),
        },
      },
    }));
  }

  function setPol(key, val) {
    setPolicy(p => ({ ...p, [key]: val }));
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Access Control</h1>
        <p className="text-sm text-gray-500">Manage password policy and role-based permissions</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'password', label: '🔒 Password Policy' },
          { key: 'permissions', label: '🛡 Role & Permission' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Password Policy ── */}
      {tab === 'password' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h2 className="text-base font-semibold text-gray-800">Password Requirements</h2>

          {/* Min length */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Min. Password Length</label>
              <div className="flex items-center gap-3">
                <input type="range" min={4} max={32} value={policy.min_length}
                  onChange={e => setPol('min_length', +e.target.value)}
                  className="flex-1 accent-blue-600" />
                <span className="w-8 text-center text-sm font-semibold text-gray-700">{policy.min_length}</span>
              </div>
              <p className="text-xs text-gray-400">Characters required: {policy.min_length}</p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Prevent Password Reuse</label>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={24} value={policy.prevent_reuse_count}
                  onChange={e => setPol('prevent_reuse_count', +e.target.value)}
                  className="flex-1 accent-blue-600" />
                <span className="w-8 text-center text-sm font-semibold text-gray-700">{policy.prevent_reuse_count}</span>
              </div>
              <p className="text-xs text-gray-400">{policy.prevent_reuse_count === 0 ? 'No restriction' : `Cannot reuse last ${policy.prevent_reuse_count} passwords`}</p>
            </div>
          </div>

          {/* Toggles */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Character Requirements</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'require_digit',     label: 'Require Digit (0–9)',        hint: 'At least one number' },
                { key: 'require_lowercase', label: 'Require Lowercase (a–z)',    hint: 'At least one lowercase letter' },
                { key: 'require_uppercase', label: 'Require Uppercase (A–Z)',    hint: 'At least one uppercase letter' },
                { key: 'require_symbol',    label: 'Require Symbol (!@#…)',      hint: 'At least one special character' },
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

          {/* Lockout */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Account Lockout</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Lockout Attempts</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={20} value={policy.lockout_attempts}
                    onChange={e => setPol('lockout_attempts', +e.target.value)}
                    className="flex-1 accent-blue-600" />
                  <span className="w-8 text-center text-sm font-semibold text-gray-700">{policy.lockout_attempts}</span>
                </div>
                <p className="text-xs text-gray-400">Lock after {policy.lockout_attempts} failed attempts</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Lock Duration (minutes)</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={1440} step={5} value={policy.lockout_duration}
                    onChange={e => setPol('lockout_duration', +e.target.value)}
                    className="flex-1 accent-blue-600" />
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

      {/* ── TAB 2: Role & Permission ── */}
      {tab === 'permissions' && (
        <div className="space-y-4">
          {/* Role selector */}
          <div className="flex gap-2 flex-wrap">
            {ROLES.map(r => (
              <button key={r.key} onClick={() => setSelectedRole(r.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${selectedRole === r.key ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}
                style={selectedRole === r.key ? { background: '#1A4B8C' } : {}}>
                {r.label}
              </button>
            ))}
          </div>

          {/* Permission matrix */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead style={{ background: '#1A4B8C' }}>
                <tr>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-white/80 uppercase tracking-wide w-48">Menu</th>
                  {ACTIONS.map(a => (
                    <th key={a} className="py-3 px-4 text-center text-xs font-semibold text-white/80 uppercase tracking-wide">
                      <span className="text-white">{ACTION_LABELS[a]}</span>
                    </th>
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
                          <input
                            type="checkbox"
                            checked={checked}
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

          {/* Legend */}
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
