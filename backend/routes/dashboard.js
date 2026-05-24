const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/stats', (req, res) => {
  try {
    const db = getDb();

    const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
    const totalEquipment = db.prepare('SELECT COUNT(*) as count FROM equipment').get().count;

    const latestCals = db.prepare(`
      SELECT cr.equipment_id, cr.next_calibration_date
      FROM calibration_records cr
      INNER JOIN (
        SELECT equipment_id, MAX(calibration_date) as max_date
        FROM calibration_records
        GROUP BY equipment_id
      ) latest ON cr.equipment_id = latest.equipment_id AND cr.calibration_date = latest.max_date
    `).all();

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
      INNER JOIN (
        SELECT equipment_id, MAX(calibration_date) as max_date FROM calibration_records GROUP BY equipment_id
      ) latest ON cr.equipment_id = latest.equipment_id AND cr.calibration_date = latest.max_date
      WHERE cr.next_calibration_date < date('now')
      ORDER BY cr.next_calibration_date ASC
      LIMIT 10
    `).all();

    const dueSoonList = db.prepare(`
      SELECT cr.*, e.equipment_name, e.serial_number, c.name as customer_name, c.state,
        julianday(cr.next_calibration_date) - julianday('now') as days_until
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      JOIN customers c ON c.id = cr.customer_id
      INNER JOIN (
        SELECT equipment_id, MAX(calibration_date) as max_date FROM calibration_records GROUP BY equipment_id
      ) latest ON cr.equipment_id = latest.equipment_id AND cr.calibration_date = latest.max_date
      WHERE cr.next_calibration_date >= date('now') AND cr.next_calibration_date <= date('now', '+30 days')
      ORDER BY cr.next_calibration_date ASC
      LIMIT 10
    `).all();

    const recentCals = db.prepare(`
      SELECT cr.*, e.equipment_name, c.name as customer_name
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      JOIN customers c ON c.id = cr.customer_id
      ORDER BY cr.created_at DESC
      LIMIT 10
    `).all();

    const monthlyData = db.prepare(`
      SELECT strftime('%Y-%m', calibration_date) as month, COUNT(*) as count
      FROM calibration_records
      WHERE calibration_date >= date('now', '-12 months')
      GROUP BY month
      ORDER BY month
    `).all();

    const equipmentByStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM equipment GROUP BY status
    `).all();

    const equipmentByType = db.prepare(`
      SELECT equipment_name, COUNT(*) as count
      FROM equipment
      GROUP BY equipment_name
      ORDER BY count DESC
    `).all();

    res.json({
      totalCustomers,
      totalEquipment,
      overdue,
      dueSoon,
      overdueList,
      dueSoonList,
      recentCals,
      monthlyData,
      equipmentByStatus,
      equipmentByType,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
