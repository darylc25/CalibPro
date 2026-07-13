import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { api, formatDate, daysDiff } from '../api/index.js';
import MetricCard from '../components/MetricCard.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';
import { useDealers } from '../context/DealerContext.jsx';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const TYPE_COLORS = [
  { bg: '#DC2626', light: '#FEE2E2', text: '#991B1B', label: '1st' },
  { bg: '#D97706', light: '#FEF3C7', text: '#92400E', label: '2nd' },
  { bg: '#2563EB', light: '#DBEAFE', text: '#1E40AF', label: '3rd' },
  { bg: '#16A34A', light: '#DCFCE7', text: '#15803D', label: '4th' },
  { bg: '#7C3AED', light: '#EDE9FE', text: '#5B21B6', label: '5th' },
  { bg: '#0891B2', light: '#CFFAFE', text: '#0E7490', label: '6th' },
  { bg: '#DB2777', light: '#FCE7F3', text: '#9D174D', label: '7th' },
  { bg: '#EA580C', light: '#FFEDD5', text: '#C2410C', label: '8th' },
  { bg: '#4B5563', light: '#F3F4F6', text: '#374151', label: '9th+' },
];

const CODE_META = {
  CAL_A:  { label: 'CAL_A',  desc: 'Customer Calibration',      color: '#1A4B8C', light: '#DBEAFE' },
  CAL_B:  { label: 'CAL_B',  desc: 'Internal Calibration',      color: '#2563EB', light: '#EFF6FF' },
  SERV_A: { label: 'SERV_A', desc: 'Customer Service & Repair', color: '#D97706', light: '#FEF3C7' },
  SERV_B: { label: 'SERV_B', desc: 'Internal Service & Repair', color: '#DC2626', light: '#FEE2E2' },
};

