const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { logAudit } = require('../utils/audit');

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const equipment = db.prepare(`
      SELECT e.*,
        c.name as customer_name,
        c.state as customer_state,
        c.country as customer_country,
        c.customer_type,
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
        warranty_period, installation_date, end_of_warranty, location, accessories, software_version, otoaccess_version,
        end_user_name, end_user_contact, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customer_id, equipment_name, model, serial_number, cal_code, modules, status || 'Active',
      warranty_period, installation_date, end_of_warranty, location, accessories, software_version, otoaccess_version,
      req.body.end_user_name || null, req.body.end_user_contact || null, remarks);
    const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(result.lastInsertRowid);
    logAudit(db, req.user, 'CREATE', 'equipment', eq.id, `${equipment_name} (${serial_number || 'No S/N'})`, null, eq);
    res.status(201).json(eq);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const old = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
    const {
      customer_id, equipment_name, model, serial_number, cal_code, modules,
      status, warranty_period, installation_date, end_of_warranty,
      location, accessories, software_version, otoaccess_version, remarks
    } = req.body;
    db.prepare(`
      UPDATE equipment SET customer_id=?, equipment_name=?, model=?, serial_number=?, cal_code=?, modules=?,
        status=?, warranty_period=?, installation_date=?, end_of_warranty=?, location=?, accessories=?,
        software_version=?, otoaccess_version=?, end_user_name=?, end_user_contact=?,
        remarks=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(customer_id, equipment_name, model, serial_number, cal_code, modules, status,
      warranty_period, installation_date, end_of_warranty, location, accessories,
      software_version, otoaccess_version,
      req.body.end_user_name || null, req.body.end_user_contact || null,
      remarks, req.params.id);
    const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
    logAudit(db, req.user, 'UPDATE', 'equipment', eq.id, `${equipment_name} (${serial_number || 'No S/N'})`, old, eq);
    res.json(eq);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM equipment WHERE id = ?').run(req.params.id);
    if (eq) logAudit(db, req.user, 'DELETE', 'equipment', req.params.id, `${eq.equipment_name} (${eq.serial_number || 'No S/N'})`, eq, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Transfer single equipment to another customer
// body: { target_customer_id, transfer_note, remove_original }
router.post('/:id/transfer', (req, res) => {
  try {
    const db = getDb();
    const { target_customer_id, transfer_note, remove_original } = req.body;
    if (!target_customer_id) return res.status(400).json({ error: 'target_customer_id required' });

    const eq = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id);
    if (!eq) return res.status(404).json({ error: 'Equipment not found' });

    const fromCustomer = db.prepare('SELECT name FROM customers WHERE id = ?').get(eq.customer_id);
    const toCustomer   = db.prepare('SELECT name FROM customers WHERE id = ?').get(target_customer_id);
    if (!toCustomer) return res.status(404).json({ error: 'Target customer not found' });

    const note = transfer_note || `Transferred from ${fromCustomer?.name || eq.customer_id} to ${toCustomer.name}`;

    db.prepare(`
      UPDATE equipment
      SET customer_id = ?, transferred_from = ?, transfer_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(target_customer_id, eq.customer_id, note, eq.id);

    // Move calibration records' customer_id too so reports stay accurate
    db.prepare(`UPDATE calibration_records SET customer_id = ? WHERE equipment_id = ?`)
      .run(target_customer_id, eq.id);

    logAudit(db, req.user, 'TRANSFER', 'equipment', eq.id,
      `${eq.equipment_name} (${eq.serial_number || 'No S/N'}) → ${toCustomer.name}`, eq,
      { ...eq, customer_id: target_customer_id });

    res.json({ success: true, transfer_note: note });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch-transfer ALL equipment from one customer to another
// body: { from_customer_id, target_customer_id, transfer_note }
router.post('/batch-transfer', (req, res) => {
  try {
    const db = getDb();
    const { from_customer_id, target_customer_id, transfer_note } = req.body;
    if (!from_customer_id || !target_customer_id)
      return res.status(400).json({ error: 'from_customer_id and target_customer_id required' });

    const fromC = db.prepare('SELECT name FROM customers WHERE id = ?').get(from_customer_id);
    const toC   = db.prepare('SELECT name FROM customers WHERE id = ?').get(target_customer_id);
    if (!fromC || !toC) return res.status(404).json({ error: 'Customer not found' });

    const note = transfer_note || `Batch transferred from ${fromC.name} to ${toC.name}`;

    const equipmentList = db.prepare('SELECT id FROM equipment WHERE customer_id = ?').all(from_customer_id);

    const updateEq  = db.prepare(`UPDATE equipment SET customer_id=?, transferred_from=?, transfer_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`);
    const updateCal = db.prepare(`UPDATE calibration_records SET customer_id=? WHERE equipment_id=?`);

    db.transaction(() => {
      for (const { id } of equipmentList) {
        updateEq.run(target_customer_id, from_customer_id, note, id);
        updateCal.run(target_customer_id, id);
      }
    })();

    logAudit(db, req.user, 'BATCH_TRANSFER', 'equipment', null,
      `${equipmentList.length} items from ${fromC.name} → ${toC.name}`, null, { count: equipmentList.length });

    res.json({ success: true, transferred: equipmentList.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
