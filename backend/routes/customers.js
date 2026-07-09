const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { logAudit } = require('../utils/audit');

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
  } catch (err) { console.error('[customers GET /]', err); res.status(500).json({ error: err.message }); }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const equipment = db.prepare(`
      SELECT e.*, MAX(cr.calibration_date) as last_cal, MAX(cr.next_calibration_date) as next_cal
      FROM equipment e
      LEFT JOIN calibration_records cr ON cr.equipment_id = e.id
      WHERE e.customer_id = ? GROUP BY e.id
    `).all(req.params.id);
    const calibrations = db.prepare(`
      SELECT cr.*, e.equipment_name, e.serial_number
      FROM calibration_records cr JOIN equipment e ON e.id = cr.equipment_id
      WHERE cr.customer_id = ? ORDER BY cr.calibration_date DESC
    `).all(req.params.id);
    res.json({ ...customer, equipment, calibrations });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, contact_person, email, phone, address, address_2, city_postcode, location, state, country } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = db.prepare(
      'INSERT INTO customers (name, contact_person, email, phone, address, address_2, city_postcode, location, state, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, contact_person, email, phone, address, address_2, city_postcode, location, state, country);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    logAudit(db, req.user, 'CREATE', 'customers', customer.id, name, null, customer);
    res.status(201).json(customer);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const old = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    const { name, contact_person, email, phone, address, address_2, city_postcode, location, state, country } = req.body;
    db.prepare(
      'UPDATE customers SET name=?, contact_person=?, email=?, phone=?, address=?, address_2=?, city_postcode=?, location=?, state=?, country=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(name, contact_person, email, phone, address, address_2, city_postcode, location, state, country, req.params.id);
    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    logAudit(db, req.user, 'UPDATE', 'customers', updated.id, name, old, updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Flip customer_type between Direct and Dealer
router.patch('/:id/type', (req, res) => {
  try {
    const db = getDb();
    const { customer_type } = req.body;
    if (!['Direct', 'Dealer'].includes(customer_type))
      return res.status(400).json({ error: 'customer_type must be Direct or Dealer' });
    const old = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'Customer not found' });
    db.prepare('UPDATE customers SET customer_type=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(customer_type, req.params.id);
    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    logAudit(db, req.user, 'UPDATE', 'customers', updated.id, `${old.name} type → ${customer_type}`, old, updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const old = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    logAudit(db, req.user, 'DELETE', 'customers', req.params.id, old?.name, old, null);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
