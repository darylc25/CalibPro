import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api, formatDate, daysDiff } from '../api/index.js';
import MetricCard from '../components/MetricCard.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';

const PIE_COLORS = ['#0D2847', '#2563EB', '#16A34A', '#DC2626', '#D97706'];

// Color palette for equipment type ranking (index 0 = highest count)
const TYPE_COLORS = [
  { bg: '#DC2626', light: '#FEE2E2', text: '#991B1B', label: '1st' },   // red
  { bg: '#D97706', light: '#FEF3C7', text: '#92400E', label: '2nd' },   // amber
  { bg: '#2563EB', light: '#DBEAFE', text: '#1E40AF', label: '3rd' },   // blue
  { bg: '#16A34A', light: '#DCFCE7', text: '#15803D', label: '4th' },   // green
  { bg: '#7C3AED', light: '#EDE9FE', text: '#5B21B6', label: '5th' },   // purple
  { bg: '#0891B2', light: '#CFFAFE', text: '#0E7490', label: '6th' },   // cyan
  { bg: '#DB2777', light: '#FCE7F3', text: '#9D174D', label: '7th' },   // pink
  { bg: '#EA580C', light: '#FFEDD5', text: '#C2410C', label: '8th' },   // orange
  { bg: '#4B5563', light: '#F3F4F6', text: '#374151', label: '9th+' },  // gray
];

function SectionHeader({ title, color = 'gray' }) {
  const colors = { red: 'text-red-700 bg-red-50 border-red-200', amber: 'text-amber-700 bg-amber-50 border-amber-200', gray: 'text-gray-600 bg-gray-50 border-gray-200' };
  return (
    <h3 className={`text-sm font-semibold px-3 py-2 rounded-lg border ${colors[color]} mb-2`}>{title}</h3>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardStats().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm">Loading dashboard…</div>
    </div>
  );

  if (!stats) return null;

  const monthLabels = stats.monthlyData.map(m => {
    const [y, mo] = m.month.split('-');
    return { month: new Date(y, mo - 1).toLocaleString('default', { month: 'short' }), count: m.count };
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Calibration overview — {new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Customers" value={stats.totalCustomers} icon="🏥" color="blue" />
        <MetricCard title="Total Equipment" value={stats.totalEquipment} icon="🔧" color="blue" />
        <MetricCard title="Overdue" value={stats.overdue} icon="⚠️" color="red" subtitle="Need immediate attention" />
        <MetricCard title="Due This Month" value={stats.dueSoon} icon="🕐" color="amber" subtitle="Within 30 days" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <SectionHeader title={`🔴 Overdue (${stats.overdueList.length})`} color="red" />
          {stats.overdueList.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No overdue equipment</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stats.overdueList.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.customer_name}</p>
                    <p className="text-xs text-gray-500">{r.equipment_name} · {r.serial_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-red-600">{Math.round(r.days_overdue)}d overdue</p>
                    <p className="text-xs text-gray-400">{formatDate(r.next_calibration_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Due Soon */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <SectionHeader title={`🟡 Due Soon (${stats.dueSoonList.length})`} color="amber" />
          {stats.dueSoonList.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Nothing due in the next 30 days</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stats.dueSoonList.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.customer_name}</p>
                    <p className="text-xs text-gray-500">{r.equipment_name} · {r.serial_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-amber-600">{Math.round(r.days_until)}d left</p>
                    <p className="text-xs text-gray-400">{formatDate(r.next_calibration_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart — colour-coded by count */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Calibrations Per Month (last 12 months)</h3>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#16A34A'}}/>High</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#2563EB'}}/>Average</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{background:'#D97706'}}/>Low</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthLabels} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'Calibrations']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {monthLabels.map((entry, i) => {
                  const avg = monthLabels.reduce((s, m) => s + m.count, 0) / (monthLabels.length || 1);
                  const color = entry.count > avg ? '#16A34A' : entry.count < avg ? '#D97706' : '#2563EB';
                  return <Cell key={i} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Equipment by Type bar chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Equipment by Type</h3>
          <p className="text-xs text-gray-400 mb-3">Ranked by units — highest in red</p>
          {stats.equipmentByType && stats.equipmentByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={stats.equipmentByType}
                margin={{ top: 4, right: 4, left: -28, bottom: 40 }}
              >
                <XAxis
                  dataKey="equipment_name"
                  tick={{ fontSize: 10, fontWeight: 600 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v, _n, p) => [v + ' units', p.payload.equipment_name]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stats.equipmentByType.map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[Math.min(i, TYPE_COLORS.length - 1)].bg} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">No data</p>
          )}
        </div>
      </div>

      {/* Recent calibrations */}
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
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
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
    </div>
  );
}
