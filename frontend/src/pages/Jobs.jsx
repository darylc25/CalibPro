import React, { useEffect, useState, useMemo } from 'react';
import { api, formatDate } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDealers } from '../context/DealerContext.jsx';
import RecordCalibrationModal from '../components/RecordCalibrationModal.jsx';
import { useToast } from '../components/Toast.jsx';

const SERVICE_TYPES = ['All', 'Calibration', 'Maintenance', 'Repair', 'Add-on Modules', 'Installation', 'Inspection'];
const STATUS_OPTS   = ['All', 'Completed', 'Pending', 'In Progress', 'Failed'];
const COUNTRIES     = ['All', 'Malaysia', 'Indonesia', 'Vietnam', 'Philippines', 'Thailand', 'Myanmar', 'Cambodia', 'Laos', 'Brunei', 'Timor-Leste', 'Hong Kong', 'Others'];

function typeBadge(type) {
  const map = {
    Calibration:     'bg-blue-100 text-blue-700',
    Maintenance:     'bg-purple-100 text-purple-700',
    Repair:          'bg-orange-100 text-orange-700',
    'Add-on Modules':'bg-pink-100 text-pink-700',
    Installation:    'bg-teal-100 text-teal-700',
    Inspection:      'bg-indigo-100 text-indigo-700',
  };
  return map[type] || 'bg-gray-100 text-gray-600';
}

function statusBadge(s) {
  const map = {
    Completed:   'bg-green-100 text-green-700',
    Pending:     'bg-amber-100 text-amber-700',
    'In Progress':'bg-blue-100 text-blue-700',
    Failed:      'bg-red-100 text-red-700',
  };
  return map[s] || 'bg-gray-100 text-gray-600';
}

