import { useAuth } from '../context/AuthContext.jsx';
import { useDealers } from '../context/DealerContext.jsx';
import React, { useEffect, useState, useMemo } from 'react';
import { api, formatDate, getPriority, getWarrantyStatus, WARRANTY_BADGE } from '../api/index.js';
import PriorityBadge from '../components/PriorityBadge.jsx';
import RecordCalibrationModal from '../components/RecordCalibrationModal.jsx';
import { useToast } from '../components/Toast.jsx';

const STATUSES = ['All', 'Active', 'Inactive', 'Under Repair', 'Decommissioned'];
const WARRANTY_FILTERS = ['All', 'In Warranty', 'Expired', 'No Warranty'];
const STATES = ['All', 'Kuala Lumpur', 'Selangor', 'Penang', 'Johor', 'Sabah', 'Sarawak', 'Perak', 'Pahang', 'Terengganu', 'Kedah'];
const COUNTRIES = ['All', 'Malaysia', 'Indonesia', 'Vietnam', 'Philippines', 'Thailand', 'Myanmar', 'Cambodia', 'Laos', 'Brunei', 'Timor-Leste', 'Hong Kong', 'Others'];
const MONTHS = ['All Months','January','February','March','April','May','June','July','August','September','October','November','December'];
const PRIORITIES = ['All', 'Overdue', 'Due Soon', 'Scheduled', 'No Date'];
const BRANDS = ['All', 'Interacoustics', 'Amplivox', 'Maico', 'MedRx'];

