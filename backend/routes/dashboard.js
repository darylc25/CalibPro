const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { LATEST_CAL_SUBQUERY } = require('../utils/reportHelpers');

router.get('/stats', (req, res) => {
  try {
    const db = getDb();

    // Exclude dealers when requested (replaces old name-based exclusion)
    const excludeDealers = req.query.excludeDealers === 'true' || req.query.excludeDistributors === 'true';
    // Also support legacy name-based exclusion for backwards compat
    const excludeNames = req.query.exclude
      ? String(req.query.exclude).split(',').map(s => s.trim()).filter(Boolean)
      : [];
    let excludeIds = [];
    if (excludeDealers) {
      excludeIds = db.prepare(`SELECT id FROM customers WHERE customer_type = 'Dealer'`).all().map(r => r.id);
    } else if (excludeNames.length > 0) {
      excludeIds = db.prepare(`SELECT id FROM customers WHERE name IN (${excludeNames.map(() => '?').join(',')})`).all(...excludeNames).map(r => r.id);
    }

    // Builds a NOT IN exclusion clause for the given column reference.
    // `column` must be qualified (e.g. 'cr.customer_id') whenever the query joins
    // another table that also has a customer_id column — otherwise SQLite raises
    // "ambiguous column name". Pass leading:true to use this as the query's first
    // WHERE clause instead of an AND continuation.
    function exclusionClause(column, { leading = false } = {}) {
      if (excludeIds.length === 0) return '';
      return `${leading ? 'WHERE' : 'AND'} ${column} NOT IN (${excludeIds.map(() => '?').join(',')})`;
    }

    const exclCal   = exclusionClause('customer_id');
    // Same exclusion but qualified for queries that JOIN equipment (which also has customer_id) — avoids "ambiguous column" errors
    const exclCalCr = exclusionClause('cr.customer_id');
    const exclEq    = exclusionClause('e.customer_id');

    const totalCustomers = db.prepare(`SELECT COUNT(*) as count FROM customers ${exclusionClause('id', { leading: true })}`).get(...excludeIds).count;
    const totalEquipment = db.prepare(`SELECT COUNT(*) as count FROM equipment ${exclusionClause('customer_id', { leading: true })}`).get(...excludeIds).count;

    const latestCals = db.prepare(`
      SELECT cr.equipment_id, cr.next_calibration_date
      FROM calibration_records cr
      INNER JOIN (${LATEST_CAL_SUBQUERY}) latest ON cr.equipment_id = latest.equipment_id AND cr.calibration_date = latest.max_date
      ${exclusionClause('cr.customer_id', { leading: true })}
    `).all(...excludeIds);

    const today = new Date().toISOString().split('T')[0];
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const soonStr = soon.toISOString().split('T')[0];

    const overdue = latestCals.filter(r => r.next_calibration_date && r.next_calibration_date < today).length;
    const dueSoon = latestCals.filter(r => r.next_calibration_date && r.next_calibration_date >= today && r.next_calibration_date <= soonStr).length;

    const overdueList = db.prepare(`
      SELECT cr.*, e.equipment_name, e.serial_number, c.name as customer_name, c.state,
        julianday('now') - julianday(cr.next_calibration_date) as days_overdue
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      JOIN customers c ON c.id = cr.customer_id
      INNER JOIN (${LATEST_CAL_SUBQUERY}) latest ON cr.equipment_id = latest.equipment_id AND cr.calibration_date = latest.max_date
      WHERE cr.next_calibration_date < date('now') ${exclCalCr}
      ORDER BY cr.next_calibration_date ASC
      LIMIT 10
    `).all(...excludeIds);

    const dueSoonList = db.prepare(`
      SELECT cr.*, e.equipment_name, e.serial_number, c.name as customer_name, c.state,
        julianday(cr.next_calibration_date) - julianday('now') as days_until
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      JOIN customers c ON c.id = cr.customer_id
      INNER JOIN (${LATEST_CAL_SUBQUERY}) latest ON cr.equipment_id = latest.equipment_id AND cr.calibration_date = latest.max_date
      WHERE cr.next_calibration_date >= date('now') AND cr.next_calibration_date <= date('now', '+30 days') ${exclCalCr}
      ORDER BY cr.next_calibration_date ASC
      LIMIT 10
    `).all(...excludeIds);

    const recentCals = db.prepare(`
      SELECT cr.*, e.equipment_name, c.name as customer_name
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      JOIN customers c ON c.id = cr.customer_id
      WHERE 1=1 ${exclCalCr}
      ORDER BY cr.created_at DESC
      LIMIT 10
    `).all(...excludeIds);

    const prevYear = String(new Date().getFullYear() - 1); // 2025
    const curYear  = String(new Date().getFullYear());      // 2026
    const currentMonthNum = new Date().getMonth() + 1;

    // Calibrations completed this year, by month — YTD status tracking
    const monthlyCompleted = db.prepare(`
      SELECT CAST(strftime('%m', calibration_date) AS INTEGER) as month, COUNT(*) as count
      FROM calibration_records
      WHERE strftime('%Y', calibration_date) = ? ${exclCal}
      GROUP BY month ORDER BY month
    `).all(curYear, ...excludeIds);

    const ytdCompleted = monthlyCompleted.reduce((sum, m) => sum + m.count, 0);
    const currentMonthCompleted = monthlyCompleted.find(m => m.month === currentMonthNum)?.count || 0;

    // Full record list backing the YTD chart + cards — drill-down detail
    const ytdCompletedList = db.prepare(`
      SELECT cr.*, e.equipment_name, e.serial_number, c.name as customer_name, c.state
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      JOIN customers c ON c.id = cr.customer_id
      WHERE strftime('%Y', cr.calibration_date) = ? ${exclCalCr}
      ORDER BY cr.calibration_date DESC
    `).all(curYear, ...excludeIds);

    // Calibrations due this month (current year, current month) that are not yet completed
    const currentMonthDue = db.prepare(`
      SELECT COUNT(*) as count
      FROM calibration_records cr
      INNER JOIN (${LATEST_CAL_SUBQUERY}) latest ON cr.equipment_id = latest.equipment_id AND cr.calibration_date = latest.max_date
      WHERE strftime('%Y', cr.next_calibration_date) = ? AND strftime('%m', cr.next_calibration_date) = ?
        ${exclCalCr}
    `).get(curYear, String(currentMonthNum).padStart(2, '0'), ...excludeIds).count;

    const currentMonthDueList = db.prepare(`
      SELECT cr.*, e.equipment_name, e.serial_number, c.name as customer_name, c.state,
        julianday(cr.next_calibration_date) - julianday('now') as days_until
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      JOIN customers c ON c.id = cr.customer_id
      INNER JOIN (${LATEST_CAL_SUBQUERY}) latest ON cr.equipment_id = latest.equipment_id AND cr.calibration_date = latest.max_date
      WHERE strftime('%Y', cr.next_calibration_date) = ? AND strftime('%m', cr.next_calibration_date) = ?
        ${exclCalCr}
      ORDER BY cr.next_calibration_date ASC
    `).all(curYear, String(currentMonthNum).padStart(2, '0'), ...excludeIds);

    // Renewed: calibrated in prevYear AND already re-calibrated in curYear (keyed by prevYear month)
    const monthlyRenewed = db.prepare(`
      SELECT strftime('%m', calibration_date) as month, COUNT(DISTINCT customer_id) as count
      FROM calibration_records
      WHERE strftime('%Y', calibration_date) = ?
        AND customer_id IS NOT NULL
        ${exclCal}
        AND customer_id IN (
          SELECT DISTINCT customer_id FROM calibration_records
          WHERE strftime('%Y', calibration_date) = ? AND customer_id IS NOT NULL
        )
      GROUP BY month ORDER BY month
    `).all(prevYear, ...excludeIds, curYear);

    // Lost: calibrated in prevYear but NOT returned in curYear (keyed by prevYear month)
    const monthlyLost = db.prepare(`
      SELECT strftime('%m', calibration_date) as month, COUNT(DISTINCT customer_id) as count
      FROM calibration_records
      WHERE strftime('%Y', calibration_date) = ?
        AND customer_id IS NOT NULL
        ${exclCal}
        AND customer_id NOT IN (
          SELECT DISTINCT customer_id FROM calibration_records
          WHERE strftime('%Y', calibration_date) = ? AND customer_id IS NOT NULL
        )
      GROUP BY month ORDER BY month
    `).all(prevYear, ...excludeIds, curYear);

    // New: first calibrated in curYear, no prevYear record (keyed by curYear month)
    const monthlyNew = db.prepare(`
      SELECT strftime('%m', calibration_date) as month, COUNT(DISTINCT customer_id) as count
      FROM calibration_records
      WHERE strftime('%Y', calibration_date) = ?
        AND customer_id IS NOT NULL
        ${exclCal}
        AND customer_id NOT IN (
          SELECT DISTINCT customer_id FROM calibration_records
          WHERE strftime('%Y', calibration_date) = ? AND customer_id IS NOT NULL
        )
      GROUP BY month ORDER BY month
    `).all(curYear, ...excludeIds, prevYear);

    // Warranty (invoice-based): instruments invoiced in prevYear → warranty cal due curYear
    let monthlyWarranty = [];
    try {
      monthlyWarranty = db.prepare(`
        SELECT invoice_month as month, COUNT(*) as count
        FROM invoice_records
        WHERE invoice_year = ?
        GROUP BY invoice_month
        ORDER BY invoice_month
      `).all(Number(prevYear));
    } catch { /* invoice_records table may not exist yet */ }

    // Warranty (equipment-based): equipment with end_of_warranty expiring in curYear → calibration revenue opportunity
    const warrantyExpiring = db.prepare(`
      SELECT CAST(strftime('%m', end_of_warranty) AS INTEGER) as month, COUNT(*) as count
      FROM equipment
      WHERE strftime('%Y', end_of_warranty) = ?
      GROUP BY month ORDER BY month
    `).all(curYear);

    // Summary counts for cards
    const warrantyActive = db.prepare(`
      SELECT COUNT(*) as count FROM equipment WHERE end_of_warranty >= date('now')
    `).get().count;

    const warrantyExpiringThisYear = db.prepare(`
      SELECT COUNT(*) as count FROM equipment
      WHERE strftime('%Y', end_of_warranty) = ? AND end_of_warranty >= date('now')
    `).get(curYear).count;

    const equipmentByStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM equipment GROUP BY status
    `).all();

    const equipmentByType = db.prepare(`
      SELECT e.equipment_name, COUNT(*) as count
      FROM equipment e
      WHERE 1=1 ${exclEq}
      GROUP BY e.equipment_name
      ORDER BY count DESC
    `).all(...excludeIds);

    // Job code breakdown (CAL_A / CAL_B / SERV_A / SERV_B)
    const jobCodeSummary = db.prepare(`
      SELECT
        CASE
          WHEN notes LIKE 'Customer calibration%' THEN 'CAL_A'
          WHEN notes LIKE 'Internal/intercompany%' THEN 'CAL_B'
          WHEN notes LIKE 'Customer service%' THEN 'SERV_A'
          WHEN notes LIKE 'Internal service%' THEN 'SERV_B'
        END as code,
        COUNT(*) as count,
        ROUND(SUM(CASE WHEN fee IS NOT NULL THEN fee ELSE 0 END), 2) as revenue
      FROM calibration_records
      WHERE notes LIKE 'Customer calibration%'
         OR notes LIKE 'Internal/intercompany%'
         OR notes LIKE 'Customer service%'
         OR notes LIKE 'Internal service%'
      GROUP BY code
      ORDER BY count DESC
    `).all();

    // Yearly trend by job code
    const jobCodeByYear = db.prepare(`
      SELECT
        strftime('%Y', calibration_date) as year,
        CASE
          WHEN notes LIKE 'Customer calibration%' THEN 'CAL_A'
          WHEN notes LIKE 'Internal/intercompany%' THEN 'CAL_B'
          WHEN notes LIKE 'Customer service%' THEN 'SERV_A'
          WHEN notes LIKE 'Internal service%' THEN 'SERV_B'
        END as code,
        COUNT(*) as count
      FROM calibration_records
      WHERE (notes LIKE 'Customer calibration%'
         OR notes LIKE 'Internal/intercompany%'
         OR notes LIKE 'Customer service%'
         OR notes LIKE 'Internal service%')
        AND calibration_date IS NOT NULL
      GROUP BY year, code
      ORDER BY year, code
    `).all();

    res.json({
      totalCustomers,
      totalEquipment,
      overdue,
      dueSoon,
      overdueList,
      dueSoonList,
      recentCals,
      monthlyRenewed,
      monthlyLost,
      monthlyNew,
      monthlyWarranty,
      monthlyCompleted,
      ytdCompleted,
      ytdCompletedList,
      currentMonthCompleted,
      currentMonthDue,
      currentMonthDueList,
      currentMonthNum,
      warrantyExpiring,
      warrantyActive,
      warrantyExpiringThisYear,
      equipmentByStatus,
      equipmentByType,
      jobCodeSummary,
      jobCodeByYear,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/month-detail', (req, res) => {
  try {
    const db = getDb();
    const curYear  = String(new Date().getFullYear());
    const prevYear = String(new Date().getFullYear() - 1);
    const { month } = req.query; // e.g. '06'

    // Renewed: calibrated in this month of 2025 AND has a 2026 cal
    const renewed = db.prepare(`
      SELECT DISTINCT c.id, c.name, c.country,
        (SELECT MAX(calibration_date) FROM calibration_records WHERE customer_id = c.id AND strftime('%Y', calibration_date) = ?) as renewed_date
      FROM calibration_records cr
      JOIN customers c ON c.id = cr.customer_id
      WHERE strftime('%Y', cr.calibration_date) = ?
        AND strftime('%m', cr.calibration_date) = ?
        AND cr.customer_id IS NOT NULL
        AND cr.customer_id IN (
          SELECT DISTINCT customer_id FROM calibration_records
          WHERE strftime('%Y', calibration_date) = ? AND customer_id IS NOT NULL
        )
      ORDER BY c.name
    `).all(curYear, prevYear, month, curYear);

    // Lost: calibrated in this month of 2025 but NO 2026 cal
    const lost = db.prepare(`
      SELECT DISTINCT c.id, c.name, c.country,
        (SELECT MAX(calibration_date) FROM calibration_records WHERE customer_id = c.id AND strftime('%Y', calibration_date) = ?) as last_calibration_date
      FROM calibration_records cr
      JOIN customers c ON c.id = cr.customer_id
      WHERE strftime('%Y', cr.calibration_date) = ?
        AND strftime('%m', cr.calibration_date) = ?
        AND cr.customer_id IS NOT NULL
        AND cr.customer_id NOT IN (
          SELECT DISTINCT customer_id FROM calibration_records
          WHERE strftime('%Y', calibration_date) = ? AND customer_id IS NOT NULL
        )
      ORDER BY c.name
    `).all(prevYear, prevYear, month, curYear);

    // New: first time in 2026 this month, no 2025 record
    const newAccounts = db.prepare(`
      SELECT DISTINCT c.id, c.name, c.country,
        (SELECT MAX(calibration_date) FROM calibration_records WHERE customer_id = c.id AND strftime('%Y', calibration_date) = ?) as first_cal_date
      FROM calibration_records cr
      JOIN customers c ON c.id = cr.customer_id
      WHERE strftime('%Y', cr.calibration_date) = ?
        AND strftime('%m', cr.calibration_date) = ?
        AND cr.customer_id IS NOT NULL
        AND cr.customer_id NOT IN (
          SELECT DISTINCT customer_id FROM calibration_records
          WHERE strftime('%Y', calibration_date) = ? AND customer_id IS NOT NULL
        )
      ORDER BY c.name
    `).all(curYear, curYear, month, prevYear);

    // Warranty: instruments invoiced in prevYear for this month
    let warrantyItems = [];
    try {
      warrantyItems = db.prepare(`
        SELECT sell_to_no, family_decrip, item_description, quantity
        FROM invoice_records
        WHERE invoice_year = ? AND invoice_month = ?
        ORDER BY sell_to_no, family_decrip
      `).all(Number(prevYear), Number(month));
    } catch { /* table may not exist yet */ }

    res.json({ month, renewed, lost, newAccounts, warrantyItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Job code customer drill-down
router.get('/jobcode-customers', (req, res) => {
  try {
    const db = getDb();
    const { code } = req.query; // CAL_A | CAL_B | SERV_A | SERV_B

    const PATTERNS = {
      CAL_A:  'Customer calibration%',
      CAL_B:  'Internal/intercompany%',
      SERV_A: 'Customer service%',
      SERV_B: 'Internal service%',
    };

    const pattern = PATTERNS[code];
    if (!pattern) return res.status(400).json({ error: 'Invalid code' });

    const customers = db.prepare(`
      SELECT c.id, c.name, c.country, c.state,
        COUNT(*) as job_count,
        ROUND(SUM(CASE WHEN cr.fee IS NOT NULL THEN cr.fee ELSE 0 END), 2) as revenue,
        MAX(cr.calibration_date) as last_date
      FROM calibration_records cr
      JOIN customers c ON c.id = cr.customer_id
      WHERE cr.notes LIKE ?
      GROUP BY c.id, c.name, c.country, c.state
      ORDER BY job_count DESC, revenue DESC
    `).all(pattern);

    res.json({ code, customers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Equipment type drill-down: customers + serial numbers for a given type
router.get('/equipment-type-detail', (req, res) => {
  try {
    const db = getDb();
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name required' });

    const items = db.prepare(`
      SELECT
        e.id as equipment_id, e.equipment_name, e.model, e.serial_number,
        e.modules, e.accessories, e.status,
        c.id as customer_id, c.name as customer_name, c.country, c.state,
        (SELECT MAX(calibration_date) FROM calibration_records cr WHERE cr.equipment_id = e.id) as last_cal,
        (SELECT next_calibration_date FROM calibration_records cr
         WHERE cr.equipment_id = e.id
         ORDER BY calibration_date DESC LIMIT 1) as next_cal
      FROM equipment e
      JOIN customers c ON c.id = e.customer_id
      WHERE e.equipment_name = ?
      ORDER BY c.name, e.serial_number
    `).all(name);

    res.json({ name, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
