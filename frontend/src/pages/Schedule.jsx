import React, { useEffect, useState } from 'react';
import { api, formatDate, getPriority, downloadBlob, daysDiff } from '../api/index.js';
import PriorityBadge from '../components/PriorityBadge.jsx';
import RecordCalibrationModal from '../components/RecordCalibrationModal.jsx';
import CalendarView from '../components/CalendarView.jsx';
import { useToast } from '../components/Toast.jsx';

const STATES = ['All', 'Kuala Lumpur', 'Selangor', 'Penang', 'Johor', 'Sabah', 'Sarawak', 'Perak', 'Pahang', 'Terengganu', 'Kedah'];
const PRIORITY_FILTERS = ['All', 'Overdue', 'Due Soon', 'Scheduled'];

export default function Schedule() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [stateFilter, setStateFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showCal, setShowCal] = useState(null);
  const [editCal, setEditCal] = useState(null);
  const [view, setView] = useState('table');
  const toast = useToast();

  function load() {
    setLoading(true);
    api.getCalibrations().then(data => {
      const latest = Object.values(
        data.reduce((acc, r) => {
          if (!acc[r.equipment_id] || r.calibration_date > acc[r.equipment_id].calibration_date) {
            acc[r.equipment_id] = r;
          }
          return acc;
        }, {})
      ).sort((a, b) => (a.next_calibration_date || '').localeCompare(b.next_calibration_date || ''));
      setRecords(latest);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (r.customer_name || '').toLowerCase().includes(q) ||
      (r.equipment_name || '').toLowerCase().includes(q) ||
      (r.serial_number || '').toLowerCase().includes(q);
    const matchState = stateFilter === 'All' || r.state === stateFilter;
    const p = getPriority(r.next_calibration_date);
    const matchPriority = priorityFilter === 'All' ||
      (priorityFilter === 'Overdue' && p === 'overdue') ||
      (priorityFilter === 'Due Soon' && p === 'due_soon') ||
      (priorityFilter === 'Scheduled' && p === 'scheduled');
    return matchSearch && matchState && matchPriority;
  });

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.exportSchedule();
      downloadBlob(blob, `CalibrationSchedule_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast('Export downloaded');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleSaveCal(calForm, recordId) {
    try {
      if (recordId) {
        await api.updateCalibration(recordId, calForm);
        toast('Calibration record updated');
        setEditCal(null);
      } else {
        await api.createCalibration(calForm);
        toast('Calibration recorded');
        setShowCal(null);
      }
      load();
    } catch (e) { toast(e.message, 'error'); }
  }

  const overdueCount = records.filter(r => getPriority(r.next_calibration_date) === 'overdue').length;
  const dueCount = records.filter(r => getPriority(r.next_calibration_date) === 'due_soon').length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calibration Schedule</h1>
          <p className="text-sm text-gray-500">
            <span className="text-red-600 font-semibold">{overdueCount} overdue</span>
            {' · '}
            <span className="text-amber-600 font-semibold">{dueCount} due soon</span>
            {' · '}
            {records.length} total equipment
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setView('table')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${view === 'table' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              style={view === 'table' ? { background: '#0D2847' } : {}}>
              ☰ Table
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-2 text-sm font-medium transition-colors border-l border-gray-200 ${view === 'calendar' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              style={view === 'calendar' ? { background: '#0D2847' } : {}}>
              📅 Calendar
            </button>
          </div>
          <button
            onClick={() => setShowCal({})}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50">
            + Record Calibration
          </button>
          <button onClick={handleExport} disabled={exporting}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            style={{ background: '#0D2847' }}>
            {exporting ? '⏳' : '📤'} Export Excel
          </button>
        </div>
      </div>

      {view === 'calendar' && (
        <CalendarView records={records} />
      )}

      {view === 'table' && <>
      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search customer, equipment, S/N…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
        />
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
          {STATES.map(s => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
          {PRIORITY_FILTERS.map(p => <option key={p} value={p}>{p}</option>)}
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
                  {['Customer', 'State', 'Equipment', 'S/N', 'Module', 'Last Cal', 'Next Cal', 'Days', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-white/80 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} className="py-8 text-center text-gray-400">No records found</td></tr>
                ) : filtered.map((r, i) => {
                  const p = getPriority(r.next_calibration_date);
                  const rowBg = p === 'overdue' ? 'bg-red-50/60' : p === 'due_soon' ? 'bg-amber-50/60' : i % 2 === 0 ? '' : 'bg-gray-50/40';
                  const days = p === 'overdue' ? `${daysDiff(r.next_calibration_date)}d ago` :
                    p === 'due_soon' ? `${Math.abs(daysDiff(r.next_calibration_date))}d left` : '';
                  return (
                    <tr key={r.id} className={`border-b border-gray-50 hover:bg-blue-50/20 ${rowBg}`}>
                      <td className="py-2.5 px-3 font-medium text-gray-900">{r.customer_name}</td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs">{r.state}</td>
                      <td className="py-2.5 px-3 text-gray-700">{r.equipment_name}</td>
                      <td className="py-2.5 px-3 font-mono text-xs text-gray-500">{r.serial_number || '—'}</td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs max-w-32 truncate">{r.modules || '—'}</td>
                      <td className="py-2.5 px-3 text-gray-600">{formatDate(r.calibration_date)}</td>
                      <td className="py-2.5 px-3 text-gray-600 font-medium">{formatDate(r.next_calibration_date)}</td>
                      <td className={`py-2.5 px-3 text-xs font-semibold ${p === 'overdue' ? 'text-red-600' : p === 'due_soon' ? 'text-amber-600' : 'text-gray-400'}`}>
                        {days}
                      </td>
                      <td className="py-2.5 px-3"><PriorityBadge nextCal={r.next_calibration_date} /></td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditCal(r)}
                            className="text-xs text-gray-600 hover:text-gray-900 font-medium px-2 py-1 rounded hover:bg-gray-100 whitespace-nowrap border border-gray-200">
                            Edit
                          </button>
                          <button
                            onClick={() => setShowCal({ equipmentId: r.equipment_id, customerId: r.customer_id })}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 whitespace-nowrap">
                            + New Cal
                          </button>
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
      </>}

      {showCal && (
        <RecordCalibrationModal
          onClose={() => setShowCal(null)}
          onSave={handleSaveCal}
          initialEquipmentId={showCal.equipmentId}
          initialCustomerId={showCal.customerId}
        />
      )}

      {editCal && (
        <RecordCalibrationModal
          onClose={() => setEditCal(null)}
          onSave={handleSaveCal}
          record={editCal}
        />
      )}
    </div>
  );
}
