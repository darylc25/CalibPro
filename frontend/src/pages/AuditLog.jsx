import React, { useEffect, useState } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

const TABLE_LABELS = {
  customers: 'Customer',
  equipment: 'Equipment',
  calibration_records: 'Calibration',
  staff: 'Staff',
};

const ACTION_STYLES = {
  CREATE: { bg: 'bg-green-100', text: 'text-green-700', label: 'Created' },
  UPDATE: { bg: 'bg-blue-100',  text: 'text-blue-700',  label: 'Edited'  },
  DELETE: { bg: 'bg-red-100',   text: 'text-red-700',   label: 'Deleted' },
};

function formatDiff(changesJson) {
  try {
    const changes = JSON.parse(changesJson || '{}');
    const keys = Object.keys(changes);
    if (keys.length === 0) return null;
    return keys.map(k => {
      const c = changes[k];
      if (typeof c === 'object' && 'from' in c) {
        return (
          <div key={k} className="flex items-start gap-1 text-xs">
            <span className="text-gray-500 font-medium min-w-[120px] shrink-0">{k}:</span>
            <span className="text-red-500 line-through">{String(c.from ?? '—')}</span>
            <span className="text-gray-400 mx-0.5">→</span>
            <span className="text-green-600">{String(c.to ?? '—')}</span>
          </div>
        );
      }
      return <div key={k} className="text-xs text-gray-600"><span className="font-medium">{k}:</span> {String(c)}</div>;
    });
  } catch { return null; }
}

export default function AuditLog() {
  const { canAudit } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ table: '', user: '' });
  const [expanded, setExpanded] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (filter.table) params.set('table', filter.table);
      if (filter.user)  params.set('user',  filter.user);
      const data = await api.getAuditLogs(params.toString());
      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (canAudit) load(); }, [filter, canAudit]);

  if (!canAudit) return (
    <div className="p-8 text-center">
      <p className="text-4xl mb-3">🔒</p>
      <p className="font-semibold text-gray-700">Access Restricted</p>
      <p className="text-sm text-gray-400 mt-1">You don't have permission to view the audit log.</p>
    </div>
  );

  const users = [...new Set(logs.map(l => l.username))];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">All changes made to records — {total} total entries</p>
        </div>
        <button onClick={load} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">↻ Refresh</button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filter.table} onChange={e => setFilter(f => ({ ...f, table: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All sections</option>
          {Object.entries(TABLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filter.user} onChange={e => setFilter(f => ({ ...f, user: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All users</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        {(filter.table || filter.user) && (
          <button onClick={() => setFilter({ table: '', user: '' })}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800">Clear filters</button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">No audit entries yet</p>
          <p className="text-sm mt-1">Changes to records will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: '#1A4B8C' }}>
              <tr>
                {['When', 'User', 'Action', 'Section', 'Record', 'Changes'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-white/80 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const style = ACTION_STYLES[log.action] || ACTION_STYLES.UPDATE;
                const isOpen = expanded === log.id;
                const diff = formatDiff(log.changes);
                return (
                  <React.Fragment key={log.id}>
                    <tr
                      className={`border-b border-gray-50 hover:bg-gray-50 ${diff ? 'cursor-pointer' : ''}`}
                      onClick={() => diff && setExpanded(isOpen ? null : log.id)}
                    >
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(log.created_at).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: '#1A4B8C' }}>
                            {(log.user_name || log.username).charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{log.user_name || log.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{TABLE_LABELS[log.table_name] || log.table_name}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium max-w-[200px] truncate">{log.record_label}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {diff ? (
                          <span className="flex items-center gap-1 text-blue-600 font-medium">
                            {isOpen ? '▲' : '▼'} {Object.keys(JSON.parse(log.changes || '{}')).length} field{Object.keys(JSON.parse(log.changes || '{}')).length !== 1 ? 's' : ''}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                    {isOpen && diff && (
                      <tr className="bg-blue-50 border-b border-blue-100">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="space-y-1">{diff}</div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
