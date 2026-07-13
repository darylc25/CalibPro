import React, { useEffect, useState, useCallback } from 'react';
import { api, formatDate, downloadBlob } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import AddContractModal from '../components/AddContractModal.jsx';

const STATUS_BADGE = {
  active:     { label: 'Active',      cls: 'bg-green-100 text-green-700' },
  expired:    { label: 'Expired',     cls: 'bg-gray-100 text-gray-500' },
  terminated: { label: 'Terminated',  cls: 'bg-red-100 text-red-600' },
};

function fmtMYR(n) {
  if (n == null) return '—';
  return 'RM ' + Number(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Contracts() {
  const { isAdmin, isEditor } = useAuth();
  const toast = useToast();

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('All');
  const [showAdd, setShowAdd]     = useState(false);
  const [downloading, setDL]      = useState(null);
  const [updating, setUpdating]   = useState(null);
  const [validateNum, setValidateNum] = useState('');
  const [validateResult, setValidateResult] = useState(null);
  const [validating, setValidating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getContracts().then(setContracts).catch(() => toast('Failed to load contracts', 'error')).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data) {
    try {
      const created = await api.createContract(data);
      toast(`Contract ${created.contract_number} created`);
      setShowAdd(false);
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function handleDownload(c) {
    setDL(c.id);
    try {
      const blob = await api.downloadContract(c.id);
      downloadBlob(blob, `Contract_${c.contract_number}.docx`);
      toast('Contract downloaded');
    } catch (e) { toast(e.message, 'error'); }
    finally { setDL(null); }
  }

  async function handleStatusUpdate(c, status) {
    setUpdating(c.id);
    try {
      await api.updateContractStatus(c.id, status);
      toast(`Contract ${c.contract_number} marked as ${status}`);
      load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setUpdating(null); }
  }

  async function handleValidate() {
    if (!validateNum.trim()) return;
    setValidating(true);
    setValidateResult(null);
    try {
      const r = await api.validateContract(validateNum.trim());
      setValidateResult(r);
    } catch (e) { toast(e.message, 'error'); }
    finally { setValidating(false); }
  }

  const filtered = contracts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      c.contract_number.toLowerCase().includes(q) ||
      c.customer_name.toLowerCase().includes(q) ||
      (c.equipment_model || '').toLowerCase().includes(q) ||
      (c.serial_number || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'All' || c.status === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const totalActive  = contracts.filter(c => c.status === 'active').length;
  const totalActiveValue = contracts.filter(c => c.status === 'active').reduce((s, c) => s + Number(c.total_value || 0), 0);
  const curYear = new Date().getFullYear();
  const thisYear = contracts.filter(c => c.contract_start_year <= curYear && c.contract_end_year >= curYear).length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Contracts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Non-comprehensive maintenance service contracts — 15% consumables discount for active holders</p>
        </div>
        {isEditor && (
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 flex-shrink-0"
            style={{ background: '#1A4B8C' }}>
            + New Contract
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium mb-1">Active Contracts</p>
          <p className="text-2xl font-bold text-green-700">{totalActive}</p>
          <p className="text-xs text-gray-400 mt-0.5">currently in force</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium mb-1">Active in {curYear}</p>
          <p className="text-2xl font-bold text-blue-700">{thisYear}</p>
          <p className="text-xs text-gray-400 mt-0.5">contracts covering this year</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium mb-1">Total Active Value</p>
          <p className="text-xl font-bold text-gray-900">{fmtMYR(totalActiveValue)}</p>
          <p className="text-xs text-gray-400 mt-0.5">sum of active contract totals</p>
        </div>
      </div>

      {/* Contract number validator */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-2">Validate Contract for Consumables Discount</p>
        <div className="flex gap-2">
          <input
            value={validateNum} onChange={e => { setValidateNum(e.target.value); setValidateResult(null); }}
            placeholder="Enter contract number e.g. DM-2031-0001"
            className="flex-1 border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            onKeyDown={e => e.key === 'Enter' && handleValidate()}
          />
          <button onClick={handleValidate} disabled={validating || !validateNum.trim()}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 flex-shrink-0"
            style={{ background: '#1A4B8C' }}>
            {validating ? 'Checking…' : 'Check'}
          </button>
        </div>
        {validateResult && (
          <div className={`mt-2 p-2.5 rounded-lg text-sm ${validateResult.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
            {validateResult.valid ? (
              <>✅ <strong>{validateNum}</strong> is active — 15% consumables discount applies.
                {validateResult.contract && <> Customer: {validateResult.contract.customer_name}</>}</>
            ) : (
              <>❌ <strong>{validateNum}</strong> — {validateResult.message}. Discount does not apply.</>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input placeholder="Search contract no, customer, equipment…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {['All', 'Active', 'Expired', 'Terminated'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#1A4B8C' }}>
                <tr>
                  {['Contract No', 'Customer', 'Equipment / S/N', 'Duration', 'Annual Fee', 'Total Value', 'Period', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-white/80 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-gray-400">
                    {contracts.length === 0 ? 'No contracts yet. Click "+ New Contract" to create one.' : 'No contracts match your search.'}
                  </td></tr>
                ) : filtered.map((c, i) => {
                  const badge = STATUS_BADGE[c.status] || STATUS_BADGE.active;
                  return (
                    <tr key={c.id} className={`border-b border-gray-50 hover:bg-blue-50/20 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                      <td className="py-2.5 px-3 font-mono text-xs font-semibold text-blue-800">{c.contract_number}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-900 max-w-[180px]">
                        <div className="truncate">{c.customer_name}</div>
                        {c.customer_state && <div className="text-xs text-gray-400">{c.customer_state}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-gray-700">
                        {Array.isArray(c.equipment_list) && c.equipment_list.length > 0 ? (
                          c.equipment_list.map((eq, i) => (
                            <div key={i} className={i > 0 ? 'mt-1 pt-1 border-t border-gray-100' : ''}>
                              <div className="font-medium text-sm">{eq.equipment_model}</div>
                              {eq.serial_number && <div className="font-mono text-xs text-gray-400">S/N: {eq.serial_number}</div>}
                            </div>
                          ))
                        ) : (
                          <>
                            <div>{c.equipment_model}</div>
                            {c.serial_number && <div className="font-mono text-xs text-gray-400">{c.serial_number}</div>}
                          </>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 text-center">{c.duration_years} yr{c.duration_years !== 1 ? 's' : ''}</td>
                      <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">{fmtMYR(c.annual_fee)}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-800 whitespace-nowrap">{fmtMYR(c.total_value)}</td>
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap text-xs">{c.contract_start_year} – {c.contract_end_year}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1 items-center">
                          <button onClick={() => handleDownload(c)} disabled={downloading === c.id}
                            title="Download DOCX"
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 whitespace-nowrap">
                            {downloading === c.id ? '⏳' : '⬇ DOCX'}
                          </button>
                          {isAdmin && c.status === 'active' && (
                            <button onClick={() => handleStatusUpdate(c, 'terminated')} disabled={updating === c.id}
                              className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 whitespace-nowrap">
                              Terminate
                            </button>
                          )}
                          {isAdmin && c.status === 'terminated' && (
                            <button onClick={() => handleStatusUpdate(c, 'active')} disabled={updating === c.id}
                              className="text-xs text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 whitespace-nowrap">
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 text-right">{filtered.length} contract{filtered.length !== 1 ? 's' : ''} shown</p>

      {showAdd && <AddContractModal onClose={() => setShowAdd(false)} onSave={handleSave} />}
    </div>
  );
}
