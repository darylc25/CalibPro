import React, { useState } from 'react';
import { getWarrantyStatus, WARRANTY_BADGE } from '../api/index.js';
import BaseModal from './BaseModal.jsx';

const EQUIPMENT_TYPES = ['TITAN', 'ECLIPSE', 'AD629', 'AD226', 'Otoread', 'AFFINITY COMPACT', 'SERA', 'Silent Cabin', 'MT10-II', 'Other'];
const STATUSES = ['Active', 'Inactive', 'Under Repair', 'Decommissioned'];
const BRANDS = ['Interacoustics', 'Amplivox', 'Maico', 'MedRx'];
const WARRANTY_OPTIONS = ['', '1 Year', '2 Years'];

const EMPTY = {
  equipment_name: '', brand: '', model: '', serial_number: '', cal_code: '', modules: '',
  status: 'Active', warranty_period: '', installation_date: '', end_of_warranty: '',
  location: '', accessories: '', software_version: '', otoaccess_version: '',
  end_user_name: '', end_user_contact: '', remarks: ''
};

function calcEndOfWarranty(installDate, period) {
  if (!installDate || !period) return '';
  const d = new Date(installDate);
  d.setFullYear(d.getFullYear() + (period === '2 Years' ? 2 : 1));
  return d.toISOString().split('T')[0];
}

export default function AddEquipmentModal({ onClose, onSave, customerId, initial, isDealer }) {
  const [form, setForm] = useState(initial || EMPTY);
  const [loading, setLoading] = useState(false);

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  function setWarrantyField(field, value) {
    setForm(f => {
      const updated = { ...f, [field]: value };
      const instDate = field === 'installation_date' ? value : f.installation_date;
      const period = field === 'warranty_period' ? value : f.warranty_period;
      if (instDate && period) {
        updated.end_of_warranty = calcEndOfWarranty(instDate, period);
      } else if (!period) {
        updated.end_of_warranty = '';
      }
      return updated;
    });
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
    <BaseModal title={initial?.id ? 'Edit Equipment' : 'Add Equipment'} onClose={onClose}
      maxWidth="max-w-2xl" containerClassName="max-h-[90vh] flex flex-col">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <select value={form.brand} onChange={set('brand')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                <option value="">Select brand…</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input value={form.model} onChange={set('model')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
              <input value={form.serial_number} onChange={set('serial_number')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cal Code</label>
              <input value={form.cal_code} onChange={set('cal_code')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modules</label>
              <input value={form.modules} onChange={set('modules')} placeholder="e.g. DPOAE, TEOAE, ABR"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Installation Date</label>
              <input type="date" value={form.installation_date}
                onChange={e => setWarrantyField('installation_date', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Period</label>
              <select value={form.warranty_period}
                onChange={e => setWarrantyField('warranty_period', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                <option value="">No Warranty</option>
                {WARRANTY_OPTIONS.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End of Warranty</label>
              <div className="relative">
                <input type="date" value={form.end_of_warranty} onChange={set('end_of_warranty')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
                {(() => {
                  const s = getWarrantyStatus(form.end_of_warranty);
                  if (!s) return null;
                  const badge = WARRANTY_BADGE[s];
                  return (
                    <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium px-2 py-0.5 rounded-full pointer-events-none ${badge.cls}`}>
                      {badge.label}
                    </span>
                  );
                })()}
              </div>
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

          {/* End-user section — always shown so info can be captured regardless of account type */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">End User (actual user of this equipment)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End User Name</label>
                <input value={form.end_user_name} onChange={set('end_user_name')} placeholder="Hospital / clinic name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End User Contact</label>
                <input value={form.end_user_contact} onChange={set('end_user_contact')} placeholder="Phone or email"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
              </div>
            </div>
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
              style={{ background: '#1A4B8C' }}>
              {loading ? 'Saving…' : 'Save Equipment'}
            </button>
          </div>
        </form>
    </BaseModal>
  );
}
