import React, { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import BaseModal from '../components/BaseModal.jsx';

const ROLE_LABELS = {
  administrator: { label: 'Administrator', icon: '👑', color: 'bg-blue-100 text-blue-800' },
  engineer:      { label: 'Engineer',       icon: '🔧', color: 'bg-green-100 text-green-800' },
  admin_assist:  { label: 'Admin Assist',   icon: '🗂️', color: 'bg-purple-100 text-purple-800' },
  viewer:        { label: 'Viewer',         icon: '👁', color: 'bg-gray-100 text-gray-600' },
  // legacy
  admin:         { label: 'Administrator',  icon: '👑', color: 'bg-blue-100 text-blue-800' },
  editor:        { label: 'Engineer',       icon: '🔧', color: 'bg-green-100 text-green-800' },
};

const PERM_LIST = [
  { key: 'can_edit',        label: 'Edit Records',   icon: '✏️', desc: 'Add & edit customers, equipment, calibrations' },
  { key: 'can_delete',      label: 'Delete Records', icon: '🗑️', desc: 'Delete records and equipment' },
  { key: 'can_audit',       label: 'Audit Log',      icon: '📋', desc: 'View the full audit trail' },
  { key: 'can_send_report', label: 'Send Reports',   icon: '📤', desc: 'Email and Telegram report delivery' },
];

function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '', password_hint: '' });
  const [loading, setLoading] = useState(false);
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const toast = useToast();

  function set(f) { return e => setForm(v => ({ ...v, [f]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.new_password !== form.confirm) { toast('New passwords do not match', 'error'); return; }
    if (form.new_password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    if (!form.password_hint.trim()) { toast('Password hint is required', 'error'); return; }
    setLoading(true);
    try {
      await api.changePassword({ current_password: form.current_password, new_password: form.new_password, password_hint: form.password_hint });
      toast('Password updated successfully');
      onClose();
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <BaseModal title="🔑 Change Password" onClose={onClose} zIndex={50} maxWidth="max-w-sm">
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
            <p className="text-xs text-gray-400 mt-1">💡 This hint will be shown on the login page to help you remember your password.</p>
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

function UpdateHintModal({ currentHint, onClose, onSaved }) {
  const [hint, setHint] = useState(currentHint || '');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!hint.trim()) { toast('Hint cannot be empty', 'error'); return; }
    setLoading(true);
    try {
      await api.updateHint(hint.trim());
      toast('Password hint updated');
      onSaved();
      onClose();
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <BaseModal title="💡 Update Password Hint" onClose={onClose} zIndex={50} maxWidth="max-w-sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-500">This hint will be shown on the login page after you enter your username, to help you remember your password.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password Hint</label>
            <input
              type="text"
              value={hint}
              onChange={e => setHint(e.target.value)}
              required
              autoFocus
              placeholder="e.g. My dog's name + birth year"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50" style={{ background: '#1A4B8C' }}>
              {loading ? 'Saving…' : 'Save Hint'}
            </button>
          </div>
        </form>
    </BaseModal>
  );
}

export default function Profile() {
  const { user: authUser, canEdit, canDelete, canAudit, canSendReport, isAdmin } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showUpdateHint, setShowUpdateHint] = useState(false);
  const [form, setForm] = useState({ name: '', position: '', email: '', phone: '' });

  async function load() {
    try {
      const p = await api.getProfile();
      setProfile(p);
      setForm({ name: p.name || '', position: p.position || '', email: p.email || '', phone: p.phone || '' });
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile(form);
      toast('Profile updated');
      setEditing(false);
      load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;

  const roleInfo = ROLE_LABELS[profile?.role] || { label: profile?.role, icon: '👤', color: 'bg-gray-100 text-gray-600' };
  const perms = profile?.permissions || {};
  const permFlags = { can_edit: canEdit, can_delete: canDelete, can_audit: canAudit, can_send_report: canSendReport };

  const initials = (profile?.name || profile?.username || '?').charAt(0).toUpperCase();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">View your access level and update your contact details</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {/* Avatar + name row */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
            style={{ background: '#1A4B8C' }}>
            {initials}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile?.name || profile?.username}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${roleInfo.color}`}>
                {roleInfo.icon} {roleInfo.label}
              </span>
              {profile?.position && (
                <span className="text-sm text-gray-500">{profile.position}</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">@{profile?.username} · Member since {new Date(profile?.created_at).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Details form */}
        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Personal Details</h3>
            {!editing ? (
              <button onClick={() => setEditing(true)}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
                ✏️ Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { setEditing(false); setForm({ name: profile?.name || '', position: profile?.position || '', email: profile?.email || '', phone: profile?.phone || '' }); }}
                  className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="text-sm px-3 py-1.5 text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#1A4B8C' }}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            )}
          </div>

          {editing ? (
            <div className="grid grid-cols-2 gap-4">
              {[
                { field: 'name', label: 'Full Name' },
                { field: 'position', label: 'Position / Job Title' },
                { field: 'email', label: 'Email Address' },
                { field: 'phone', label: 'Contact Number' },
              ].map(({ field, label }) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Full Name', val: profile?.name },
                { label: 'Position', val: profile?.position },
                { label: 'Email', val: profile?.email },
                { label: 'Contact', val: profile?.phone },
              ].map(({ label, val }) => (
                <div key={label}>
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-sm text-gray-800 mt-0.5">{val || <span className="text-gray-300 italic">Not set</span>}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Password & Hint section */}
        <div className="border-t border-gray-100 pt-4 mt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Password & Login Hint</h3>

          {/* Current hint display */}
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <span>💡</span>
              <span className="text-gray-500 text-xs">Current hint:</span>
              <span className="text-amber-800 text-xs font-medium">
                {profile?.password_hint || <span className="italic text-gray-400">No hint set</span>}
              </span>
            </div>
            <button onClick={() => setShowUpdateHint(true)}
              className="text-xs px-2.5 py-1 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors">
              ✏️ Update
            </button>
          </div>

          <button onClick={() => setShowChangePw(true)}
            className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            🔑 Change Password
          </button>
        </div>
      </div>

      {/* Authorization level */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Authorization Level</h3>
        <p className="text-xs text-gray-400 mb-4">Your access permissions in Diatec Tech & Support. Contact an Administrator to change these.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PERM_LIST.map(({ key, label, icon, desc }) => {
            const granted = isAdmin || !!permFlags[key];
            return (
              <div key={key} className={`flex items-start gap-3 p-3 rounded-lg border ${granted ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                <span className="text-lg leading-none mt-0.5">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${granted ? 'text-green-800' : 'text-gray-400'}`}>{label}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${granted ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-500'}`}>
                      {granted ? '✓ Granted' : '✗ No Access'}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${granted ? 'text-green-600' : 'text-gray-400'}`}>{desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {isAdmin && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
            <span>👑</span>
            <span>As Administrator, you have full access to all features and settings.</span>
          </div>
        )}
      </div>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
      {showUpdateHint && (
        <UpdateHintModal
          currentHint={profile?.password_hint}
          onClose={() => setShowUpdateHint(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
