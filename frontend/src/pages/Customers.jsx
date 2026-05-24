import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatDate } from '../api/index.js';
import PriorityBadge from '../components/PriorityBadge.jsx';
import AddCustomerModal from '../components/AddCustomerModal.jsx';
import { useToast } from '../components/Toast.jsx';

const STATES = ['All', 'Kuala Lumpur', 'Selangor', 'Penang', 'Johor', 'Sabah', 'Sarawak', 'Perak', 'Pahang', 'Terengganu', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan'];

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  function load() {
    setLoading(true);
    api.getCustomers().then(setCustomers).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_person || '').toLowerCase().includes(search.toLowerCase());
    const matchState = stateFilter === 'All' || c.state === stateFilter;
    return matchSearch && matchState;
  });

  async function handleSave(form) {
    try {
      await api.createCustomer(form);
      toast('Customer added successfully');
      setShowAdd(false);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteCustomer(id);
      toast('Customer deleted');
      setDeleteId(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">{customers.length} customers total</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 flex items-center gap-2"
          style={{ background: '#0D2847' }}>
          + Add Customer
        </button>
      </div>

      <div className="flex gap-3">
        <input
          placeholder="Search customers…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
        />
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
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
                  {['Customer Name', 'State', 'Contact', 'Equipment', 'Last Service', 'Next Due', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-white/80 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400 text-sm">No customers found</td></tr>
                ) : filtered.map((c, i) => (
                  <tr key={c.id} className={`border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}
                    onClick={() => navigate(`/customers/${c.id}`)}>
                    <td className="py-3 px-4 font-semibold text-gray-900">{c.name}</td>
                    <td className="py-3 px-4 text-gray-600">{c.state || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{c.contact_person || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{c.equipment_count}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(c.last_service)}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(c.next_due)}</td>
                    <td className="py-3 px-4"><PriorityBadge nextCal={c.next_due} /></td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setDeleteId(c.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <AddCustomerModal onClose={() => setShowAdd(false)} onSave={handleSave} />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="font-bold text-gray-900 mb-2">Delete Customer?</h3>
            <p className="text-sm text-gray-500 mb-4">This will also delete all equipment and calibration records for this customer. This action cannot be undone.</p>
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
