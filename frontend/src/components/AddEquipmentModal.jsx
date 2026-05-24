import React, { useState } from 'react';

const EQUIPMENT_TYPES = ['TITAN', 'ECLIPSE', 'AD629', 'AD226', 'Otoread', 'AFFINITY COMPACT', 'SERA', 'Silent Cabin', 'MT10-II', 'Other'];
const STATUSES = ['Active', 'Inactive', 'Under Repair', 'Decommissioned'];

const EMPTY = {
  equipment_name: '', model: '', serial_number: '', cal_code: '', modules: '',
  status: 'Active', warranty_period: '', installation_date: '', end_of_warranty: '',
  location: '', accessories: '', software_version: '', otoaccess_version: '', remarks: ''
};

export default function AddEquipmentModal({ onClose, onSave, customerId, initial }) {
  const [form, setForm] = useState(initial || EMPTY);
  const [loading, setLoading] = useState(false);

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.equipment_name.trim()) return;
    setLoading(true);
    try {
      await onSave({ ...form, customer_id: customerId });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">{initial?.id ? 'Edit Equipment' : 'Add Equipment'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Type *</label>
              <select value={form.equipment_name} onChange={set('equipment_name')} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                <option value="">Select type…</option>
                {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input value={form.model} onChange={set('model')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
              <input value={form.serial_number} onChange={set('serial_number')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cal Code</label>
              <input value={form.cal_code} onChange={set('cal_code')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modules</label>
            <input value={form.modules} onChange={set('modules')} placeholder="e.g. DPOAE, TEOAE, ABR"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={set('status')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Period</label>
              <input value={form.warranty_period} onChange={set('warranty_period')} placeholder="e.g. 1 Year"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Installation Date</label>
              <input type="date" value={form.installation_date} onChange={set('installation_date')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End of Warranty</label>
              <input type="date" value={form.end_of_warranty} onChange={set('end_of_warranty')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Software Version</label>
              <input value={form.software_version} onChange={set('software_version')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">OtoAccess Version</label>
              <input value={form.otoaccess_version} onChange={set('otoaccess_version')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input value={form.location} onChange={set('location')} placeholder="e.g. Audiology Dept, Level 2"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Accessories</label>
            <input value={form.accessories} onChange={set('accessories')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea value={form.remarks} onChange={set('remarks')} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ background: '#0D2847' }}>
              {loading ? 'Saving…' : 'Save Equipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
