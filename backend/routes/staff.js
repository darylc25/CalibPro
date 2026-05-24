const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const staff = db.prepare('SELECT * FROM staff ORDER BY name').all();
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
    res.status(201).json(db.prepare('SELECT * FROM staff WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, email, phone, role, department, active } = req.body;
    db.prepare(`
      UPDATE staff SET name=?, email=?, phone=?, role=?, department=?, active=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(name, email, phone, role, department, active ? 1 : 0, req.params.id);
    res.json(db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
