const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { logAudit } = require('../utils/audit');

// Returns engineers and admin_assist users as the "staff" list
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const staff = db.prepare(`
      SELECT id, username, name, role, position, email, phone, active, created_at
      FROM users
      WHERE role IN ('engineer', 'admin_assist') AND active = 1
      ORDER BY name
    `).all();
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const member = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    if (!member) return res.status(404).json({ error: 'Staff not found' });
    res.json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, email, phone, role, department, active } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = db.prepare(`
      INSERT INTO staff (name, email, phone, role, department, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, email, phone, role || 'Technician', department, active !== undefined ? active : 1);
    const member = db.prepare('SELECT * FROM staff WHERE id = ?').get(result.lastInsertRowid);
    logAudit(db, req.user, 'CREATE', 'staff', member.id, name, null, member);
    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const old = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    const { name, email, phone, role, department, active } = req.body;
    db.prepare(`
      UPDATE staff SET name=?, email=?, phone=?, role=?, department=?, active=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(name, email, phone, role, department, active ? 1 : 0, req.params.id);
    const updated = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    logAudit(db, req.user, 'UPDATE', 'staff', updated.id, name, old, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const member = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
    if (member) logAudit(db, req.user, 'DELETE', 'staff', req.params.id, member.name, member, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
