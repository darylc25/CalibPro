const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { logAudit } = require('../utils/audit');

const BASE_QUERY = `
  SELECT cr.*,
    e.equipment_name, e.model, e.serial_number, e.modules, e.brand,
    c.name as customer_name, c.state, c.country, c.contact_person, c.phone, c.email, c.customer_type
  FROM calibration_records cr
  JOIN equipment e ON e.id = cr.equipment_id
  JOIN customers c ON c.id = cr.customer_id
`;

router.get('/', (req, res) => {
  try {
    const records = getDb().prepare(BASE_QUERY + ' ORDER BY cr.calibration_date DESC').all();
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/due', (req, res) => {
  try {
    const records = getDb().prepare(BASE_QUERY + `
      WHERE cr.next_calibration_date >= date('now') AND cr.next_calibration_date <= date('now', '+30 days')
      ORDER BY cr.next_calibration_date
    `).all();
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/overdue', (req, res) => {
  try {
    const records = getDb().prepare(BASE_QUERY + `
      WHERE cr.next_calibration_date < date('now') ORDER BY cr.next_calibration_date
    `).all();
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { equipment_id, customer_id, calibration_date, next_calibration_date,
      performed_by, cal_report_status, quotation_sent, job_sheet_number,
      notes, service_type, fee, currency } = req.body;

    if (!equipment_id || !calibration_date)
      return res.status(400).json({ error: 'equipment_id and calibration_date are required' });

    let nextCal = next_calibration_date;
    if (!nextCal && calibration_date) {
      const d = new Date(calibration_date);
      d.setFullYear(d.getFullYear() + 1);
      nextCal = d.toISOString().split('T')[0];
    }

    const result = db.prepare(`
      INSERT INTO calibration_records (equipment_id, customer_id, calibration_date, next_calibration_date,
        performed_by, cal_report_status, quotation_sent, job_sheet_number, notes, service_type, fee, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(equipment_id, customer_id, calibration_date, nextCal,
      performed_by, cal_report_status, quotation_sent ? 1 : 0, job_sheet_number,
      notes, service_type || 'Calibration', fee, currency || 'MYR');

    const record = db.prepare(BASE_QUERY + ' WHERE cr.id = ?').get(result.lastInsertRowid);
    logAudit(db, req.user, 'CREATE', 'calibration_records', record.id,
      `${record.equipment_name} — ${record.calibration_date}`, null, record);
    res.status(201).json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const old = db.prepare('SELECT * FROM calibration_records WHERE id = ?').get(req.params.id);
    const { equipment_id, customer_id, calibration_date, next_calibration_date,
      performed_by, cal_report_status, quotation_sent, job_sheet_number,
      notes, service_type, fee, currency } = req.body;

    let nextCal = next_calibration_date;
    if (!nextCal && calibration_date) {
      const d = new Date(calibration_date);
      d.setFullYear(d.getFullYear() + 1);
      nextCal = d.toISOString().split('T')[0];
    }

    db.prepare(`
      UPDATE calibration_records SET equipment_id=?, customer_id=?, calibration_date=?, next_calibration_date=?,
        performed_by=?, cal_report_status=?, quotation_sent=?, job_sheet_number=?, notes=?, service_type=?, fee=?, currency=?
      WHERE id=?
    `).run(equipment_id, customer_id, calibration_date, nextCal,
      performed_by, cal_report_status, quotation_sent ? 1 : 0, job_sheet_number,
      notes, service_type, fee, currency, req.params.id);

    const record = db.prepare(BASE_QUERY + ' WHERE cr.id = ?').get(req.params.id);
    logAudit(db, req.user, 'UPDATE', 'calibration_records', record.id,
      `${record.equipment_name} — ${record.calibration_date}`, old, record);
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const old = db.prepare(BASE_QUERY + ' WHERE cr.id = ?').get(req.params.id);
    db.prepare('DELETE FROM calibration_records WHERE id = ?').run(req.params.id);
    logAudit(db, req.user, 'DELETE', 'calibration_records', req.params.id,
      old ? `${old.equipment_name} — ${old.calibration_date}` : `#${req.params.id}`, old, null);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