export default function Equipment() {
  const { isAdmin, isEditor, canDelete } = useAuth();
  const { showDealers } = useDealers();
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [monthFilter, setMonthFilter] = useState('All Months');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [warrantyFilter, setWarrantyFilter] = useState('All');
  const [showCal, setShowCal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const toast = useToast();

  // Derive dynamic filter options from data
  const availableYears = useMemo(() => {
    const years = new Set();
    equipment.forEach(e => { if (e.next_cal) years.add(e.next_cal.slice(0, 4)); });
    return ['All', ...Array.from(years).sort()];
  }, [equipment]);


  const availableTypes = useMemo(() => {
    const types = new Set();
    equipment.forEach(e => {
      if (e.equipment_name && (brandFilter === 'All' || e.brand === brandFilter)) {
        types.add(e.equipment_name);
      }
    });
    return ['All', ...Array.from(types).sort()];
  }, [equipment, brandFilter]);

  function load() {
    setLoading(true);
    api.getEquipment().then(setEquipment).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = equipment.filter(e => {
    if (!showDealers && e.customer_type === 'Dealer') return false;
    const q = search.toLowerCase();
    const matchSearch = !search ||
      e.equipment_name.toLowerCase().includes(q) ||
      (e.serial_number || '').toLowerCase().includes(q) ||
      (e.customer_name || '').toLowerCase().includes(q) ||
      (e.modules || '').toLowerCase().includes(q) ||
      (e.brand || '').toLowerCase().includes(q);
    const matchType    = typeFilter === 'All' || e.equipment_name === typeFilter;
    const matchBrand   = brandFilter === 'All' || e.brand === brandFilter;
    const matchCountry = countryFilter === 'All' || e.customer_country === countryFilter;
    const matchStatus  = statusFilter === 'All' || e.status === statusFilter;
    const matchState   = stateFilter === 'All' || e.customer_state === stateFilter;
    const matchYear    = yearFilter === 'All' || (e.next_cal && e.next_cal.slice(0, 4) === yearFilter);
    const matchMonth   = monthFilter === 'All Months' || (e.next_cal && parseInt(e.next_cal.slice(5, 7)) === MONTHS.indexOf(monthFilter));
    let matchPriority = true;
    if (priorityFilter !== 'All') {
      const p = getPriority(e.next_cal);
      if (priorityFilter === 'Overdue') matchPriority = p === 'overdue';
      else if (priorityFilter === 'Due Soon') matchPriority = p === 'due_soon';
      else if (priorityFilter === 'Scheduled') matchPriority = p === 'scheduled';
      else if (priorityFilter === 'No Date') matchPriority = !e.next_cal;
    }
    let matchWarranty = true;
    if (warrantyFilter !== 'All') {
      const ws = getWarrantyStatus(e.end_of_warranty);
      if (warrantyFilter === 'In Warranty') matchWarranty = ws === 'active';
      else if (warrantyFilter === 'Expired') matchWarranty = ws === 'expired';
      else if (warrantyFilter === 'No Warranty') matchWarranty = !ws;
    }
    return matchSearch && matchType && matchBrand && matchCountry && matchStatus && matchState && matchYear && matchMonth && matchPriority && matchWarranty;
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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        {/* Row 1: search + brand + type + country */}
        <div className="flex flex-wrap gap-3">
          <input
            placeholder="Search equipment, S/N, customer, brand…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setTypeFilter('All'); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {BRANDS.map(b => <option key={b} value={b}>{b === 'All' ? 'All Brands' : b}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {availableTypes.map(t => <option key={t} value={t}>{t === 'All' ? 'All Equipment' : t}</option>)}
          </select>
          <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {COUNTRIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Countries' : c}</option>)}
          </select>
        </div>
        {/* Row 2: status + state + date + priority */}
        <div className="flex flex-wrap gap-3 items-center">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
          </select>
          <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {STATES.map(s => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
          </select>
          <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Next Cal:</span>
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {availableYears.map(y => <option key={y} value={y}>{y === 'All' ? 'All Years' : y}</option>)}
          </select>
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {PRIORITIES.map(p => <option key={p} value={p}>{p === 'All' ? 'All Priorities' : p}</option>)}
          </select>
          <select value={warrantyFilter} onChange={e => setWarrantyFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {WARRANTY_FILTERS.map(w => <option key={w} value={w}>{w === 'All' ? 'All Warranty' : w}</option>)}
          </select>
          {(search || brandFilter !== 'All' || typeFilter !== 'All' || countryFilter !== 'All' || statusFilter !== 'All' || stateFilter !== 'All' || yearFilter !== 'All' || monthFilter !== 'All Months' || priorityFilter !== 'All' || warrantyFilter !== 'All') && (
            <button onClick={() => { setSearch(''); setBrandFilter('All'); setTypeFilter('All'); setCountryFilter('All'); setStatusFilter('All'); setStateFilter('All'); setYearFilter('All'); setMonthFilter('All Months'); setPriorityFilter('All'); setWarrantyFilter('All'); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
              Clear filters
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            Showing <b>{filtered.length}</b> of {equipment.length} units
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#1A4B8C' }}>
                <tr>
                  {['Equipment', 'Customer', 'S/N', 'Modules', 'Status', 'Last Cal (DD-MM-YYYY)', 'Next Cal (DD-MM-YYYY)', 'Priority', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-white/80 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-gray-400">No equipment found</td></tr>
                ) : filtered.map((e, i) => (
                  <tr key={e.id} className={`border-b border-gray-50 hover:bg-blue-50/30 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{e.equipment_name}</div>
                      {e.brand && <div className="text-xs text-gray-400">{e.brand}</div>}
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      <div>{e.customer_name}</div>
                      <div className="text-xs text-gray-400">{e.customer_country ? `${e.customer_country} · ` : ''}{e.customer_state}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-600">{e.serial_number || '—'}</td>
                    <td className="py-3 px-4 text-gray-600 text-xs max-w-36 truncate">{e.modules || '—'}</td>
                    <td className="py-3 px-4">
                      {(() => {
                        const s = (e.status || '').toLowerCase();
                        const isWarranty = s.includes('warranty') && !s.includes('out of warranty');
                        const isNoWarranty = s.includes('out of warranty');
                        const isContract = (s.includes('service contract') || s.includes('contract')) && !s.includes('out of contract');
                        const isActive = e.status === 'Active';
                        return (
                          <div className="flex flex-col gap-1">
                            {isWarranty && <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">Warranty</span>}
                            {isNoWarranty && <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600 whitespace-nowrap">No Warranty</span>}
                            {(isContract || isActive) && <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">Active</span>}
                            {!isWarranty && !isNoWarranty && !isContract && !isActive && <span className="text-gray-300 text-xs">—</span>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(e.last_cal)}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(e.next_cal)}</td>
                    <td className="py-3 px-4"><PriorityBadge nextCal={e.next_cal} /></td>
                    {(isEditor || canDelete) && (
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          {isEditor && (
                            <button onClick={() => setShowCal({ equipmentId: e.id, customerId: e.customer_id })}
                              title="Log Job"
                              className="text-blue-500 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                              </svg>
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => setDeleteId(e.id)}
                              title="Delete equipment"
                              className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
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
