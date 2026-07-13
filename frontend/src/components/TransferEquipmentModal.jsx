import React, { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import CustomerSelectList from './CustomerSelectList.jsx';
import BaseModal from './BaseModal.jsx';

export default function TransferEquipmentModal({ equipment, currentCustomerName, onClose, onDone }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCusts, setLoadingCusts] = useState(true);

  useEffect(() => {
    api.getCustomers()
      .then(list => setCustomers(list.filter(c => c.id !== equipment.customer_id)))
      .finally(() => setLoadingCusts(false));
  }, [equipment.customer_id]);

  async function handleTransfer() {
    if (!selected) return;
    setLoading(true);
    try {
      await api.transferEquipment(equipment.id, {
        target_customer_id: selected.id,
        transfer_note: note || undefined,
      });
      onDone(`Equipment transferred to ${selected.name}`);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  const label = `${equipment.equipment_name}${equipment.serial_number ? ` · ${equipment.serial_number}` : ''}`;

  return (
    <BaseModal title="Transfer Equipment" subtitle={label} onClose={onClose} zIndex={50}
      maxWidth="max-w-lg" containerClassName="flex flex-col max-h-[85vh]"
      footerClassName="justify-between"
      footer={<>
        {selected && (
          <span className="text-sm text-gray-600">
            Moving to: <strong>{selected.name}</strong>
          </span>
        )}
        <div className="flex gap-2 ml-auto">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={!selected || loading}
            className="px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40 hover:opacity-90"
            style={{ background: '#1A4B8C' }}>
            {loading ? 'Transferring…' : 'Transfer Equipment'}
          </button>
        </div>
      </>}>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* From */}
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
            <span className="font-medium text-gray-400">From:</span>
            <span className="font-semibold text-gray-800">{currentCustomerName}</span>
            <span className="ml-auto text-xs text-gray-400">→ transferring to…</span>
          </div>

          {/* Target customer search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Target Customer</label>
            <input
              placeholder="Search by name or state…"
              value={search} onChange={e => { setSearch(e.target.value); setSelected(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Customer list */}
          <CustomerSelectList customers={customers} loading={loadingCusts} search={search} selected={selected} onSelect={setSelected} />

          {/* Transfer note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Note <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              placeholder={`e.g. Customer converted from ${currentCustomerName} to direct`}
              value={note} onChange={e => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Cal history note */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700">
            <span className="mt-0.5">ℹ️</span>
            <span>All calibration history will move with the equipment to the new customer account.</span>
          </div>
        </div>
    </BaseModal>
  );
}
