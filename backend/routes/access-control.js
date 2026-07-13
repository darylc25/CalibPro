const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { requireAdmin } = require('../middleware/auth');

// GET password policy
router.get('/password-policy', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const policy = db.prepare('SELECT * FROM password_policy WHERE id = 1').get();
    res.json(policy || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT password policy
router.put('/password-policy', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { min_length, require_digit, require_lowercase, require_uppercase, require_symbol, prevent_reuse_count, lockout_attempts, lockout_duration } = req.body;
    db.prepare(`
      UPDATE password_policy SET
        min_length=?, require_digit=?, require_lowercase=?, require_uppercase=?,
        require_symbol=?, prevent_reuse_count=?, lockout_attempts=?, lockout_duration=?
      WHERE id=1
    `).run(
      min_length || 8,
      require_digit ? 1 : 0,
      require_lowercase ? 1 : 0,
      require_uppercase ? 1 : 0,
      require_symbol ? 1 : 0,
      prevent_reuse_count || 0,
      lockout_attempts || 5,
      lockout_duration || 30
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET role permissions
router.get('/role-permissions', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const perms = db.prepare('SELECT * FROM role_permissions ORDER BY role, menu').all();
    res.json(perms);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT role permissions (bulk upsert)
router.put('/role-permissions', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { permissions } = req.body;
    const upsert = db.prepare(`
      INSERT INTO role_permissions (role, menu, can_view, can_add, can_edit, can_delete)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(role, menu) DO UPDATE SET
        can_view=excluded.can_view, can_add=excluded.can_add,
        can_edit=excluded.can_edit, can_delete=excluded.can_delete
    `);
    const tx = db.transaction(() => {
      for (const p of permissions) {
        upsert.run(p.role, p.menu, p.can_view ? 1 : 0, p.can_add ? 1 : 0, p.can_edit ? 1 : 0, p.can_delete ? 1 : 0);
      }
    });
    tx();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
