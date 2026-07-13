const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// POST /api/delete-requests — any logged-in user can submit
router.post('/', requireAuth, (req, res) => {
  const { record_type, record_id, record_label, reason } = req.body;
  if (!record_type || !record_id || !reason?.trim()) {
    return res.status(400).json({ error: 'record_type, record_id and reason are required' });
  }
  const db = getDb();

  // Check for existing pending/in_review request for same record
  const existing = db.prepare(
    "SELECT id FROM delete_requests WHERE record_type=? AND record_id=? AND status IN ('pending','in_review')"
  ).get(record_type, record_id);
  if (existing) return res.status(400).json({ error: 'A deletion request for this record is already pending' });

  const result = db.prepare(`
    INSERT INTO delete_requests (requested_by_id, requested_by_name, record_type, record_id, record_label, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, req.user.name || req.user.username, record_type, record_id, record_label || '', reason.trim());

  // Telegram notification (best-effort)
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (token && chatId) {
      const text = `🗑️ <b>Deletion Request</b>\nFrom: ${req.user.name || req.user.username}\nType: ${record_type} — <b>${record_label}</b>\nReason: ${reason.trim()}\n\nOpen CalibPro to review.`;
      require('node-fetch')(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      }).catch(() => {});
    }
  } catch {}

  res.json({ id: result.lastInsertRowid, success: true });
});

// GET /api/delete-requests — admin sees all, others see own
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  if (req.user.role === 'admin') {
    const rows = db.prepare('SELECT * FROM delete_requests ORDER BY created_at DESC').all();
    return res.json(rows);
  }
  const rows = db.prepare('SELECT * FROM delete_requests WHERE requested_by_id=? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows);
});

// GET /api/delete-requests/pending-count — admin badge
router.get('/pending-count', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.json({ count: 0 });
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as c FROM delete_requests WHERE status='pending'").get();
  res.json({ count: row.c });
});

// PUT /api/delete-requests/:id — admin reviews
router.put('/:id', requireAdmin, (req, res) => {
  const { status, admin_response } = req.body;
  if (!['pending', 'in_review', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const db = getDb();
  const req_row = db.prepare('SELECT * FROM delete_requests WHERE id=?').get(req.params.id);
  if (!req_row) return res.status(404).json({ error: 'Request not found' });

  db.prepare(`UPDATE delete_requests SET status=?, admin_response=?, reviewed_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(status, admin_response || null, req.user.name || req.user.username, req.params.id);

  // If approved, perform the actual deletion
  if (status === 'approved') {
    try {
      if (req_row.record_type === 'customer') {
        db.prepare('DELETE FROM customers WHERE id=?').run(req_row.record_id);
      } else if (req_row.record_type === 'equipment') {
        db.prepare('DELETE FROM equipment WHERE id=?').run(req_row.record_id);
      } else if (req_row.record_type === 'calibration') {
        db.prepare('DELETE FROM calibration_records WHERE id=?').run(req_row.record_id);
      }
    } catch (e) {
      return res.status(500).json({ error: 'Approved but deletion failed: ' + e.message });
    }
  }

  res.json({ success: true });
});

module.exports = router;
