import { useAuth } from '../context/AuthContext.jsx';
import { useDealers } from '../context/DealerContext.jsx';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatDate } from '../api/index.js';
import PriorityBadge from '../components/PriorityBadge.jsx';
import AddCustomerModal from '../components/AddCustomerModal.jsx';
import RequestDeletionModal from '../components/RequestDeletionModal.jsx';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal.jsx';
import { useToast } from '../components/Toast.jsx';

const STATES = ['All', 'Kuala Lumpur', 'Selangor', 'Penang', 'Johor', 'Sabah', 'Sarawak', 'Perak', 'Pahang', 'Terengganu', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan'];
const COUNTRIES = ['All', 'Malaysia', 'Indonesia', 'Vietnam', 'Philippines', 'Thailand', 'Myanmar', 'Cambodia', 'Laos', 'Brunei', 'Timor-Leste', 'Hong Kong', 'Others'];

const COUNTRY_FLAG = {
  'Malaysia': '🇲🇾', 'Indonesia': '🇮🇩', 'Vietnam': '🇻🇳',
  'Philippines': '🇵🇭', 'Thailand': '🇹🇭', 'Myanmar': '🇲🇲',
  'Cambodia': '🇰🇭', 'Laos': '🇱🇦', 'Brunei': '🇧🇳',
  'Timor-Leste': '🇹🇱', 'Hong Kong': '🇭🇰', 'Others': '🌐',
};

const COUNTRY_CODE = {
  'Malaysia': 'MY', 'Indonesia': 'ID', 'Vietnam': 'VN',
  'Philippines': 'PH', 'Thailand': 'TH', 'Myanmar': 'MM',
  'Cambodia': 'KH', 'Laos': 'LA', 'Brunei': 'BN',
  'Timor-Leste': 'TL', 'Hong Kong': 'HK', 'Singapore': 'SG', 'Others': '??',
};

export default function Customers() {
  const { isAdmin, isEditor, canDelete } = useAuth();
  const { showDealers } = useDealers();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [deleteCustomer, setDeleteCustomer] = useState(null); // { id, name, step: 1|2 }
  const [requestDelete, setRequestDelete] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkStep, setBulkStep] = useState(0); // 0=off, 1=first confirm, 2=final confirm
  const navigate = useNavigate();
  const toast = useToast();

  function load() {
    setLoading(true);
    setSelected(new Set());
    api.getCustomers().then(setCustomers).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c => {
    // Global toggle hides dealers — but override if user explicitly filters to Dealer
    if (!showDealers && typeFilter !== 'Dealer' && c.customer_type === 'Dealer') return false;
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_person || '').toLowerCase().includes(search.toLowerCase());
    const matchState = stateFilter === 'All' || c.state === stateFilter;
    const matchCountry = countryFilter === 'All' || c.country === countryFilter;
    const matchType = typeFilter === 'All' || (c.customer_type || 'Direct') === typeFilter;
    return matchSearch && matchState && matchCountry && matchType;
  });

  const allFilteredIds = filtered.map(c => c.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(prev => { const next = new Set(prev); allFilteredIds.forEach(id => next.delete(id)); return next; });
    } else {
      setSelected(prev => new Set([...prev, ...allFilteredIds]));
    }
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    let done = 0;
    for (const id of ids) {
      try { await api.deleteCustomer(id); done++; } catch { /* skip */ }
    }
    toast(`Deleted ${done} customer${done !== 1 ? 's' : ''}`);
    setBulkStep(0);
    setSelected(new Set());
    load();
  }

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
      setDeleteCustomer(null);
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
          <p className="text-sm text-gray-500">{filtered.length} of {customers.length} customers{someSelected ? ` · ${selected.size} selected` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && someSelected && (
            <button onClick={() => setBulkStep(1)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center gap-2">
              🗑 Delete {selected.size} selected
            </button>
          )}
          {isEditor && (
            <button onClick={() => setShowAdd(true)}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 flex items-center gap-2"
              style={{ background: '#1A4B8C' }}>
              + Add Customer
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          placeholder="Search customers…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="All">All Types</option>
          <option value="Direct">🏢 Direct</option>
          <option value="Dealer">🎯 Dealer</option>
        </select>
        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {COUNTRIES.map(c => <option key={c} value={c}>{c === 'All' ? '🌍 All Countries' : `${COUNTRY_FLAG[c] || '🌐'} ${c}`}</option>)}
        </select>
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {STATES.map(s => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
        </select>
      </div>

      {/* Country summary chips */}
      <div className="flex gap-2 flex-wrap">
        {COUNTRIES.filter(c => c !== 'All').map(c => {
          const count = customers.filter(cu => cu.country === c).length;
          if (!count) return null;
          return (
            <button key={c} onClick={() => setCountryFilter(countryFilter === c ? 'All' : c)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${countryFilter === c ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}
              style={countryFilter === c ? { background: '#1A4B8C' } : {}}>
              {COUNTRY_FLAG[c]} {c} <span className="ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#1A4B8C' }}>
                <tr>
                  {canDelete && (
                    <th className="py-3 px-3 w-8">
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                        className="w-4 h-4 rounded accent-white cursor-pointer" />
                    </th>
                  )}
                  {['Customer Name', 'Country', 'State', 'Contact', 'Equipment', 'Last Service (DD-MM-YYYY)', 'Next Due (DD-MM-YYYY)', 'Status', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-white/80 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={canDelete ? 10 : 9} className="py-8 text-center text-gray-400 text-sm">No customers found</td></tr>
                ) : filtered.map((c, i) => (
                  <tr key={c.id}
                    className={`border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer ${i % 2 === 0 ? '' : 'bg-gray-50/40'} ${selected.has(c.id) ? 'bg-red-50/50' : ''}`}
                    onClick={() => navigate(`/customers/${c.id}`, { state: { ids: filtered.map(x => x.id) } })}>
                    {canDelete && (
                      <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                          className="w-4 h-4 rounded cursor-pointer accent-red-600" />
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{c.name}</div>
                      {c.customer_type === 'Dealer' && (
                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Dealer</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {c.country ? <span title={c.country}>{COUNTRY_FLAG[c.country] || '🌐'} {COUNTRY_CODE[c.country] || c.country}</span> : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{c.state || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{c.contact_person || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{c.equipment_count}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(c.last_service)}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(c.next_due)}</td>
                    <td className="py-3 px-4"><PriorityBadge nextCal={c.next_due} /></td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      {canDelete ? (
                        <button onClick={() => setDeleteCustomer({ id: c.id, name: c.name, step: 1 })}
                          title="Delete customer"
                          className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      ) : isEditor ? (
                        <button onClick={() => setRequestDelete({ id: c.id, name: c.name })}
                          title="Request deletion"
                          className="text-amber-500 hover:text-amber-700 p-1.5 rounded hover:bg-amber-50 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      ) : null}
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

      {requestDelete && (
        <RequestDeletionModal
          recordType="customer"
          recordId={requestDelete.id}
          recordLabel={requestDelete.name}
          onClose={() => setRequestDelete(null)}
        />
      )}

      {/* Individual customer delete */}
      <ConfirmDeleteModal
        step={deleteCustomer?.step}
        title="Delete Customer?"
        itemLabel={deleteCustomer?.name}
        warningText="This includes all their equipment and calibration records. Are you sure?"
        finalNote="Including all equipment and calibration history for this customer."
        onCancel={() => setDeleteCustomer(null)}
        onProceedToStep2={() => setDeleteCustomer(d => ({ ...d, step: 2 }))}
        onConfirmDelete={() => handleDelete(deleteCustomer.id)}
      />

      {/* Bulk customer delete */}
      <ConfirmDeleteModal
        step={bulkStep || undefined}
        title={`Delete ${selected.size} Customers?`}
        warningText={<>This will delete <strong>{selected.size} customers</strong> along with all their equipment and calibration records. Are you sure?</>}
        finalNote={<>This action <strong>cannot be undone</strong>. You are about to permanently delete <strong>{selected.size} customers</strong> and all associated equipment and calibration records.</>}
        confirmLabel="Yes, Delete All"
        finalLabel={`Permanently Delete ${selected.size}`}
        onCancel={() => setBulkStep(0)}
        onProceedToStep2={() => setBulkStep(2)}
        onConfirmDelete={handleBulkDelete}
      />
    </div>
  );
}
