const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/audit — all audit logs (newest first), admin only
router.get('/', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  try {
    const db = getDb();
    const { table, user, limit = 100, offset = 0 } = req.query;
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];
    if (table) { sql += ' AND table_name = ?'; params.push(table); }
    if (user)  { sql += ' AND username = ?';   params.push(user); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const logs = db.prepare(sql).all(...params);
    const total = db.prepare('SELECT COUNT(*) as c FROM audit_log').get().c;
    res.json({ logs, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
