import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPriority, formatDate } from '../api/index.js';
import PriorityBadge from './PriorityBadge.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function dueStyle(dueRecs) {
  if (!dueRecs || dueRecs.length === 0) return '';
  const ps = dueRecs.map(r => getPriority(r.next_calibration_date));
  if (ps.includes('overdue')) return 'bg-red-50 border-red-200';
  if (ps.includes('due_soon')) return 'bg-amber-50 border-amber-200';
  return 'bg-green-50 border-green-200';
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function MonthYearPicker({ year, month, onChange, onClose }) {
  const [pickerYear, setPickerYear] = useState(year);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-56">
      {/* Year selector */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setPickerYear(y => y - 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 font-bold">‹</button>
        <span className="text-sm font-bold text-gray-900">{pickerYear}</span>
        <button onClick={() => setPickerYear(y => y + 1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 font-bold">›</button>
      </div>
      {/* Month grid */}
      <div className="grid grid-cols-3 gap-1">
        {MONTHS_SHORT.map((m, i) => {
          const isActive = pickerYear === year && i === month;
          return (
            <button key={m}
              onClick={() => { onChange(pickerYear, i); onClose(); }}
              className={`py-1.5 rounded-lg text-xs font-medium transition-colors
                ${isActive
                  ? 'text-white'
                  : 'text-gray-700 hover:bg-gray-100'}`}
              style={isActive ? { background: '#1A4B8C' } : {}}>
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// records = latest per equipment (for due dates)
// allRecords = all calibration records (for done dates)
export default function CalendarView({ records, allRecords = [] }) {
  const today = new Date();
  const navigate = useNavigate();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  // Group by next_calibration_date → "due" events
  const dueByDate = useMemo(() => {
    const map = {};
    records.forEach(r => {
      const d = r.next_calibration_date;
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push(r);
    });
    return map;
  }, [records]);

  // Group by calibration_date → "done" events
  const doneByDate = useMemo(() => {
    const map = {};
    allRecords.forEach(r => {
      const d = r.calibration_date;
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push(r);
    });
    return map;
  }, [allRecords]);

  // Monthly breakdown by status (for due dates)
  const monthlyByStatus = useMemo(() => {
    const map = {}; // ym -> { overdue, due_soon, scheduled }
    records.forEach(r => {
      if (!r.next_calibration_date) return;
      const ym = r.next_calibration_date.slice(0, 7);
      if (!map[ym]) map[ym] = { overdue: 0, due_soon: 0, scheduled: 0 };
      const p = getPriority(r.next_calibration_date);
      if (p === 'overdue') map[ym].overdue++;
      else if (p === 'due_soon') map[ym].due_soon++;
      else map[ym].scheduled++;
    });
    return map;
  }, [records]);

  // Monthly done counts
  const monthlyDone = useMemo(() => {
    const map = {};
    allRecords.forEach(r => {
      if (!r.calibration_date) return;
      const ym = r.calibration_date.slice(0, 7);
      map[ym] = (map[ym] || 0) + 1;
    });
    return map;
  }, [allRecords]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;

  const thisMonthStatus = monthlyByStatus[ym] || { overdue: 0, due_soon: 0, scheduled: 0 };
  const totalDueThisMonth = thisMonthStatus.overdue + thisMonthStatus.due_soon + thisMonthStatus.scheduled;
  const totalDoneThisMonth = monthlyDone[ym] || 0;

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); setSelectedDay(null); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); setSelectedDay(null); }
  function goToday() { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(null); }
  function selectDay(day) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDay(selectedDay === key ? null : key);
  }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = today.toISOString().split('T')[0];
  const selDueRecs = selectedDay ? (dueByDate[selectedDay] || []) : [];
  const selDoneRecs = selectedDay ? (doneByDate[selectedDay] || []) : [];

  // Grouped due recs for drill-down
  const selOverdue = selDueRecs.filter(r => getPriority(r.next_calibration_date) === 'overdue');
  const selDueSoon = selDueRecs.filter(r => getPriority(r.next_calibration_date) === 'due_soon');
  const selScheduled = selDueRecs.filter(r => getPriority(r.next_calibration_date) === 'scheduled');

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 font-bold text-lg leading-none">‹</button>

            {/* Month/Year picker trigger */}
            <div className="relative">
              <button
                onClick={() => setShowPicker(p => !p)}
                className="flex items-center gap-1 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors group"
              >
                <h2 className="text-lg font-bold text-gray-900">{MONTHS[month]} {year}</h2>
                <span className="text-gray-400 text-sm group-hover:text-gray-600">▾</span>
              </button>
              {showPicker && (
                <MonthYearPicker
                  year={year}
                  month={month}
                  onChange={(y, m) => { setViewDate(new Date(y, m, 1)); setSelectedDay(null); }}
                  onClose={() => setShowPicker(false)}
                />
              )}
            </div>

            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 font-bold text-lg leading-none">›</button>

            {/* Status summary pills */}
            <div className="flex items-center gap-2 ml-1 flex-wrap">
              {thisMonthStatus.overdue > 0 && (
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                  <span className="font-semibold text-red-600">{thisMonthStatus.overdue}</span>
                  <span className="text-gray-500">overdue</span>
                </span>
              )}
              {thisMonthStatus.due_soon > 0 && (
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  <span className="font-semibold text-amber-600">{thisMonthStatus.due_soon}</span>
                  <span className="text-gray-500">due soon</span>
                </span>
              )}
              {thisMonthStatus.scheduled > 0 && (
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  <span className="font-semibold text-green-600">{thisMonthStatus.scheduled}</span>
                  <span className="text-gray-500">scheduled</span>
                </span>
              )}
              {totalDoneThisMonth > 0 && (
                <span className="flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  <span className="font-semibold text-blue-600">{totalDoneThisMonth}</span>
                  <span className="text-gray-500">completed</span>
                </span>
              )}
              {totalDueThisMonth === 0 && totalDoneThisMonth === 0 && (
                <span className="text-xs text-gray-400">No events this month</span>
              )}
            </div>
          </div>

          <button onClick={goToday} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
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
            if (!day) return <div key={`e-${i}`} className="min-h-[64px]" />;

            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dueRecs = dueByDate[key] || [];
            const doneRecs = doneByDate[key] || [];

            // Split due by status
            const overdueCount = dueRecs.filter(r => getPriority(r.next_calibration_date) === 'overdue').length;
            const dueSoonCount = dueRecs.filter(r => getPriority(r.next_calibration_date) === 'due_soon').length;
            const scheduledCount = dueRecs.filter(r => getPriority(r.next_calibration_date) === 'scheduled').length;
            const doneCount = doneRecs.length;

            const hasDue = dueRecs.length > 0;
            const hasDone = doneRecs.length > 0;
            const isToday = key === todayStr;
            const isSelected = key === selectedDay;
            const clickable = hasDue || hasDone;
            const style = dueStyle(dueRecs);

            return (
              <button
                key={key}
                onClick={() => clickable && selectDay(day)}
                className={`
                  relative flex flex-col items-center justify-start pt-1.5 pb-1 px-0.5 rounded-lg border transition-all min-h-[64px]
                  ${clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                  ${isSelected ? 'ring-2 ring-offset-1 ring-blue-400' : ''}
                  ${style || 'border-transparent'}
                  ${isToday && !style ? 'border-blue-300 bg-blue-50' : ''}
                `}
              >
                <span className={`text-xs font-semibold leading-none mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                  {day}
                </span>
                <div className="flex flex-wrap justify-center gap-0.5">
                  {overdueCount > 0 && (
                    <span className="text-white rounded-full flex items-center justify-center bg-red-500 font-bold"
                      style={{ fontSize: '9px', minWidth: '16px', height: '16px', padding: '0 3px' }}>
                      {overdueCount}
                    </span>
                  )}
                  {dueSoonCount > 0 && (
                    <span className="text-white rounded-full flex items-center justify-center bg-amber-500 font-bold"
                      style={{ fontSize: '9px', minWidth: '16px', height: '16px', padding: '0 3px' }}>
                      {dueSoonCount}
                    </span>
                  )}
                  {scheduledCount > 0 && (
                    <span className="text-white rounded-full flex items-center justify-center bg-green-500 font-bold"
                      style={{ fontSize: '9px', minWidth: '16px', height: '16px', padding: '0 3px' }}>
                      {scheduledCount}
                    </span>
                  )}
                  {doneCount > 0 && (
                    <span className="text-white rounded-full flex items-center justify-center bg-blue-500 font-bold"
                      style={{ fontSize: '9px', minWidth: '16px', height: '16px', padding: '0 3px' }}>
                      ✓{doneCount > 1 ? doneCount : ''}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 flex-wrap">
          {[
            { color: 'bg-red-500', label: 'Overdue' },
            { color: 'bg-amber-500', label: 'Due Soon' },
            { color: 'bg-green-500', label: 'Scheduled' },
            { color: 'bg-blue-500', label: 'Completed ✓' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className={`w-3 h-3 rounded-full ${color}`} />
              {label}
            </div>
          ))}
          <span className="text-xs text-gray-400 ml-auto">Click a day to see details</span>
        </div>
      </div>

      {/* Day drill-down */}
      {selectedDay && (selDueRecs.length > 0 || selDoneRecs.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{formatDate(selectedDay)}</h3>
              <div className="flex items-center gap-1">
                {selOverdue.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{selOverdue.length} overdue</span>
                )}
                {selDueSoon.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{selDueSoon.length} due soon</span>
                )}
                {selScheduled.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{selScheduled.length} scheduled</span>
                )}
                {selDoneRecs.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{selDoneRecs.length} completed</span>
                )}
              </div>
            </div>
            <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          {/* Overdue section */}
          {selOverdue.length > 0 && (
            <DueSection
              recs={selOverdue}
              label="🔴 Overdue"
              color="border-red-200 bg-red-50/30"
              headerColor="text-red-600"
              navigate={navigate}
            />
          )}

          {/* Due soon section */}
          {selDueSoon.length > 0 && (
            <DueSection
              recs={selDueSoon}
              label="🟡 Due Soon"
              color="border-amber-200 bg-amber-50/30"
              headerColor="text-amber-600"
              navigate={navigate}
            />
          )}

          {/* Scheduled section */}
          {selScheduled.length > 0 && (
            <DueSection
              recs={selScheduled}
              label="🟢 Scheduled"
              color="border-green-200 bg-green-50/30"
              headerColor="text-green-600"
              navigate={navigate}
            />
          )}

          {/* Completed section */}
          {selDoneRecs.length > 0 && (
            <div className={selDueRecs.length > 0 ? 'mt-4' : ''}>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-2">
                ✅ Completed Jobs — {selDoneRecs.length} record{selDoneRecs.length !== 1 ? 's' : ''}
                <span className="ml-2 normal-case font-normal text-gray-400">· click to view profile</span>
              </p>
              <div className="divide-y divide-gray-50 rounded-lg border border-blue-100 overflow-hidden">
                {selDoneRecs.map(r => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/customers/${r.customer_id}`)}
                    className="w-full py-2.5 px-3 flex items-center justify-between gap-4 bg-blue-50/30 hover:bg-blue-50 transition-colors text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 truncate">{r.customer_name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {r.equipment_name}{r.serial_number ? ` · S/N ${r.serial_number}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-right">
                      <div>
                        <p className="text-xs font-medium text-blue-700">{r.service_type || 'Calibration'}</p>
                        {r.performed_by && <p className="text-xs text-gray-400">{r.performed_by}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monthly overview mini-chart */}
      <MonthlyOverview
        monthlyByStatus={monthlyByStatus}
        monthlyDone={monthlyDone}
        currentYm={ym}
        onSelect={ym => {
          const [y, m] = ym.split('-');
          setViewDate(new Date(parseInt(y), parseInt(m) - 1, 1));
          setSelectedDay(null);
        }}
      />
    </div>
  );
}

function DueSection({ recs, label, color, headerColor, navigate }) {
  return (
    <div className="mb-3">
      <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${headerColor}`}>
        {label} — {recs.length} unit{recs.length !== 1 ? 's' : ''}
        <span className="ml-2 normal-case font-normal text-gray-400">· click to open &amp; record job</span>
      </p>
      <div className={`divide-y divide-gray-100 rounded-lg border overflow-hidden ${color}`}>
        {recs.map(r => (
          <button
            key={r.id}
            onClick={() => navigate(`/customers/${r.customer_id}?equipment=${r.equipment_id}&newcal=1`)}
            className="w-full py-3 px-3 flex items-center justify-between gap-4 hover:bg-white/60 transition-colors text-left group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 truncate flex items-center gap-1.5">
                {r.customer_name}
                <span className="text-xs font-normal text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">→ Open Profile</span>
              </p>
              <p className="text-xs text-gray-500 truncate">
                {r.equipment_name}{r.serial_number ? ` · S/N ${r.serial_number}` : ''}{r.modules ? ` · ${r.modules}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-gray-400">{r.state}</span>
              <PriorityBadge nextCal={r.next_calibration_date} />
              <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-medium whitespace-nowrap">
                + Record
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MonthlyOverview({ monthlyByStatus, monthlyDone = {}, currentYm, onSelect }) {
  const months = [];
  const now = new Date();
  for (let i = -3; i <= 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ ym, label: `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}` });
  }

  const maxCount = Math.max(1, ...months.map(({ ym }) => {
    const s = monthlyByStatus[ym] || {};
    const due = (s.overdue || 0) + (s.due_soon || 0) + (s.scheduled || 0);
    return Math.max(due, monthlyDone[ym] || 0);
  }));

  const nowYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-700">12-Month Overview</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-2 rounded-sm bg-red-500 inline-block" /> Overdue
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-2 rounded-sm bg-amber-400 inline-block" /> Due Soon
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-2 rounded-sm bg-green-500 inline-block" /> Scheduled
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-2 rounded-sm bg-blue-400 inline-block" /> Completed
          </div>
        </div>
      </div>
      <div className="flex items-end gap-1 h-24">
        {months.map(({ ym, label }) => {
          const s = monthlyByStatus[ym] || {};
          const overdue = s.overdue || 0;
          const dueSoon = s.due_soon || 0;
          const scheduled = s.scheduled || 0;
          const done = monthlyDone[ym] || 0;
          const totalDue = overdue + dueSoon + scheduled;

          const dueH = totalDue ? Math.max(6, Math.round((totalDue / maxCount) * 56)) : 0;
          const doneH = done ? Math.max(6, Math.round((done / maxCount) * 56)) : 0;

          // For due bar: stacked coloring
          const overdueP = totalDue ? (overdue / totalDue) * 100 : 0;
          const dueSoonP = totalDue ? (dueSoon / totalDue) * 100 : 0;
          const scheduledP = totalDue ? (scheduled / totalDue) * 100 : 0;

          const isCurrent = ym === currentYm;
          const isNow = ym === nowYm;

          return (
            <div key={ym} className="flex-1 flex flex-col items-center gap-0.5 cursor-pointer group"
              onClick={() => onSelect(ym)}>
              <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '60px' }}>
                {totalDue > 0 && (
                  <div
                    title={`${overdue} overdue · ${dueSoon} due soon · ${scheduled} scheduled`}
                    className={`flex-1 rounded-t overflow-hidden transition-all ${isCurrent ? 'opacity-100' : 'opacity-60 group-hover:opacity-90'}`}
                    style={{ height: `${dueH}px` }}
                  >
                    <div style={{ height: `${overdueP}%`, background: '#ef4444' }} />
                    <div style={{ height: `${dueSoonP}%`, background: '#f59e0b' }} />
                    <div style={{ height: `${scheduledP}%`, background: '#22c55e' }} />
                  </div>
                )}
                {done > 0 && (
                  <div title={`${done} completed`}
                    className={`flex-1 rounded-t bg-blue-400 transition-all ${isCurrent ? 'opacity-100' : 'opacity-60 group-hover:opacity-90'}`}
                    style={{ height: `${doneH}px` }}
                  />
                )}
                {totalDue === 0 && done === 0 && (
                  <div className="w-full rounded-t bg-gray-100" style={{ height: '4px' }} />
                )}
              </div>
              <span className={`leading-none ${isCurrent ? 'font-bold text-gray-900' : 'text-gray-400'}`}
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
