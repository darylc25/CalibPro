import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/index.js';

export default function ForceChangePassword() {
  const { user, logout, clearMustChangePassword } = useAuth();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '', password_hint: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.new_password !== form.confirm) { setError('New passwords do not match'); return; }
    if (form.new_password.length < 6) { setError('New password must be at least 6 characters'); return; }
    if (!form.password_hint.trim()) { setError('Please set a password hint'); return; }
    setLoading(true);
    try {
      await api.changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
        password_hint: form.password_hint,
      });
      clearMustChangePassword();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <img src="/diatec-logo.png" alt="Diatec" style={{ height: '52px', width: 'auto' }} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900">Welcome, {user?.name || user?.username}!</h2>
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <strong>Action required:</strong> Your account uses a temporary password. Please set a permanent password before continuing.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
              <div className="relative">
                <input type={showCur ? 'text' : 'password'} value={form.current_password}
                  onChange={set('current_password')} required autoFocus
                  placeholder="Enter the temporary password you received"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16" />
                <button type="button" onClick={() => setShowCur(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                  {showCur ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} value={form.new_password}
                  onChange={set('new_password')} required
                  placeholder="Min. 6 characters"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16" />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                  {showNew ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input type="password" value={form.confirm} onChange={set('confirm')} required
                placeholder="Repeat your new password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password Hint <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.password_hint} onChange={set('password_hint')} required
                placeholder="e.g. My dog's name + birth year"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">💡 Shown on the login page to help you remember your password.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                ❌ {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 text-sm font-semibold text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ background: '#1A4B8C' }}>
              {loading ? 'Saving…' : 'Set My Password & Continue'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Not you?{' '}
          <button onClick={logout} className="text-blue-500 hover:underline">Sign out</button>
        </p>
      </div>
    </div>
  );
}
