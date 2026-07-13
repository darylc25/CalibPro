import React, { useState } from 'react';
import { api } from '../api/index.js';
import { useToast } from './Toast.jsx';
import BaseModal from './BaseModal.jsx';

export default function RequestDeletionModal({ recordType, recordId, recordLabel, onClose, onSubmitted }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const typeLabel = recordType === 'customer' ? 'Customer'
    : recordType === 'equipment' ? 'Equipment'
    : 'Record';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await api.createDeleteRequest({ record_type: recordType, record_id: recordId, record_label: recordLabel, reason });
      toast('Deletion request submitted — admin will be notified');
      onSubmitted?.();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <BaseModal title="Request Deletion" onClose={onClose} zIndex={50} maxWidth="max-w-md"
      subtitle={<>{typeLabel}: <span className="font-medium text-gray-600">{recordLabel}</span></>}
      subtitleClassName="text-gray-400">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
            <span className="text-lg leading-none">⚠️</span>
            <p>You don't have permission to delete directly. Your request will be sent to an admin for approval.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for deletion <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              placeholder="Please explain why this record should be deleted…"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{reason.length} characters</p>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading || !reason.trim()}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ background: '#1A4B8C' }}>
              {loading ? 'Submitting…' : '📨 Submit Request'}
            </button>
          </div>
        </form>
    </BaseModal>
  );
}
