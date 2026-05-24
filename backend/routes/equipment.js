const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const equipment = db.prepare(`
      SELECT e.*,
        c.name as customer_name,
        c.state as customer_state,
        c.contact_person,
        c.phone,
        c.email,
        MAX(cr.calibration_date) as last_cal,
        MAX(cr.next_calibration_date) as next_cal
      FROM equipment e
      LEFT JOIN customers c ON c.id = e.customer_id
      LEFT JOIN calibration_records cr ON cr.equipment_id = e.id
      GROUP BY e.id
      ORDER BY c.name, e.equipment_name
    `).all();
    res.json(equipment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const eq = db.prepare(`
      SELECT e.*, c.name as customer_name, c.state as customer_state
      FROM equipment e
      LEFT JOIN customers c ON c.id = e.customer_id
      WHERE e.id = ?
    `).get(req.params.id);
    if (!eq) return res.status(404).json({ error: 'Equipment not found' });

    const calibrations = db.prepare(`
      SELECT * FROM calibration_records WHERE equipment_id = ? ORDER BY calibration_date DESC
    `).all(req.params.id);

    res.json({ ...eq, calibrations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      customer_id, equipment_name, model, serial_number, cal_code, modules,
      status, warranty_period, installation_date, end_of_warranty,
      location, accessories, software_version, otoaccess_version, remarks
    } = req.body;
    if (!equipment_name) return res.status(400).json({ error: 'Equipment name is required' });
    const result = db.prepare(`
      INSERT INTO equipment (customer_id, equipment_name, model, serial_number, cal_code, modules, status,
        warranty_period, installation_date, end_of_warranty, location, accessories, software_version, otoaccess_version, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customer_id, equipment_name, model, serial_number, cal_code, modules, status || 'Active',
      warranty_period, installation_date, end_of_warranty, location, accessories, software_version, otoaccess_version, remarks);
    const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(eq);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const {
      customer_id, equipment_name, model, serial_number, cal_code, modules,
      status, warranty_period, installation_date, end_of_warranty,
      location, accessories, software_version, otoaccess_version, remarks
    } = req.body;
    db.prepare(`
      UPDATE equipment SET customer_id=?, equipment_name=?, model=?, serial_number=?, cal_code=?, modules=?,
        status=?, warranty_period=?, installation_date=?, end_of_warranty=?, location=?, accessories=?,
        software_version=?, otoaccess_version=?, remarks=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(customer_id, equipment_name, model, serial_number, cal_code, modules, status,
      warranty_period, installation_date, end_of_warranty, location, accessories,
      software_version, otoaccess_version, remarks, req.params.id);
    const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
    res.json(eq);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM equipment WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