function DrillModal({ title, subtitle, onClose, loading, children, onExportCsv }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {onExportCsv && (
              <button onClick={onExportCsv}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                ⬇ Export CSV
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light leading-none">×</button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
          ) : children}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { showDealers } = useDealers();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Month bar chart modal
  const [monthModal, setMonthModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTab, setModalTab] = useState('renewed');

  // Job code modal
  const [jobModal, setJobModal] = useState(null);
  const [jobModalLoading, setJobModalLoading] = useState(false);

  // Equipment type modal
  const [eqTypeModal, setEqTypeModal] = useState(null);
  const [eqTypeLoading, setEqTypeLoading] = useState(false);

  // Generic list modal (overdue, due soon, recent, full lists)
  const [listModal, setListModal] = useState(null); // { title, subtitle, items, type }

  useEffect(() => {
    setLoading(true);
    api.getDashboardStats(!showDealers).then(setStats).finally(() => setLoading(false));
  }, [showDealers]);

  async function handleBarClick(payload) {
    const label = payload?.activeLabel;
    if (!label) return;
    const idx = MONTH_NAMES.indexOf(label);
    if (idx === -1) return;
    const key = String(idx + 1).padStart(2, '0');
    setModalLoading(true);
    setMonthModal({ monthKey: key, monthName: label, data: null });
    setModalTab('renewed');
    const data = await api.getMonthDetail(key).catch(() => null);
    setMonthModal({ monthKey: key, monthName: label, data });
    setModalLoading(false);
  }

  async function handleJobCodeClick(code, label) {
    setJobModalLoading(true);
    setJobModal({ code, label, data: null });
    const data = await api.getJobCodeCustomers(code).catch(() => null);
    setJobModal({ code, label, data });
    setJobModalLoading(false);
  }

  async function handleEqTypeClick(name) {
    setEqTypeLoading(true);
    setEqTypeModal({ name, data: null });
    const data = await api.getEquipmentTypeDetail(name).catch(() => null);
    setEqTypeModal({ name, data });
    setEqTypeLoading(false);
  }

  function exportCsv(rows, columns, filename) {
    const csv = [columns.map(c => c.header), ...rows.map(r => columns.map(c => {
      const v = c.value(r);
      return typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v ?? '';
    }))].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm">Loading dashboard…</div>
    </div>
  );
  if (!stats) return null;

  const curYear  = new Date().getFullYear();
  const prevYear = curYear - 1;

  const renewedMap  = Object.fromEntries((stats.monthlyRenewed  || []).map(m => [m.month, m.count]));
  const lostMap     = Object.fromEntries((stats.monthlyLost     || []).map(m => [m.month, m.count]));
  const newMap      = Object.fromEntries((stats.monthlyNew      || []).map(m => [m.month, m.count]));
  const warrantyMap = Object.fromEntries((stats.monthlyWarranty || []).map(m => [String(m.month).padStart(2,'0'), m.count]));
  const monthLabels = MONTH_NAMES.map((name, i) => {
    const key = String(i + 1).padStart(2, '0');
    return { month: name, key, renewed: renewedMap[key] || 0, lost: lostMap[key] || 0, newAcc: newMap[key] || 0, warranty: warrantyMap[key] || 0 };
  });

  // YTD completed calibrations by month (current year)
  const completedMap = Object.fromEntries((stats.monthlyCompleted || []).map(m => [m.month, m.count]));
  const currentMonthNum = stats.currentMonthNum || new Date().getMonth() + 1;
  const ytdMonthLabels = MONTH_NAMES.map((name, i) => {
    const monthNum = i + 1;
    return {
      month: name,
      completed: completedMap[monthNum] || 0,
      isCurrent: monthNum === currentMonthNum,
      isFuture: monthNum > currentMonthNum,
    };
  });

  const codes = ['CAL_A','CAL_B','SERV_A','SERV_B'];
  const years = [...new Set((stats.jobCodeByYear || []).map(r => r.year))].sort();
  const yearData = years.map(y => {
    const row = { year: y };
    codes.forEach(c => {
      const found = (stats.jobCodeByYear || []).find(r => r.year === y && r.code === c);
      row[c] = found ? found.count : 0;
    });
    return row;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Calibration overview — {new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Top metric cards — clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => navigate('/customers')} className="cursor-pointer">
          <MetricCard title="Total Customers" value={stats.totalCustomers} icon="🏥" color="blue" subtitle="Click to view all" />
        </div>
        <div onClick={() => navigate('/equipment')} className="cursor-pointer">
          <MetricCard title="Total Equipment" value={stats.totalEquipment} icon="🔧" color="blue" subtitle="Click to view all" />
        </div>
        <div
          onClick={() => setListModal({ title: `⚠️ Overdue (${stats.overdueList.length})`, subtitle: 'Equipment past calibration due date', items: stats.overdueList, type: 'overdue' })}
          className="cursor-pointer">
          <MetricCard title="Overdue" value={stats.overdue} icon="⚠️" color="red" subtitle="Click to view list" />
        </div>
        <div
          onClick={() => setListModal({ title: `🕐 Due This Month (${stats.dueSoonList.length})`, subtitle: 'Equipment due within 30 days', items: stats.dueSoonList, type: 'due_soon' })}
          className="cursor-pointer">
          <MetricCard title="Due This Month" value={stats.dueSoon} icon="🕐" color="amber" subtitle="Click to view list" />
        </div>
      </div>

      {/* Warranty status strip */}
      {(stats.warrantyActive > 0 || stats.warrantyExpiringThisYear > 0) && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-green-100 transition-colors"
            onClick={() => navigate('/equipment?warranty=active')}>
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-green-800">{stats.warrantyActive}</span>
            <span className="text-sm text-green-700">Equipment Under Warranty</span>
            <span className="text-xs text-green-500 ml-1">(FOC calibrations)</span>
          </div>
          {stats.warrantyExpiringThisYear > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-orange-100 transition-colors"
              onClick={() => navigate('/equipment?warranty=expiring')}>
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-orange-800">{stats.warrantyExpiringThisYear}</span>
              <span className="text-sm text-orange-700">Warranties Expiring This Year</span>
              <span className="text-xs text-orange-500 ml-1">(upcoming cal revenue)</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold px-3 py-2 rounded-lg border text-red-700 bg-red-50 border-red-200">🔴 Overdue ({stats.overdueList.length})</h3>
          </div>
          {stats.overdueList.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No overdue equipment</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {stats.overdueList.map(r => (
                <div key={r.id}
                  onClick={() => navigate(`/customers/${r.customer_id}`)}
                  className="flex items-center justify-between py-2 px-2 rounded-lg border-b border-gray-50 last:border-0 hover:bg-red-50 cursor-pointer transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.customer_name}</p>
                    <p className="text-xs text-gray-500">{r.equipment_name} · {r.serial_number || '—'}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs font-semibold text-red-600">{Math.round(r.days_overdue)}d overdue</p>
                    <p className="text-xs text-gray-400">{formatDate(r.next_calibration_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Due Soon panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold px-3 py-2 rounded-lg border text-amber-700 bg-amber-50 border-amber-200">🟡 Due Soon ({stats.dueSoonList.length})</h3>
          </div>
          {stats.dueSoonList.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Nothing due in the next 30 days</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {stats.dueSoonList.map(r => (
                <div key={r.id}
                  onClick={() => navigate(`/customers/${r.customer_id}`)}
                  className="flex items-center justify-between py-2 px-2 rounded-lg border-b border-gray-50 last:border-0 hover:bg-amber-50 cursor-pointer transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.customer_name}</p>
                    <p className="text-xs text-gray-500">{r.equipment_name} · {r.serial_number || '—'}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-xs font-semibold text-amber-600">{Math.round(r.days_until)}d left</p>
                    <p className="text-xs text-gray-400">{formatDate(r.next_calibration_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart scope indicator */}
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium
          ${!showDealers ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          <span className={`w-2 h-2 rounded-full ${!showDealers ? 'bg-blue-500' : 'bg-amber-400'}`} />
          {!showDealers ? 'Direct sales only — dealers excluded from charts' : 'All accounts included (dealers shown)'}
        </span>
        <span className="text-xs text-gray-400">Toggle in sidebar to switch view</span>
      </div>

      {/* YTD Calibration Status — current year */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Calibration Status — {curYear} (Year to Date)</h3>
            <p className="text-xs text-gray-400 mt-0.5">Completed calibrations by month · {MONTH_NAMES[currentMonthNum - 1]} highlighted as current month</p>
          </div>
          <div className="flex items-center gap-3">
            <div
              onClick={() => setListModal({
                title: `✅ Completed YTD ${curYear} (${(stats.ytdCompletedList || []).length})`,
                subtitle: `All calibrations completed in ${curYear}`,
                items: stats.ytdCompletedList || [], type: 'completed',
              })}
              className="text-center px-3 py-1.5 bg-green-50 rounded-lg border border-green-100 cursor-pointer hover:bg-green-100 transition-colors">
              <p className="text-lg font-bold text-green-700">{stats.ytdCompleted || 0}</p>
              <p className="text-xs text-green-600">Completed YTD</p>
            </div>
            <div
              onClick={() => setListModal({
                title: `✅ Done This Month — ${MONTH_NAMES[currentMonthNum - 1]} ${curYear} (${stats.currentMonthCompleted || 0})`,
                subtitle: 'Calibrations completed so far this month',
                items: (stats.ytdCompletedList || []).filter(r => Number(r.calibration_date?.slice(5,7)) === currentMonthNum),
                type: 'completed',
              })}
              className="text-center px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
              <p className="text-lg font-bold text-blue-700">{stats.currentMonthCompleted || 0}</p>
              <p className="text-xs text-blue-600">Done This Month</p>
            </div>
            <div
              onClick={() => setListModal({
                title: `🕐 Due This Month — ${MONTH_NAMES[currentMonthNum - 1]} ${curYear} (${(stats.currentMonthDueList || []).length})`,
                subtitle: 'Equipment scheduled for calibration this calendar month',
                items: stats.currentMonthDueList || [], type: 'due_soon',
              })}
              className="text-center px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors">
              <p className="text-lg font-bold text-amber-700">{stats.currentMonthDue || 0}</p>
              <p className="text-xs text-amber-600">Due This Month</p>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={ytdMonthLabels} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
            onClick={p => {
              if (!p?.activeLabel) return;
              const monthIdx = MONTH_NAMES.indexOf(p.activeLabel);
              if (monthIdx === -1) return;
              const monthNum = monthIdx + 1;
              const items = (stats.ytdCompletedList || []).filter(r => Number(r.calibration_date?.slice(5,7)) === monthNum);
              setListModal({
                title: `✅ ${p.activeLabel} ${curYear} — Completed (${items.length})`,
                subtitle: `Calibrations completed in ${p.activeLabel} ${curYear}`,
                items, type: 'completed',
              });
            }}
            style={{ cursor: 'pointer' }}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip formatter={(v) => [v, 'Completed']} />
            <Bar dataKey="completed" radius={[4,4,0,0]}>
              {ytdMonthLabels.map((entry, i) => (
                <Cell key={i} fill={entry.isCurrent ? '#2563EB' : entry.isFuture ? '#E5E7EB' : '#16A34A'} />
              ))}
              <LabelList dataKey="completed" position="top" style={{ fontSize: 11, fill: '#6B7280' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#16A34A'}}/>Completed</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#2563EB'}}/>Current Month</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#E5E7EB'}}/>Upcoming</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calibration Per Month bar chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Calibration Per Month ({prevYear})</h3>
              <p className="text-xs text-gray-400 mt-0.5">Click a month bar to see customer breakdown</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#16A34A'}}/>Renewed</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#EF4444'}}/>Lost</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#7C3AED'}}/>New {curYear}</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#F97316'}}/>Warranty</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthLabels} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
              <XAxis dataKey="month" interval={0} tick={({ x, y, payload }) => {
                const idx = MONTH_NAMES.indexOf(payload.value);
                const key = idx !== -1 ? String(idx + 1).padStart(2, '0') : null;
                return (
                  <g transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }}
                     onClick={e => { e.stopPropagation(); if (key) handleBarClick({ activeLabel: payload.value }); }}>
                    <text x={0} y={0} dy={14} textAnchor="middle" fill="#6B7280" fontSize={11} fontWeight={500}>{payload.value}</text>
                  </g>
                );
              }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v, name) => [v, name === 'renewed' ? 'Renewed' : name === 'lost' ? 'Lost' : name === 'newAcc' ? `New ${curYear}` : 'Warranty']} />
              <Bar dataKey="renewed"  stackId="a" fill="#16A34A" name="renewed"  radius={[0,0,0,0]} />
              <Bar dataKey="lost"     stackId="a" fill="#EF4444" name="lost"     radius={[0,0,0,0]} />
              <Bar dataKey="newAcc"   stackId="a" fill="#7C3AED" name="newAcc"   radius={[0,0,0,0]} />
              <Bar dataKey="warranty" stackId="a" fill="#F97316" name="warranty" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Equipment by Type — clickable bars */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Equipment by Type</h3>
          <p className="text-xs text-gray-400 mb-3">Click a bar to see customers &amp; serial numbers</p>
          {stats.equipmentByType && stats.equipmentByType.length > 0 ? (() => {
            const top15 = stats.equipmentByType.slice(0, 15);
            const chartHeight = Math.max(200, top15.length * 28);
            return (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  data={top15}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 4, bottom: 0 }}
                  onClick={p => { if (p?.activePayload?.[0]?.payload?.equipment_name) handleEqTypeClick(p.activePayload[0].payload.equipment_name); }}
                  style={{ cursor: 'pointer' }}
                >
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="equipment_name"
                    width={110}
                    tick={{ fontSize: 10, fontWeight: 500 }}
                    tickFormatter={v => v.length > 16 ? v.slice(0, 15) + '…' : v}
                  />
                  <Tooltip formatter={(v, _n, p) => [v + ' units', p.payload.equipment_name]} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {top15.map((_, i) => (
                      <Cell key={i} fill={TYPE_COLORS[Math.min(i, TYPE_COLORS.length - 1)].bg} />
                    ))}
                    <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          })() : (
            <p className="text-sm text-gray-400 py-4 text-center">No data</p>
          )}
        </div>
      </div>

      {/* Job Code Breakdown */}
      {stats.jobCodeSummary && stats.jobCodeSummary.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {codes.map(code => {
              const meta = CODE_META[code];
              const data = stats.jobCodeSummary.find(r => r.code === code) || { count: 0, revenue: 0 };
              return (
                <div key={code}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all"
                  onClick={() => handleJobCodeClick(code, meta.desc)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: meta.light, color: meta.color }}>{meta.label}</span>
                    <span className="text-xs text-gray-300">↗</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{data.count.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>
                  <p className="text-xs font-semibold mt-1" style={{ color: meta.color }}>
                    MYR {(data.revenue || 0).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Job Code Trend by Year</h3>
            <p className="text-xs text-gray-400 mb-3">CAL_A / CAL_B / SERV_A / SERV_B — all years · click a bar to drill down</p>
            <div className="flex gap-4 mb-3 flex-wrap">
              {codes.map(c => (
                <button key={c}
                  onClick={() => handleJobCodeClick(c, CODE_META[c].desc)}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ background: CODE_META[c].color }} />
                  {c}
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={yearData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
                onClick={p => { if (p?.activePayload?.[0]?.name) handleJobCodeClick(p.activePayload[0].name, CODE_META[p.activePayload[0].name]?.desc || p.activePayload[0].name); }}>
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                {codes.map(c => (
                  <Bar key={c} dataKey={c} stackId="a" fill={CODE_META[c].color} radius={c === 'SERV_B' ? [4,4,0,0] : [0,0,0,0]} style={{ cursor: 'pointer' }} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent calibrations — clickable rows */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Calibrations</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                <th className="text-left py-2 pr-4 font-medium">Customer</th>
                <th className="text-left py-2 pr-4 font-medium">Equipment</th>
                <th className="text-left py-2 pr-4 font-medium">Date</th>
                <th className="text-left py-2 pr-4 font-medium">Next Due</th>
                <th className="text-left py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentCals.map(r => (
                <tr key={r.id}
                  onClick={() => navigate(`/customers/${r.customer_id}`)}
                  className="border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-colors">
                  <td className="py-2 pr-4 font-medium text-gray-900">{r.customer_name}</td>
                  <td className="py-2 pr-4 text-gray-600">{r.equipment_name}</td>
                  <td className="py-2 pr-4 text-gray-600">{formatDate(r.calibration_date)}</td>
                  <td className="py-2 pr-4 text-gray-600">{formatDate(r.next_calibration_date)}</td>
                  <td className="py-2"><PriorityBadge nextCal={r.next_calibration_date} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODALS ── */}

      {/* Job code customer modal */}
      {jobModal && (
        <DrillModal
          title={jobModal.label}
          subtitle={`${jobModal.code} · All-time customer breakdown · click row to view full details`}
          onClose={() => setJobModal(null)}
          loading={jobModalLoading || !jobModal.data}
          onExportCsv={jobModal.data?.customers?.length ? () => exportCsv(
            jobModal.data.customers,
            [
              { header: 'Customer',       value: c => c.name },
              { header: 'Country',        value: c => c.country || '' },
              { header: 'State',          value: c => c.state || '' },
              { header: 'Jobs',           value: c => c.job_count },
              { header: 'Revenue (MYR)',  value: c => c.revenue || 0 },
              { header: 'Last Date',      value: c => c.last_date || '' },
            ],
            `${jobModal.code}_customers.csv`
          ) : null}>
          {jobModal.data?.customers?.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No records found</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500">
                  <th className="text-left px-4 py-2.5 font-medium">#</th>
                  <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                  <th className="text-left px-4 py-2.5 font-medium">Country</th>
                  <th className="text-center px-4 py-2.5 font-medium">Jobs</th>
                  <th className="text-right px-4 py-2.5 font-medium">Revenue (MYR)</th>
                </tr>
              </thead>
              <tbody>
                {jobModal.data.customers.map((c, i) => (
                  <tr key={c.id}
                    onClick={() => { setJobModal(null); navigate(`/customers/${c.id}`); }}
                    className={`border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors ${i === 0 ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900 text-xs">{c.name}</p>
                      <p className="text-xs text-gray-400">{formatDate(c.last_date)}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{c.country || c.state || '—'}</td>
                    <td className="px-4 py-2.5 text-center"><span className="text-xs font-bold text-gray-900">{c.job_count}</span></td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs font-semibold text-gray-700">
                        {c.revenue > 0 ? c.revenue.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-semibold text-gray-600">{jobModal.data.customers.length} customers</td>
                  <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-900">{jobModal.data.customers.reduce((s, c) => s + c.job_count, 0)}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">
                    {jobModal.data.customers.reduce((s, c) => s + (c.revenue || 0), 0).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </DrillModal>
      )}

      {/* Equipment type detail modal */}
      {eqTypeModal && (
        <DrillModal
          title={eqTypeModal.name}
          subtitle={eqTypeModal.data ? `${eqTypeModal.data.items.length} units across all customers · click row to view customer` : 'Loading…'}
          onClose={() => setEqTypeModal(null)}
          loading={eqTypeLoading || !eqTypeModal.data}
          onExportCsv={eqTypeModal.data?.items?.length ? () => exportCsv(
            eqTypeModal.data.items,
            [
              { header: 'Customer',       value: r => r.customer_name },
              { header: 'Country',        value: r => r.country || '' },
              { header: 'Model',          value: r => r.model || '' },
              { header: 'Serial No',      value: r => r.serial_number || '' },
              { header: 'Modules',        value: r => r.modules || '' },
              { header: 'Status',         value: r => r.status || '' },
              { header: 'Last Cal',       value: r => r.last_cal || '' },
              { header: 'Next Cal',       value: r => r.next_cal || '' },
            ],
            `${eqTypeModal.name.replace(/\s+/g,'_')}_equipment.csv`
          ) : null}>
          {eqTypeModal.data?.items?.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No equipment found</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500">
                  <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                  <th className="text-left px-4 py-2.5 font-medium">Model</th>
                  <th className="text-left px-4 py-2.5 font-medium font-mono">Serial No</th>
                  <th className="text-left px-4 py-2.5 font-medium">Modules</th>
                  <th className="text-left px-4 py-2.5 font-medium">Last Cal</th>
                  <th className="text-left px-4 py-2.5 font-medium">Next Cal</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {eqTypeModal.data.items.map((r, i) => (
                  <tr key={r.equipment_id}
                    onClick={() => { setEqTypeModal(null); navigate(`/customers/${r.customer_id}`); }}
                    className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="text-xs font-medium text-gray-900">{r.customer_name}</p>
                      <p className="text-xs text-gray-400">{r.country || r.state || '—'}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{r.model || '—'}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-700">{r.serial_number || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 max-w-32 truncate">{r.modules || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(r.last_cal)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(r.next_cal)}</td>
                    <td className="px-4 py-2.5"><PriorityBadge nextCal={r.next_cal} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white border-t border-gray-200">
                <tr>
                  <td colSpan={7} className="px-4 py-2.5 text-xs font-semibold text-gray-600">
                    {eqTypeModal.data.items.length} units · {new Set(eqTypeModal.data.items.map(r => r.customer_id)).size} customers
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </DrillModal>
      )}

      {/* Month detail modal */}
      {monthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setMonthModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-900">{monthModal.monthName} {prevYear}</h3>
                <p className="text-xs text-gray-400">{prevYear} calibrations · {curYear} renewal status · click a customer to view details</p>
              </div>
              <div className="flex items-center gap-2">
                {monthModal.data && (
                  <button onClick={() => {
                    const tab = modalTab;
                    const items = tab === 'renewed' ? monthModal.data.renewed
                      : tab === 'lost' ? monthModal.data.lost
                      : tab === 'new' ? monthModal.data.newAccounts
                      : monthModal.data.warrantyItems || [];
                    exportCsv(items,
                      tab === 'warranty'
                        ? [{ header: 'Customer', value: r => r.sell_to_no }, { header: 'Product', value: r => r.item_description }, { header: 'Family', value: r => r.family_decrip }, { header: 'Qty', value: r => r.quantity }]
                        : [{ header: 'Customer', value: r => r.name }, { header: 'Country', value: r => r.country || '' }, { header: tab === 'renewed' ? 'Renewed Date' : tab === 'lost' ? 'Last Cal' : 'First Cal', value: r => r.renewed_date || r.last_calibration_date || r.first_cal_date || '' }],
                      `${monthModal.monthName}_${prevYear}_${tab}.csv`
                    );
                  }} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                    ⬇ Export CSV
                  </button>
                )}
                <button onClick={() => setMonthModal(null)} className="text-gray-400 hover:text-gray-600 text-xl font-light leading-none">×</button>
              </div>
            </div>
            <div className="flex border-b border-gray-100 shrink-0">
              {[
                { key: 'renewed',  label: 'Renewed',    active: 'text-green-700 border-b-2 border-green-600',  count: monthModal.data?.renewed?.length },
                { key: 'lost',     label: 'Lost',       active: 'text-red-600 border-b-2 border-red-500',      count: monthModal.data?.lost?.length },
                { key: 'new',      label: `New ${curYear}`, active: 'text-purple-700 border-b-2 border-purple-600', count: monthModal.data?.newAccounts?.length },
                { key: 'warranty', label: 'Warranty',   active: 'text-orange-600 border-b-2 border-orange-500', count: monthModal.data?.warrantyItems?.length },
              ].map(t => (
                <button key={t.key} onClick={() => setModalTab(t.key)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${modalTab === t.key ? t.active : 'text-gray-400 hover:text-gray-600'}`}>
                  {t.label} {t.count !== undefined ? `(${t.count})` : ''}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {modalLoading ? (
                <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
              ) : !monthModal.data ? (
                <p className="text-sm text-gray-400 text-center py-8">No data</p>
              ) : modalTab === 'renewed' ? (
                monthModal.data.renewed.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No renewals this month</p> : (
                  <div className="space-y-1">
                    {monthModal.data.renewed.map(c => (
                      <div key={c.id} onClick={() => { setMonthModal(null); navigate(`/customers/${c.id}`); }}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-green-50 border border-green-100 hover:bg-green-100 cursor-pointer transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.country || '—'}</p>
                        </div>
                        <span className="text-xs text-green-700 font-medium">Renewed {formatDate(c.renewed_date)}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : modalTab === 'lost' ? (
                monthModal.data.lost.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No lost accounts this month</p> : (
                  <div className="space-y-1">
                    {monthModal.data.lost.map(c => (
                      <div key={c.id} onClick={() => { setMonthModal(null); navigate(`/customers/${c.id}`); }}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-red-50 border border-red-100 hover:bg-red-100 cursor-pointer transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.country || '—'}</p>
                        </div>
                        <span className="text-xs text-red-600 font-medium">Last: {formatDate(c.last_calibration_date)}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : modalTab === 'new' ? (
                monthModal.data.newAccounts.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No new accounts this month</p> : (
                  <div className="space-y-1">
                    {monthModal.data.newAccounts.map(c => (
                      <div key={c.id} onClick={() => { setMonthModal(null); navigate(`/customers/${c.id}`); }}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-purple-50 border border-purple-100 hover:bg-purple-100 cursor-pointer transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.country || '—'}</p>
                        </div>
                        <span className="text-xs text-purple-700 font-medium">First cal: {formatDate(c.first_cal_date)}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                !monthModal.data.warrantyItems || monthModal.data.warrantyItems.length === 0
                  ? <p className="text-sm text-gray-400 text-center py-8">No warranty equipment this month</p>
                  : (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400 mb-3">New equipment invoiced in {prevYear} — warranty calibration due {curYear}</p>
                      {monthModal.data.warrantyItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-orange-50 border border-orange-100">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.sell_to_no}</p>
                            <p className="text-xs text-gray-500">{item.item_description}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-orange-700 font-medium">{item.family_decrip}</span>
                            {item.quantity > 1 && <p className="text-xs text-gray-400">×{item.quantity}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generic list modal (full overdue / due soon) */}
      {listModal && (
        <DrillModal
          title={listModal.title}
          subtitle={listModal.subtitle}
          onClose={() => setListModal(null)}
          loading={false}
          onExportCsv={() => exportCsv(
            listModal.items,
            listModal.type === 'completed' ? [
              { header: 'Customer',         value: r => r.customer_name },
              { header: 'Equipment',        value: r => r.equipment_name },
              { header: 'Serial No',        value: r => r.serial_number || '' },
              { header: 'State',            value: r => r.state || '' },
              { header: 'Calibration Date', value: r => r.calibration_date || '' },
              { header: 'Performed By',     value: r => r.performed_by || '' },
              { header: 'Report Status',    value: r => r.cal_report_status || '' },
              { header: 'Fee',              value: r => r.fee != null ? r.fee : '' },
            ] : [
              { header: 'Customer',    value: r => r.customer_name },
              { header: 'Equipment',   value: r => r.equipment_name },
              { header: 'Serial No',   value: r => r.serial_number || '' },
              { header: 'State',       value: r => r.state || '' },
              { header: listModal.type === 'overdue' ? 'Days Overdue' : 'Days Until', value: r => listModal.type === 'overdue' ? Math.round(r.days_overdue) : Math.round(r.days_until) },
              { header: 'Due Date',    value: r => r.next_calibration_date || '' },
            ],
            `${listModal.type}.csv`
          )}>
          {listModal.items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No records</p>
          ) : listModal.type === 'completed' ? (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500">
                  <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                  <th className="text-left px-4 py-2.5 font-medium">Equipment</th>
                  <th className="text-left px-4 py-2.5 font-medium font-mono">Serial No</th>
                  <th className="text-left px-4 py-2.5 font-medium">Calibration Date</th>
                  <th className="text-left px-4 py-2.5 font-medium">Performed By</th>
                  <th className="text-right px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {listModal.items.map(r => (
                  <tr key={r.id}
                    onClick={() => { setListModal(null); navigate(`/customers/${r.customer_id}`); }}
                    className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="text-xs font-medium text-gray-900">{r.customer_name}</p>
                      <p className="text-xs text-gray-400">{r.state || '—'}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{r.equipment_name}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-700">{r.serial_number || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(r.calibration_date)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{r.performed_by || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs font-bold text-green-600">{r.cal_report_status || 'Completed'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500">
                  <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                  <th className="text-left px-4 py-2.5 font-medium">Equipment</th>
                  <th className="text-left px-4 py-2.5 font-medium font-mono">Serial No</th>
                  <th className="text-left px-4 py-2.5 font-medium">Due Date</th>
                  <th className="text-right px-4 py-2.5 font-medium">{listModal.type === 'overdue' ? 'Days Overdue' : 'Days Left'}</th>
                </tr>
              </thead>
              <tbody>
                {listModal.items.map(r => (
                  <tr key={r.id}
                    onClick={() => { setListModal(null); navigate(`/customers/${r.customer_id}`); }}
                    className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="text-xs font-medium text-gray-900">{r.customer_name}</p>
                      <p className="text-xs text-gray-400">{r.state || '—'}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{r.equipment_name}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-700">{r.serial_number || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(r.next_calibration_date)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`text-xs font-bold ${listModal.type === 'overdue' ? 'text-red-600' : 'text-amber-600'}`}>
                        {listModal.type === 'overdue' ? Math.round(r.days_overdue) : Math.round(r.days_until)}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DrillModal>
      )}
    </div>
  );
}