export default function Jobs() {
  const { isEditor } = useAuth();
  const { showDealers } = useDealers();
  const toast = useToast();

  const [records, setRecords]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editRecord, setEditRecord]   = useState(null);
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]     = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('All');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [newJobType, setNewJobType]     = useState('Calibration');

  function load() {
    setLoading(true);
    api.getCalibrations()
      .then(data => setRecords(data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(r => {
      if (!showDealers && r.customer_type === 'Dealer') return false;
      const matchSearch = !search ||
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.equipment_name || '').toLowerCase().includes(q) ||
        (r.serial_number || '').toLowerCase().includes(q) ||
        (r.performed_by || '').toLowerCase().includes(q) ||
        (r.job_sheet_number || '').toLowerCase().includes(q) ||
        (r.brand || '').toLowerCase().includes(q);
      const matchType    = typeFilter === 'All' || r.service_type === typeFilter;
      const matchStatus  = statusFilter === 'All' || r.cal_report_status === statusFilter;
      const matchCountry = countryFilter === 'All' || r.country === countryFilter;
      const matchFrom    = !dateFrom || r.calibration_date >= dateFrom;
      const matchTo      = !dateTo   || r.calibration_date <= dateTo;
      return matchSearch && matchType && matchStatus && matchCountry && matchFrom && matchTo;
    });
  }, [records, search, typeFilter, statusFilter, dateFrom, dateTo, showDealers]);

  // Group by month for display
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(r => {
      const ym = r.calibration_date ? r.calibration_date.slice(0, 7) : 'Unknown';
      if (!groups[ym]) groups[ym] = [];
      groups[ym].push(r);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  function monthLabel(ym) {
    if (ym === 'Unknown') return 'Unknown Date';
    const [y, m] = ym.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    return d.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
  }

  async function handleSave(calForm, recordId) {
    try {
      if (recordId) {
        await api.updateCalibration(recordId, calForm);
        toast('Job updated');
        setEditRecord(null);
      } else {
        await api.createCalibration(calForm);
        toast('Job logged successfully');
        setShowModal(false);
      }
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  const stats = useMemo(() => ({
    total: records.length,
    thisMonth: records.filter(r => r.calibration_date?.startsWith(new Date().toISOString().slice(0, 7))).length,
    adhoc: records.filter(r => r.service_type && r.service_type !== 'Calibration').length,
    pending: records.filter(r => r.cal_report_status === 'Pending' || r.cal_report_status === 'In Progress').length,
  }), [records]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Log and track calibration &amp; ad-hoc service jobs</p>
        </div>
        {isEditor && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setNewJobType('Calibration'); setShowModal(true); }}
              className="px-4 py-2.5 text-sm font-medium text-white rounded-lg hover:opacity-90 flex items-center gap-2"
              style={{ background: '#1A4B8C' }}>
              + New Calibration Job
            </button>
            <button
              onClick={() => { setNewJobType('Maintenance'); setShowModal(true); }}
              className="px-4 py-2.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
              🔧 Ad-hoc Job
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Jobs', value: stats.total, icon: '📋', color: 'border-blue-200' },
          { label: 'This Month', value: stats.thisMonth, icon: '📅', color: 'border-green-200' },
          { label: 'Ad-hoc Jobs', value: stats.adhoc, icon: '🔧', color: 'border-purple-200' },
          { label: 'Pending / In Progress', value: stats.pending, icon: '⏳', color: 'border-amber-200' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className={`bg-white rounded-xl border ${color} border-l-4 p-4 shadow-sm`}>
            <div className="text-xl mb-1">{icon}</div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <input
            placeholder="Search customer, equipment, S/N, technician, job sheet…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2">
            {SERVICE_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2">
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
          </select>
          <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2">
            {COUNTRIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Countries' : c}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            title="From date"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            title="To date"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
          {(search || typeFilter !== 'All' || statusFilter !== 'All' || countryFilter !== 'All' || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(''); setTypeFilter('All'); setStatusFilter('All'); setCountryFilter('All'); setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Showing <b>{filtered.length}</b> of {records.length} jobs
        </p>
      </div>

      {/* Job list grouped by month */}
      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading jobs…</div>
      ) : grouped.length === 0 ? (
        <div className="py-12 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium text-gray-600">No jobs found</p>
          <p className="text-sm mt-1">
            {isEditor ? 'Click "+ New Calibration Job" or "🔧 Ad-hoc Job" to log the first job.' : 'No matching records.'}
          </p>
        </div>
      ) : grouped.map(([ym, recs]) => (
        <div key={ym} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between"
            style={{ background: '#f8fafc' }}>
            <h3 className="text-sm font-bold text-gray-700">{monthLabel(ym)}</h3>
            <span className="text-xs text-gray-400">{recs.length} job{recs.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {recs.map(r => (
              <div key={r.id} className="px-5 py-3.5 hover:bg-gray-50/60 flex items-start gap-4">
                {/* Date */}
                <div className="w-14 flex-shrink-0 text-center">
                  <p className="text-xs font-bold text-gray-400 uppercase">
                    {r.calibration_date ? new Date(r.calibration_date + 'T00:00:00').toLocaleDateString('en-MY', { month: 'short' }) : '—'}
                  </p>
                  <p className="text-xl font-bold text-gray-800 leading-none">
                    {r.calibration_date ? r.calibration_date.slice(8) : '—'}
                  </p>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge(r.service_type)}`}>
                      {r.service_type || 'Calibration'}
                    </span>
                    {r.cal_report_status && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(r.cal_report_status)}`}>
                        {r.cal_report_status}
                      </span>
                    )}
                    {r.job_sheet_number && (
                      <span className="text-xs text-gray-400 font-mono">JS# {r.job_sheet_number}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.customer_name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {r.equipment_name}
                    {r.serial_number ? ` · S/N ${r.serial_number}` : ''}
                    {r.modules ? ` · ${r.modules}` : ''}
                    {r.state ? ` · ${r.state}` : ''}
                  </p>
                  {(r.performed_by || r.next_calibration_date) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.performed_by && <span>👷 {r.performed_by}</span>}
                      {r.performed_by && r.next_calibration_date && <span className="mx-1.5">·</span>}
                      {r.next_calibration_date && <span>Next cal: {formatDate(r.next_calibration_date)}</span>}
                    </p>
                  )}
                  {r.notes && <p className="text-xs text-gray-400 mt-0.5 italic truncate">📝 {r.notes}</p>}
                </div>

                {/* Fee + actions */}
                <div className="flex-shrink-0 text-right flex flex-col items-end gap-2">
                  {r.fee != null && r.fee !== '' && (
                    <p className="text-sm font-bold text-gray-800">
                      MYR {parseFloat(r.fee).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  {isEditor && (
                    <button onClick={() => setEditRecord(r)}
                      className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 border border-gray-200 rounded hover:bg-gray-100">
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modals */}
      {showModal && (
        <RecordCalibrationModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          initialServiceType={newJobType}
        />
      )}
      {editRecord && (
        <RecordCalibrationModal
          onClose={() => setEditRecord(null)}
          onSave={handleSave}
          record={editRecord}
        />
      )}
    </div>
  );
}
