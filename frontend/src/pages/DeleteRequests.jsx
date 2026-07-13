import React, { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import BaseModal from '../components/BaseModal.jsx';

const STATUS_STYLES = {
  pending:   { bg: 'bg-amber-100', text: 'text-amber-700', label: '⏳ Pending' },
  in_review: { bg: 'bg-blue-100',  text: 'text-blue-700',  label: '🔍 In Review' },
  approved:  { bg: 'bg-green-100', text: 'text-green-700', label: '✅ Approved' },
  rejected:  { bg: 'bg-red-100',   text: 'text-red-700',   label: '❌ Rejected' },
};

const TYPE_ICONS = { customer: '🏥', equipment: '🔧', calibration: '📋' };

function ReviewModal({ req, onClose, onSave }) {
  const [status, setStatus] = useState(req.status === 'pending' ? 'in_review' : req.status);
  const [response, setResponse] = useState(req.admin_response || '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try { await onSave(req.id, { status, admin_response: response }); onClose(); }
    finally { setLoading(false); }
  }

  return (
    <BaseModal title="Review Request" onClose={onClose} zIndex={50} maxWidth="max-w-md"
      subtitle={<>{TYPE_ICONS[req.record_type] || '📄'} {req.record_label} · from {req.requested_by_name}</>}
      subtitleClassName="text-gray-400">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Requester's reason */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Reason given</p>
            <p className="text-sm text-gray-800">{req.reason}</p>
          </div>

          {/* Decision */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Decision</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'in_review', label: '🔍 In Review', bg: 'bg-blue-50 border-blue-300 text-blue-700' },
                { val: 'approved',  label: '✅ Approve',   bg: 'bg-green-50 border-green-300 text-green-700' },
                { val: 'rejected',  label: '❌ Reject',    bg: 'bg-red-50 border-red-300 text-red-700' },
              ].map(opt => (
                <button key={opt.val} type="button"
                  onClick={() => setStatus(opt.val)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border-2 transition-all ${status === opt.val ? opt.bg + ' ring-2 ring-offset-1 ring-current' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {status === 'approved' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-start gap-2">
              <span>⚠️</span>
              <p>Approving will <strong>permanently delete</strong> this {req.record_type} and all related data. This cannot be undone.</p>
            </div>
          )}

          {/* Admin response */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Response to requester {status === 'rejected' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={response}
              onChange={e => setResponse(e.target.value)}
              rows={3}
              placeholder="Optional message to the requester…"
              required={status === 'rejected'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className={`px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50
                ${status === 'approved' ? 'bg-red-600' : status === 'rejected' ? 'bg-gray-700' : ''}`}
              style={status === 'in_review' ? { background: '#1A4B8C' } : {}}>
              {loading ? 'Saving…' : status === 'approved' ? '✅ Confirm & Delete' : status === 'rejected' ? '❌ Reject Request' : '🔍 Mark In Review'}
            </button>
          </div>
        </form>
    </BaseModal>
  );
}

export default function DeleteRequests() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');

  async function load() {
    setLoading(true);
    try { setRequests(await api.getDeleteRequests()); }
    catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(id, data) {
    try {
      await api.reviewDeleteRequest(id, data);
      toast(data.status === 'approved' ? 'Record deleted' : data.status === 'rejected' ? 'Request rejected' : 'Status updated');
      load();
    } catch (e) { toast(e.message, 'error'); throw e; }
  }

  const filtered = requests.filter(r => statusFilter === 'all' || r.status === statusFilter);

  if (!isAdmin) return (
    <div className="p-8 text-center">
      <p className="text-4xl mb-3">🔒</p>
      <p className="font-semibold text-gray-700">Admin only</p>
    </div>
  );

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const inReviewCount = requests.filter(r => r.status === 'in_review').length;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Deletion Requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review and action requests from staff to delete records</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pending', count: requests.filter(r => r.status === 'pending').length, color: 'border-amber-400', icon: '⏳' },
          { label: 'In Review', count: requests.filter(r => r.status === 'in_review').length, color: 'border-blue-400', icon: '🔍' },
          { label: 'Approved', count: requests.filter(r => r.status === 'approved').length, color: 'border-green-400', icon: '✅' },
          { label: 'Rejected', count: requests.filter(r => r.status === 'rejected').length, color: 'border-red-400', icon: '❌' },
        ].map(({ label, count, color, icon }) => (
          <button key={label} onClick={() => setStatusFilter(label.toLowerCase().replace(' ', '_'))}
            className={`bg-white rounded-xl border-l-4 ${color} border border-gray-100 p-4 shadow-sm text-left hover:shadow-md transition-shadow
              ${statusFilter === label.toLowerCase().replace(' ', '_') ? 'ring-2 ring-offset-1 ring-blue-300' : ''}`}>
            <div className="text-xl mb-1">{icon}</div>
            <div className="text-2xl font-bold text-gray-900">{count}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'in_review', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
              ${statusFilter === s ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            style={statusFilter === s ? { background: '#1A4B8C' } : {}}>
            {s === 'all' ? 'All' : s === 'in_review' ? 'In Review' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s === 'pending' && pendingCount > 0 && <span className="ml-1.5 bg-amber-500 text-white rounded-full px-1.5 py-0.5" style={{ fontSize: '10px' }}>{pendingCount}</span>}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-12 text-center text-gray-400">
          <p className="text-4xl mb-2">🗑️</p>
          <p className="font-medium">No {statusFilter === 'all' ? '' : statusFilter} requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const s = STATUS_STYLES[r.status] || STATUS_STYLES.pending;
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0">{TYPE_ICONS[r.record_type] || '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                        <span className="text-xs text-gray-400 capitalize">{r.record_type}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <p className="font-semibold text-gray-900 truncate">{r.record_label || `ID #${r.record_id}`}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Requested by <span className="font-medium">{r.requested_by_name}</span></p>
                      <div className="mt-2 bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Reason</p>
                        <p className="text-sm text-gray-700">{r.reason}</p>
                      </div>
                      {r.admin_response && (
                        <div className="mt-2 bg-blue-50 rounded-lg p-2.5">
                          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-0.5">Admin response · {r.reviewed_by}</p>
                          <p className="text-sm text-blue-800">{r.admin_response}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {(r.status === 'pending' || r.status === 'in_review') && (
                    <button onClick={() => setReviewing(r)}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50">
                      Review
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {reviewing && (
        <ReviewModal req={reviewing} onClose={() => setReviewing(null)} onSave={handleSave} />
      )}
    </div>
  );
}
