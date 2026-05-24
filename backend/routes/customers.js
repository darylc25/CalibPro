const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const customers = db.prepare(`
      SELECT c.*,
        COUNT(DISTINCT e.id) as equipment_count,
        MAX(cr.calibration_date) as last_service,
        MIN(CASE WHEN cr.next_calibration_date >= date('now') THEN cr.next_calibration_date END) as next_due
      FROM customers c
      LEFT JOIN equipment e ON e.customer_id = c.id
      LEFT JOIN calibration_records cr ON cr.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `).all();
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const equipment = db.prepare(`
      SELECT e.*,
        MAX(cr.calibration_date) as last_cal,
        MAX(cr.next_calibration_date) as next_cal
      FROM equipment e
      LEFT JOIN calibration_records cr ON cr.equipment_id = e.id
      WHERE e.customer_id = ?
      GROUP BY e.id
    `).all(req.params.id);

    const calibrations = db.prepare(`
      SELECT cr.*, e.equipment_name, e.serial_number
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      WHERE cr.customer_id = ?
      ORDER BY cr.calibration_date DESC
    `).all(req.params.id);

    res.json({ ...customer, equipment, calibrations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, contact_person, email, phone, address, location, state } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = db.prepare(`
      INSERT INTO customers (name, contact_person, email, phone, address, location, state)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, contact_person, email, phone, address, location, state);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, contact_person, email, phone, address, location, state } = req.body;
    db.prepare(`
      UPDATE customers SET name=?, contact_person=?, email=?, phone=?, address=?, location=?, state=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(name, contact_person, email, phone, address, location, state, req.params.id);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
