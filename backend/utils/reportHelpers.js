// Shared helpers for export.js, email.js, dashboard.js — previously duplicated across files.

const NAVY = '0D2847';
const OVERDUE_BG = 'FDECEA';
const DUE_SOON_BG = 'FFF3CD';

// Most recent calibration_records row per equipment — used as a subquery
// wherever a query needs each unit's current next_calibration_date.
const LATEST_CAL_SUBQUERY = `SELECT equipment_id, MAX(calibration_date) as max_date FROM calibration_records GROUP BY equipment_id`;

function getPriority(nextCal) {
  if (!nextCal) return 'unknown';
  const today = new Date().toISOString().split('T')[0];
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const soonStr = soon.toISOString().split('T')[0];
  if (nextCal < today) return 'overdue';
  if (nextCal <= soonStr) return 'due_soon';
  return 'scheduled';
}

function daysDiff(dateStr) {
  if (!dateStr) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  const diff = Math.round((today - d) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getQuarter(date) {
  return Math.floor(date.getMonth() / 3) + 1;
}

function quarterRange(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    label: `Q${quarter} ${year}`,
    months: ['January – March', 'April – June', 'July – September', 'October – December'][quarter - 1],
  };
}

module.exports = { NAVY, OVERDUE_BG, DUE_SOON_BG, LATEST_CAL_SUBQUERY, getPriority, daysDiff, fmtDate, getQuarter, quarterRange };
