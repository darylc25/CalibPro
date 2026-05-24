import React, { useState, useMemo } from 'react';
import { getPriority, formatDate } from '../api/index.js';
import PriorityBadge from './PriorityBadge.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function cellStyle(dayRecords) {
  if (!dayRecords || dayRecords.length === 0) return '';
  const priorities = dayRecords.map(r => getPriority(r.next_calibration_date));
  if (priorities.includes('overdue')) return 'bg-red-100 border-red-300';
  if (priorities.includes('due_soon')) return 'bg-amber-100 border-amber-300';
  return 'bg-green-100 border-green-300';
}

function dotColor(dayRecords) {
  if (!dayRecords || dayRecords.length === 0) return '';
  const priorities = dayRecords.map(r => getPriority(r.next_calibration_date));
  if (priorities.includes('overdue')) return 'bg-red-500';
  if (priorities.includes('due_soon')) return 'bg-amber-500';
  return 'bg-green-500';
}

export default function CalendarView({ records }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(null);

  // Group latest-cal records by next_calibration_date
  const byDate = useMemo(() => {
    const map = {};
    records.forEach(r => {
      const d = r.next_calibration_date;
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push(r);
    });
    return map;
  }, [records]);

  // Month summary: calibrations per month (for the bar at top)
  const monthlyCounts = useMemo(() => {
    const map = {};
    records.forEach(r => {
      if (!r.next_calibration_date) return;
      const ym = r.next_calibration_date.slice(0, 7);
      map[ym] = (map[ym] || 0) + 1;
    });
    return map;
  }, [records]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
  const totalThisMonth = monthlyCounts[ym] || 0;

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  }
  function goToday() {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(null);
  }

  function selectDay(day) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDay(selectedDay === key ? null : key);
  }

  // Build 6-week grid
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = today.toISOString().split('T')[0];
  const selectedRecords = selectedDay ? (byDate[selectedDay] || []) : [];

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 font-bold text-lg leading-none">‹</button>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{MONTHS[month]} {year}</h2>
              <p className="text-xs text-gray-500">
                {totalThisMonth > 0
                  ? <><span className="font-semibold text-gray-700">{totalThisMonth}</span> calibration{totalThisMonth !== 1 ? 's' : ''} due this month</>
                  : 'No calibrations due this month'}
              </p>
            </div>
            <button onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 font-bold text-lg leading-none">›</button>
          </div>
          <button onClick={goToday}
            className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
            Today
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="aspect-square" />;

            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayRecs = byDate[key] || [];
            const count = dayRecs.length;
            const isToday = key === todayStr;
            const isSelected = key === selectedDay;
            const style = cellStyle(dayRecs);
            const dot = dotColor(dayRecs);

            return (
              <button
                key={key}
                onClick={() => count > 0 && selectDay(day)}
                className={`
                  relative flex flex-col items-center justify-start pt-1 pb-1 rounded-lg border transition-all
                  min-h-[52px]
                  ${count > 0 ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                  ${isSelected ? 'ring-2 ring-offset-1 ring-navy' : ''}
                  ${style || 'border-transparent'}
                  ${isToday && !style ? 'border-blue-300 bg-blue-50' : ''}
                `}
              >
                <span className={`text-xs font-semibold leading-none mb-1
                  ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                  {day}
                </span>
                {count > 0 && (
                  <span className={`text-xs font-bold text-white rounded-full w-5 h-5 flex items-center justify-center ${dot}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
          {[
            { color: 'bg-red-500', label: 'Overdue' },
            { color: 'bg-amber-500', label: 'Due Soon' },
            { color: 'bg-green-500', label: 'Scheduled' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-3 h-3 rounded-full ${color}`} />
              {label}
            </div>
          ))}
          <span className="text-xs text-gray-400 ml-auto">Click a number to see details</span>
        </div>
      </div>

      {/* Day drill-down */}
      {selectedDay && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">
              {formatDate(selectedDay)}
              <span className="ml-2 text-sm font-normal text-gray-500">
                — {selectedRecords.length} calibration{selectedRecords.length !== 1 ? 's' : ''} due
              </span>
            </h3>
            <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="divide-y divide-gray-50">
            {selectedRecords.map(r => (
              <div key={r.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.customer_name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {r.equipment_name}
                    {r.serial_number ? ` · ${r.serial_number}` : ''}
                    {r.modules ? ` · ${r.modules}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-400">{r.state}</span>
                  <PriorityBadge nextCal={r.next_calibration_date} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly overview mini-chart */}
      <MonthlyOverview monthlyCounts={monthlyCounts} currentYm={ym} onSelect={ym => {
        const [y, m] = ym.split('-');
        setViewDate(new Date(parseInt(y), parseInt(m) - 1, 1));
        setSelectedDay(null);
      }} />
    </div>
  );
}

function MonthlyOverview({ monthlyCounts, currentYm, onSelect }) {
  // Show 12 months centred around today
  const months = [];
  const now = new Date();
  for (let i = -3; i <= 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ ym, label: `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}` });
  }
  const maxCount = Math.max(1, ...months.map(m => monthlyCounts[m.ym] || 0));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">12-Month Overview</h3>
      <div className="flex items-end gap-1.5 h-20">
        {months.map(({ ym, label }) => {
          const count = monthlyCounts[ym] || 0;
          const heightPct = count ? Math.max(10, Math.round((count / maxCount) * 100)) : 4;
          const isCurrent = ym === currentYm;
          const isNow = ym === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          return (
            <div key={ym} className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
              onClick={() => onSelect(ym)}>
              {count > 0 && (
                <span className="text-xs font-semibold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {count}
                </span>
              )}
              <div className="w-full flex items-end justify-center" style={{ height: '56px' }}>
                <div
                  className={`w-full rounded-t transition-all ${
                    isCurrent ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                  } ${count === 0 ? 'bg-gray-100' : isNow ? 'bg-blue-500' : 'bg-navy'}`}
                  style={{ height: `${heightPct}%`, background: count === 0 ? undefined : isCurrent || isNow ? undefined : '#0D2847' }}
                />
              </div>
              <span className={`text-xs leading-none ${isCurrent ? 'font-bold text-gray-900' : 'text-gray-400'}`}
                style={{ fontSize: '9px' }}>
                {label.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
