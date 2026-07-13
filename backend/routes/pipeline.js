const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// Summary stats for all dealer accounts
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const curYear  = String(new Date().getFullYear());
    const prevYear = String(new Date().getFullYear() - 1);
    const today    = new Date().toISOString().split('T')[0];

    const dealers = db.prepare(`SELECT id, name FROM customers WHERE customer_type = 'Dealer'`).all();
    if (dealers.length === 0) return res.json({ dealers: [], summary: {} });

    const dealerIds = dealers.map(d => d.id);
    const placeholders = dealerIds.map(() => '?').join(',');

    const totalEquipment = db.prepare(
      `SELECT COUNT(*) as count FROM equipment WHERE customer_id IN (${placeholders})`
    ).get(...dealerIds).count;

    const calThisYear = db.prepare(
      `SELECT COUNT(*) as count FROM calibration_records
       WHERE customer_id IN (${placeholders}) AND strftime('%Y', calibration_date) = ?`
    ).get(...dealerIds, curYear).count;

    const calLastYear = db.prepare(
      `SELECT COUNT(*) as count FROM calibration_records
       WHERE customer_id IN (${placeholders}) AND strftime('%Y', calibration_date) = ?`
    ).get(...dealerIds, prevYear).count;

    const revenueThisYear = db.prepare(
      `SELECT ROUND(SUM(COALESCE(fee, 0)), 2) as total FROM calibration_records
       WHERE customer_id IN (${placeholders}) AND strftime('%Y', calibration_date) = ?`
    ).get(...dealerIds, curYear).total || 0;

    const warrantyActive = db.prepare(
      `SELECT COUNT(*) as count FROM equipment WHERE customer_id IN (${placeholders}) AND end_of_warranty >= ?`
    ).get(...dealerIds, today).count;

    const warrantyExpiringThisYear = db.prepare(
      `SELECT COUNT(*) as count FROM equipment
       WHERE customer_id IN (${placeholders}) AND strftime('%Y', end_of_warranty) = ? AND end_of_warranty >= ?`
    ).get(...dealerIds, curYear, today).count;

    const warrantyExpiredRecent = db.prepare(
      `SELECT COUNT(*) as count FROM equipment
       WHERE customer_id IN (${placeholders}) AND end_of_warranty < ? AND end_of_warranty >= date(?, '-1 year')`
    ).get(...dealerIds, today, today).count;

    // Per-dealer breakdown
    const perDealer = dealers.map(d => {
      const eq = db.prepare(`SELECT COUNT(*) as count FROM equipment WHERE customer_id = ?`).get(d.id).count;
      const cal = db.prepare(
        `SELECT COUNT(*) as count, ROUND(SUM(COALESCE(fee,0)),2) as revenue
         FROM calibration_records WHERE customer_id = ? AND strftime('%Y', calibration_date) = ?`
      ).get(d.id, curYear);
      const wActive = db.prepare(
        `SELECT COUNT(*) as count FROM equipment WHERE customer_id = ? AND end_of_warranty >= ?`
      ).get(d.id, today).count;
      return { id: d.id, name: d.name, equipment: eq, calThisYear: cal.count, revenueThisYear: cal.revenue || 0, warrantyActive: wActive };
    });

    // Equipment list with warranty info — prime conversion targets
    const equipmentList = db.prepare(`
      SELECT e.id, e.equipment_name, e.model, e.serial_number, e.brand, e.end_of_warranty, e.status,
        c.id as customer_id, c.name as customer_name, c.country, c.state,
        (SELECT MAX(calibration_date) FROM calibration_records cr WHERE cr.equipment_id = e.id) as last_cal,
        (SELECT next_calibration_date FROM calibration_records cr WHERE cr.equipment_id = e.id
         ORDER BY calibration_date DESC LIMIT 1) as next_cal
      FROM equipment e
      JOIN customers c ON c.id = e.customer_id
      WHERE c.customer_type = 'Dealer'
      ORDER BY e.end_of_warranty ASC NULLS LAST, c.name, e.equipment_name
    `).all();

    // Monthly cal volume for trend chart (last 12 months)
    const monthlyTrend = db.prepare(`
      SELECT strftime('%Y-%m', calibration_date) as month, COUNT(*) as count
      FROM calibration_records
      WHERE customer_id IN (${placeholders})
        AND calibration_date >= date('now', '-12 months')
      GROUP BY month ORDER BY month
    `).all(...dealerIds);

    res.json({
      dealers: perDealer,
      summary: { totalEquipment, calThisYear, calLastYear, revenueThisYear, warrantyActive, warrantyExpiringThisYear, warrantyExpiredRecent },
      equipmentList,
      monthlyTrend,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
