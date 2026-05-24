import React, { useEffect, useState } from 'react';
import { api, formatDate } from '../api/index.js';
import PriorityBadge from '../components/PriorityBadge.jsx';
import RecordCalibrationModal from '../components/RecordCalibrationModal.jsx';
import { useToast } from '../components/Toast.jsx';

const EQUIPMENT_TYPES = ['All', 'TITAN', 'ECLIPSE', 'AD629', 'AD226', 'Otoread', 'AFFINITY COMPACT', 'SERA', 'Silent Cabin', 'MT10-II'];
const STATUSES = ['All', 'Active', 'Inactive', 'Under Repair', 'Decommissioned'];
const STATES = ['All', 'Kuala Lumpur', 'Selangor', 'Penang', 'Johor', 'Sabah', 'Sarawak', 'Perak', 'Pahang', 'Terengganu', 'Kedah'];

export default function Equipment() {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [showCal, setShowCal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const toast = useToast();

  function load() {
    setLoading(true);
    api.getEquipment().then(setEquipment).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = equipment.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      e.equipment_name.toLowerCase().includes(q) ||
      (e.serial_number || '').toLowerCase().includes(q) ||
      (e.customer_name || '').toLowerCase().includes(q) ||
      (e.modules || '').toLowerCase().includes(q);
    const matchType = typeFilter === 'All' || e.equipment_name === typeFilter;
    const matchStatus = statusFilter === 'All' || e.status === statusFilter;
    const matchState = stateFilter === 'All' || e.customer_state === stateFilter;
    return matchSearch && matchType && matchStatus && matchState;
  });

  async function handleSaveCal(calForm) {
    try {
      await api.createCalibration(calForm);
      toast('Calibration recorded');
      setShowCal(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleDelete(id) {
    try {
      await api.deleteEquipment(id);
      toast('Equipment deleted');
      setDeleteId(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipment</h1>
          <p className="text-sm text-gray-500">{equipment.length} units total</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search equipment, S/N, customer…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
          {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
          {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </select>
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
          {STATES.map(s => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#0D2847' }}>
                <tr>
                  {['Equipment', 'Customer', 'S/N', 'Modules', 'Status', 'Last Cal', 'Next Cal', 'Priority', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-white/80 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-gray-400">No equipment found</td></tr>
                ) : filtered.map((e, i) => (
                  <tr key={e.id} className={`border-b border-gray-50 hover:bg-blue-50/30 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                    <td className="py-3 px-4 font-semibold text-gray-900">{e.equipment_name}</td>
                    <td className="py-3 px-4 text-gray-700">
                      <div>{e.customer_name}</div>
                      <div className="text-xs text-gray-400">{e.customer_state}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-600">{e.serial_number || '—'}</td>
                    <td className="py-3 px-4 text-gray-600 text-xs max-w-36 truncate">{e.modules || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{e.status}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(e.last_cal)}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(e.next_cal)}</td>
                    <td className="py-3 px-4"><PriorityBadge nextCal={e.next_cal} /></td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button onClick={() => setShowCal({ equipmentId: e.id, customerId: e.customer_id })}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50">
                          Cal
                        </button>
                        <button onClick={() => setDeleteId(e.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50">
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCal && (
        <RecordCalibrationModal
          onClose={() => setShowCal(null)}
          onSave={handleSaveCal}
          initialEquipmentId={showCal.equipmentId}
          initialCustomerId={showCal.customerId}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="font-bold text-gray-900 mb-2">Delete Equipment?</h3>
            <p className="text-sm text-gray-500 mb-4">All calibration records for this equipment will also be deleted.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
