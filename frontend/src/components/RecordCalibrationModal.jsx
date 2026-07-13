import React, { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import BaseModal from './BaseModal.jsx';

const SERVICE_TYPES = ['Calibration', 'Repair', 'Maintenance', 'Add-on Modules', 'Installation', 'Inspection'];
const CAL_STATUSES = ['Completed', 'Pending', 'In Progress', 'Failed'];
const TODAY = new Date().toISOString().split('T')[0];

function addOneYear(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
}

export default function RecordCalibrationModal({
  onClose,
  onSave,
  initialEquipmentId,
  initialCustomerId,
  initialServiceType,
  record, // pass an existing calibration record to enter edit mode
}) {
  const isEdit = !!record;

  const [customers, setCustomers] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [filteredEquipment, setFilteredEquipment] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [form, setForm] = useState(() => {
    if (record) {
      return {
        customer_id: record.customer_id || '',
        equipment_id: record.equipment_id || '',
        calibration_date: record.calibration_date || TODAY,
        next_calibration_date: record.next_calibration_date || addOneYear(record.calibration_date || TODAY),
        performed_by: record.performed_by || '',
        service_type: record.service_type || 'Calibration',
        job_sheet_number: record.job_sheet_number || '',
        cal_report_status: record.cal_report_status || 'Completed',
        quotation_sent: !!record.quotation_sent,
        fee: record.fee ?? '',
        notes: record.notes || '',
        currency: record.currency || 'MYR',
      };
    }
    return {
      customer_id: initialCustomerId || '',
      equipment_id: initialEquipmentId || '',
      calibration_date: TODAY,
      next_calibration_date: addOneYear(TODAY),
      performed_by: '',
      service_type: initialServiceType || 'Calibration',
      job_sheet_number: '',
      cal_report_status: 'Completed',
      quotation_sent: false,
      fee: '',
      notes: '',
      currency: 'MYR',
    };
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.getCustomers(), api.getEquipment(), api.getStaff()]).then(([c, e, s]) => {
      setCustomers(c);
      setAllEquipment(e);
      setStaffList(s.filter(m => m.active));
      const custId = form.customer_id;
      setFilteredEquipment(custId ? e.filter(eq => String(eq.customer_id) === String(custId)) : e);
    });
  }, []);

  function set(field) {
    return e => {
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      setForm(f => {
        const next = { ...f, [field]: val };
        if (field === 'calibration_date') {
          next.next_calibration_date = addOneYear(val);
        }
        if (field === 'customer_id') {
          next.equipment_id = '';
          setFilteredEquipment(allEquipment.filter(eq => String(eq.customer_id) === String(val)));
        }
        return next;
      });
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.equipment_id || !form.calibration_date) return;
    setLoading(true);
    try {
      const payload = {
        ...form,
        customer_id: form.customer_id || null,
        fee: form.fee !== '' ? parseFloat(form.fee) : null,
      };
      await onSave(payload, record?.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <BaseModal title={isEdit ? 'Edit Job' : 'Log Job'} onClose={onClose}
      subtitle={isEdit ? <>{record.equipment_name} · {record.customer_name}</> : null}
      subtitleClassName="text-gray-400"
      maxWidth="max-w-xl" containerClassName="max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {!isEdit && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <select value={form.customer_id} onChange={set('customer_id')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                  <option value="">All customers…</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipment *</label>
                <select value={form.equipment_id} onChange={set('equipment_id')} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                  <option value="">Select equipment…</option>
                  {filteredEquipment.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.equipment_name} — {e.serial_number || 'No S/N'} ({e.customer_name})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Date *</label>
              <input type="date" value={form.calibration_date} onChange={set('calibration_date')} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Calibration</label>
              <input type="date" value={form.next_calibration_date} onChange={set('next_calibration_date')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
              <select value={form.service_type} onChange={set('service_type')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Performed By</label>
              {staffList.length > 0 ? (
                <select value={form.performed_by} onChange={set('performed_by')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                  <option value="">Select technician…</option>
                  {staffList.map(s => <option key={s.id} value={s.name}>{s.name} — {s.role}</option>)}
                  <option value="__custom__">Other (type name)</option>
                </select>
              ) : (
                <input value={form.performed_by} onChange={set('performed_by')} placeholder="Technician name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
              )}
              {form.performed_by === '__custom__' && (
                <input
                  placeholder="Enter name"
                  onChange={e => setForm(f => ({ ...f, performed_by: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-navy"
                  autoFocus
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Sheet No.</label>
              <input value={form.job_sheet_number} onChange={set('job_sheet_number')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Status</label>
              <select value={form.cal_report_status} onChange={set('cal_report_status')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fee (MYR)</label>
              <input type="number" step="0.01" min="0" value={form.fee} onChange={set('fee')} placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            <div className="flex items-center mt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.quotation_sent} onChange={set('quotation_sent')}
                  className="w-4 h-4 rounded" />
                <span className="text-sm font-medium text-gray-700">Quotation Sent</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2}
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
              {loading ? 'Saving…' : isEdit ? 'Update Job' : 'Save Job'}
            </button>
          </div>
        </form>
    </BaseModal>
  );
}
