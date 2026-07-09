import React, { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import BaseModal from './BaseModal.jsx';
import CustomerSelectList from './CustomerSelectList.jsx';
import { useToast } from './Toast.jsx';

const DURATION_OPTIONS = [
  { label: '3 Years', value: 3 },
  { label: '5 Years', value: 5 },
  { label: 'Custom', value: 0 },
];

const EMPTY_FORM = {
  customer_id: null, customer_name: '', customer_address_1: '', customer_address_2: '',
  customer_city_postcode: '', customer_state: '', customer_tel: '',
  contract_date: new Date().toISOString().split('T')[0],
  duration_type: 3, custom_years: '', contract_start_year: new Date().getFullYear() + 1,
  annual_fee: '', notes: '',
};

const EMPTY_EQUIP = { equipment_id: null, equipment_model: '', serial_number: '' };

export default function AddContractModal({ onClose, onSave }) {
  const [form, setForm]             = useState(EMPTY_FORM);
  const [step, setStep]             = useState('customer');
  const [customers, setCustomers]   = useState([]);
  const [custLoading, setCustLoading] = useState(true);
  const [custSearch, setCustSearch] = useState('');
  const [custError, setCustError]   = useState(null);
  const [custEquip, setCustEquip]   = useState([]);   // equipment belonging to selected customer
  const [equipItems, setEquipItems] = useState([{ ...EMPTY_EQUIP }]); // equipment list for this contract
  const [saving, setSaving]         = useState(false);
  const toast = useToast();

  // ── Load customer list ──────────────────────────────────────────────────────
  function loadCustomers() {
    setCustLoading(true);
    setCustError(null);
    api.getCustomers()
      .then(d => setCustomers(Array.isArray(d) ? d : []))
      .catch(err => { console.error('[AddContractModal] getCustomers:', err); setCustError(err.message || 'Failed to load customers'); })
      .finally(() => setCustLoading(false));
  }
  useEffect(() => { loadCustomers(); }, []);

  // ── Load customer's equipment when customer selected ────────────────────────
  useEffect(() => {
    if (!form.customer_id) { setCustEquip([]); return; }
    api.getCustomer(form.customer_id)
      .then(d => setCustEquip(Array.isArray(d.equipment) ? d.equipment : []))
      .catch(() => setCustEquip([]));
  }, [form.customer_id]);

  // ── Customer selection ──────────────────────────────────────────────────────
  function selectCustomer(c) {
    setForm(f => ({
      ...f,
      customer_id: c.id,
      customer_name: c.name || '',
      customer_address_1: c.address || '',
      customer_address_2: c.address_2 || '',
      customer_city_postcode: c.city_postcode || '',
      customer_state: c.state || '',
      customer_tel: c.phone || '',
    }));
    setEquipItems([{ ...EMPTY_EQUIP }]);
    setStep('details');
  }

  // ── Equipment item helpers ──────────────────────────────────────────────────
  function setEquipField(idx, field, value) {
    setEquipItems(items => items.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function pickExistingEquip(idx, eq) {
    setEquipItems(items => items.map((item, i) => i === idx ? {
      equipment_id: eq.id,
      equipment_model: eq.equipment_name || '',
      serial_number: eq.serial_number || '',
    } : item));
  }

  function addEquipItem() {
    setEquipItems(items => [...items, { ...EMPTY_EQUIP }]);
  }

  function removeEquipItem(idx) {
    setEquipItems(items => items.filter((_, i) => i !== idx));
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const durationYears = form.duration_type === 0 ? parseInt(form.custom_years || 0, 10) : form.duration_type;
  const startYear     = parseInt(form.contract_start_year, 10) || new Date().getFullYear() + 1;
  const endYear       = durationYears > 0 ? startYear + durationYears - 1 : null;
  const annualFee     = parseFloat(form.annual_fee) || 0;
  const totalValue    = durationYears > 0 && annualFee > 0 ? annualFee * durationYears : 0;
  const hasEquip      = equipItems.some(e => e.equipment_model.trim());
  const canSubmit     = form.customer_name && hasEquip && form.contract_date &&
                        durationYears > 0 && form.contract_start_year && annualFee > 0;

  function set(field) {
    return ev => setForm(f => ({ ...f, [field]: ev.target.value }));
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const equipment_list = equipItems.filter(eq => eq.equipment_model.trim()).map(eq => ({
        equipment_id: eq.equipment_id || null,
        equipment_model: eq.equipment_model.trim(),
        serial_number: eq.serial_number.trim() || null,
      }));
      await onSave({
        customer_id: form.customer_id,
        customer_name: form.customer_name,
        customer_address_1: form.customer_address_1,
        customer_address_2: form.customer_address_2,
        customer_city_postcode: form.customer_city_postcode,
        customer_state: form.customer_state,
        customer_tel: form.customer_tel,
        contract_date: form.contract_date,
        equipment_list,
        duration_years: durationYears,
        contract_start_year: startYear,
        annual_fee: annualFee,
        notes: form.notes,
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <BaseModal
      title="New Service Contract"
      subtitle={step === 'customer' ? 'Step 1 — Select customer' : `Step 2 — Contract details · ${form.customer_name}`}
      onClose={onClose}
      maxWidth="max-w-2xl"
      containerClassName="max-h-[92vh] flex flex-col"
      headerActions={step === 'details' && (
        <button onClick={() => setStep('customer')} className="text-xs text-blue-600 hover:underline">← Change customer</button>
      )}
    >
      {step === 'customer' ? (
        <div className="p-5 flex flex-col gap-3 overflow-y-auto flex-1">
          <input placeholder="Search customers…" value={custSearch}
            onChange={e => setCustSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {custError ? (
            <div className="border border-red-200 rounded-lg p-4 text-center">
              <p className="text-sm text-red-600 mb-2">Failed to load customers: {custError}</p>
              <button onClick={loadCustomers} className="text-sm font-medium text-blue-600 hover:underline">Retry</button>
            </div>
          ) : (
            <CustomerSelectList
              customers={customers} loading={custLoading}
              search={custSearch} selected={customers.find(c => c.id === form.customer_id)}
              onSelect={selectCustomer} maxHeight={340} />
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">

          {/* ── Equipment ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Equipment</p>
              <button type="button" onClick={addEquipItem}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">
                + Add Equipment
              </button>
            </div>

            <div className="space-y-3">
              {equipItems.map((item, idx) => (
                <EquipmentRow
                  key={idx}
                  idx={idx}
                  item={item}
                  custEquip={custEquip}
                  canRemove={equipItems.length > 1}
                  onPick={eq => pickExistingEquip(idx, eq)}
                  onChangeModel={v => setEquipField(idx, 'equipment_model', v)}
                  onChangeSerial={v => setEquipField(idx, 'serial_number', v)}
                  onRemove={() => removeEquipItem(idx)}
                />
              ))}
            </div>
          </div>

          {/* ── Contract Terms ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contract Terms</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contract Date *</label>
                <input type="date" value={form.contract_date} onChange={set('contract_date')} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration *</label>
                <select value={form.duration_type}
                  onChange={e => setForm(f => ({ ...f, duration_type: parseInt(e.target.value, 10) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {form.duration_type === 0 ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Years *</label>
                  <input type="number" min="1" max="20" value={form.custom_years} onChange={set('custom_years')}
                    placeholder="e.g. 4"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ) : <div />}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Year *</label>
                <input type="number" min="2020" max="2050" value={form.contract_start_year}
                  onChange={set('contract_start_year')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {durationYears > 0 && (
              <p className="text-xs text-gray-500 mt-1.5">
                Contract period: <span className="font-semibold text-gray-700">{startYear} – {endYear}</span>
                {' '}({durationYears} year{durationYears !== 1 ? 's' : ''})
              </p>
            )}
          </div>

          {/* ── Financials ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Financials (excl. SST)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual Fee (MYR) *</label>
                <input type="number" min="0" step="0.01" value={form.annual_fee} onChange={set('annual_fee')}
                  placeholder="e.g. 2430"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Contract Value</label>
                <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-semibold text-gray-800">
                  {totalValue > 0
                    ? `RM ${totalValue.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* ── Customer Address ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Customer Address (for contract letter)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                <input value={form.customer_address_1} onChange={set('customer_address_1')}
                  placeholder="e.g. Lot 6219 & 6220, Jalan Toman 1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input value={form.customer_address_2} onChange={set('customer_address_2')}
                  placeholder="e.g. Kemayan Square"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City & Postcode</label>
                <input value={form.customer_city_postcode} onChange={set('customer_city_postcode')}
                  placeholder="e.g. 70200 Seremban"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input value={form.customer_state} onChange={set('customer_state')}
                  placeholder="e.g. Negeri Sembilan"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tel</label>
                <input value={form.customer_tel} onChange={set('customer_tel')}
                  placeholder="e.g. +06-768 6000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* ── Actions ── */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit || saving}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-40"
              style={{ background: '#1A4B8C' }}>
              {saving ? 'Creating…' : 'Create Contract'}
            </button>
          </div>
        </form>
      )}
    </BaseModal>
  );
}

// ── EquipmentRow ──────────────────────────────────────────────────────────────
function EquipmentRow({ idx, item, custEquip, canRemove, onPick, onChangeModel, onChangeSerial, onRemove }) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Filter customer equipment by search
  const filtered = custEquip.filter(eq => {
    if (!pickerSearch) return true;
    const q = pickerSearch.toLowerCase();
    return (eq.equipment_name || '').toLowerCase().includes(q) ||
           (eq.serial_number || '').toLowerCase().includes(q);
  });

  function handlePick(eq) {
    onPick(eq);
    setShowPicker(false);
    setPickerSearch('');
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Equipment {idx + 1}
        </span>
        <div className="flex-1" />
        {custEquip.length > 0 && (
          <button type="button" onClick={() => setShowPicker(v => !v)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-50">
            {showPicker ? 'Hide list' : 'Pick from customer records'}
          </button>
        )}
        {canRemove && (
          <button type="button" onClick={onRemove}
            className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50 font-medium">
            ✕ Remove
          </button>
        )}
      </div>

      {/* Picker dropdown */}
      {showPicker && (
        <div className="mb-3 border border-blue-200 rounded-lg bg-white overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              placeholder="Search by model or serial…"
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 160 }}>
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No equipment found</p>
            ) : filtered.map(eq => (
              <button key={eq.id} type="button" onClick={() => handlePick(eq)}
                className={`w-full text-left px-3 py-2 text-xs border-b border-gray-50 last:border-0 hover:bg-blue-50 flex items-center gap-2
                  ${item.equipment_id === eq.id ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-gray-700'}`}>
                {item.equipment_id === eq.id && <span className="text-blue-500 flex-shrink-0">✓</span>}
                <span className="font-medium flex-shrink-0">{eq.equipment_name}</span>
                {eq.serial_number && (
                  <span className="font-mono text-gray-400 text-[10px]">S/N: {eq.serial_number}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual fields */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Model {idx === 0 && <span className="text-red-400">*</span>}
          </label>
          <input
            value={item.equipment_model}
            onChange={e => onChangeModel(e.target.value)}
            placeholder="e.g. Otoread"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Serial Number</label>
          <input
            value={item.serial_number}
            onChange={e => onChangeSerial(e.target.value)}
            placeholder="e.g. SN IA3007686"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>
    </div>
  );
}
