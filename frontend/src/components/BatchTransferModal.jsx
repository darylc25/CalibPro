import React, { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import CustomerSelectList from './CustomerSelectList.jsx';
import BaseModal from './BaseModal.jsx';

export default function BatchTransferModal({ fromCustomerName, equipmentCount, onClose, onTransfer }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCusts, setLoadingCusts] = useState(true);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    api.getCustomers().then(setCustomers).finally(() => setLoadingCusts(false));
  }, []);

  async function handleTransfer() {
    if (!selected || !confirmed) return;
    setLoading(true);
    try {
      await onTransfer(selected.id, note || undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <BaseModal title="Transfer All Equipment" onClose={onClose} zIndex={50}
      maxWidth="max-w-lg" containerClassName="flex flex-col max-h-[85vh]"
      subtitle={<>Moving all {equipmentCount} equipment from <strong>{fromCustomerName}</strong></>}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button
          onClick={handleTransfer}
          disabled={!selected || !confirmed || loading}
          className="px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg disabled:opacity-40 hover:bg-red-700">
          {loading ? 'Transferring…' : `Transfer ${equipmentCount} Equipment`}
        </button>
      </>}>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transfer All To</label>
            <input
              placeholder="Search customer…"
              value={search} onChange={e => { setSearch(e.target.value); setSelected(null); setConfirmed(false); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <CustomerSelectList customers={customers} loading={loadingCusts} search={search} selected={selected}
            onSelect={c => { setSelected(c); setConfirmed(false); }} maxHeight={200} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Note <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              placeholder="e.g. Customer converted to direct account"
              value={note} onChange={e => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {selected && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-semibold text-red-700">
                This will move all {equipmentCount} equipment (and their calibration history) from <strong>{fromCustomerName}</strong> to <strong>{selected.name}</strong>.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded" />
                <span className="text-sm text-red-700">I understand — proceed with batch transfer</span>
              </label>
            </div>
          )}
        </div>
    </BaseModal>
  );
}
