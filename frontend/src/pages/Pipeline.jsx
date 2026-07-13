import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatDate } from '../api/index.js';
import PriorityBadge from '../components/PriorityBadge.jsx';

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 border-blue-200 text-blue-800',
    green:  'bg-green-50 border-green-200 text-green-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    red:    'bg-red-50 border-red-200 text-red-800',
    gray:   'bg-gray-50 border-gray-200 text-gray-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

function warrantyStatus(endDate) {
  if (!endDate) return null;
  const today = new Date().toISOString().split('T')[0];
  const curYear = String(new Date().getFullYear());
  if (endDate < today) return 'expired';
  if (endDate.startsWith(curYear)) return 'expiring';
  return 'active';
}

const WARRANTY_LABELS = {
  active:   { label: 'In Warranty', cls: 'bg-green-100 text-green-700' },
  expiring: { label: 'Expiring This Year', cls: 'bg-orange-100 text-orange-700' },
  expired:  { label: 'Expired', cls: 'bg-gray-100 text-gray-500' },
};

export default function Pipeline() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [warrantyFilter, setWarrantyFilter] = useState('All');

  useEffect(() => {
    api.getPipelineStats().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-sm text-gray-400">Loading…</div>;
  if (!data || data.dealers.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-400">
        No dealer accounts found. Tag a customer as "Dealer" to track them here.
      </div>
    );
  }

  const { summary, dealers, equipmentList, monthlyTrend } = data;
  const curYear = String(new Date().getFullYear());

  const filteredEquipment = equipmentList.filter(e => {
    const ws = warrantyStatus(e.end_of_warranty);
    const matchWarranty = warrantyFilter === 'All' || ws === warrantyFilter.toLowerCase().replace(' ', '_') || warrantyFilter === ws;
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (e.customer_name || '').toLowerCase().includes(q) ||
      (e.equipment_name || '').toLowerCase().includes(q) ||
      (e.serial_number || '').toLowerCase().includes(q) ||
      (e.model || '').toLowerCase().includes(q);
    return matchWarranty && matchSearch;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dealer Pipeline</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Equipment managed by dealers — future direct calibration revenue when customers convert
        </p>
      </div>

      {/* Dealer cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dealers.map(d => (
          <div key={d.id}
            onClick={() => navigate(`/customers/${d.id}`)}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{d.name}</h3>
                <p className="text-xs text-amber-600 font-medium mt-0.5">Dealer</p>
              </div>
              <span className="text-gray-300 text-sm">›</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{d.equipment}</p>
                <p className="text-xs text-gray-400">Equipment</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{d.calThisYear}</p>
                <p className="text-xs text-gray-400">Jobs {curYear}</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-green-700">{d.warrantyActive}</p>
                <p className="text-xs text-gray-400">In Warranty</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Equipment" value={summary.totalEquipment} sub="across all dealers" color="blue" />
        <StatCard label={`Calibrations ${curYear}`} value={summary.calThisYear} sub={`vs ${summary.calLastYear} last year`} color="blue" />
        <StatCard label="Under Warranty" value={summary.warrantyActive} sub="FOC calibrations" color="green" />
        <StatCard label="Expiring This Year" value={summary.warrantyExpiringThisYear} sub="conversion opportunities" color="orange" />
      </div>

      {/* Insight banner */}
      {summary.warrantyExpiredRecent > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">💡</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {summary.warrantyExpiredRecent} instruments had warranties expire in the last 12 months
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              These are your highest-priority conversion targets — customers are now paying out-of-pocket for calibration and may be open to switching service providers.
            </p>
          </div>
        </div>
      )}

      {/* Equipment list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">
            All Dealer Equipment
            <span className="ml-2 text-sm font-normal text-gray-400">({filteredEquipment.length} shown)</span>
          </h2>
          <div className="flex items-center gap-2">
            <input
              placeholder="Search equipment, customer, S/N…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
            <select value={warrantyFilter} onChange={e => setWarrantyFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="All">All Warranty</option>
              <option value="active">In Warranty</option>
              <option value="expiring">Expiring This Year</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                {['Customer', 'Equipment', 'Model', 'S/N', 'Warranty Status', 'Warranty Expiry', 'Last Cal', 'Next Cal', 'Priority'].map(h => (
                  <th key={h} className="text-left py-2 pr-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEquipment.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-gray-400">No equipment found</td></tr>
              ) : filteredEquipment.map(e => {
                const ws = warrantyStatus(e.end_of_warranty);
                const wl = ws ? WARRANTY_LABELS[ws] : null;
                return (
                  <tr key={e.id}
                    onClick={() => navigate(`/customers/${e.customer_id}`)}
                    className="border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer">
                    <td className="py-2 pr-3 font-medium text-gray-900">
                      <div>{e.customer_name}</div>
                      <div className="text-xs text-gray-400">{e.country}{e.state ? ` · ${e.state}` : ''}</div>
                    </td>
                    <td className="py-2 pr-3 text-gray-700">{e.equipment_name}</td>
                    <td className="py-2 pr-3 text-gray-500 text-xs">{e.model || '—'}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-gray-500">{e.serial_number || '—'}</td>
                    <td className="py-2 pr-3">
                      {wl ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${wl.cls}`}>
                          {wl.label}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 text-xs">{formatDate(e.end_of_warranty)}</td>
                    <td className="py-2 pr-3 text-gray-600 text-xs">{formatDate(e.last_cal)}</td>
                    <td className="py-2 pr-3 text-gray-600 text-xs">{formatDate(e.next_cal)}</td>
                    <td className="py-2 pr-3"><PriorityBadge nextCal={e.next_cal} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
