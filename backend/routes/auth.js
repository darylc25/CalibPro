const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb } = require('../database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendMail } = require('../services/mailer');

function generateTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (s) => s[crypto.randomInt(s.length)];
  return pick(upper) + pick(upper) + pick(lower) + pick(lower) +
         pick(digits) + pick(digits) + pick(upper) + pick(lower) + '!';
}

const JWT_SECRET = process.env.JWT_SECRET || 'calibpro-jwt-secret-2025';

const ALL_PERMISSIONS = { can_edit: true, can_delete: true, can_audit: true, can_send_report: true };
const DEFAULT_PERMISSIONS = { can_edit: false, can_delete: false, can_audit: false, can_send_report: false };

// Default permissions granted when a role is first created (can still be overridden individually)
const ROLE_DEFAULTS = {
  administrator: ALL_PERMISSIONS,
  engineer:      { can_edit: true,  can_delete: false, can_audit: false, can_send_report: false },
  admin_assist:  { can_edit: true,  can_delete: false, can_audit: true,  can_send_report: true  },
  viewer:        { can_edit: false, can_delete: false, can_audit: false, can_send_report: false },
};

function parsePermissions(user) {
  if (user.role === 'administrator') return ALL_PERMISSIONS;
  if (!user.permissions) return { ...DEFAULT_PERMISSIONS };
  try { return { ...DEFAULT_PERMISSIONS, ...JSON.parse(user.permissions) }; }
  catch { return { ...DEFAULT_PERMISSIONS }; }
}

function buildUserPayload(user) {
  const permissions = parsePermissions(user);
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    permissions,
  };
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const payload = buildUserPayload(user);
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: payload, must_change_password: user.must_change_password === 1 });
});

// GET /api/auth/me — verify token and return user
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/users — list all users (admin only)
router.get('/users', requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, username, role, name, active, permissions, position, email, phone, created_at FROM users ORDER BY id').all();
  res.json(users.map(u => ({
    ...u,
    permissions: parsePermissions(u),
  })));
});

// POST /api/auth/users — create user (admin only)
router.post('/users', requireAdmin, async (req, res) => {
  const { username, role, name, email, permissions } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  if (!['administrator', 'engineer', 'admin_assist', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const db = getDb();
  try {
    const tempPassword = generateTempPassword();
    const hash = bcrypt.hashSync(tempPassword, 10);
    const roleDefaults = ROLE_DEFAULTS[role] || DEFAULT_PERMISSIONS;
    const permJson = role === 'administrator' ? null : JSON.stringify({ ...roleDefaults, ...(permissions || {}) });

    const result = db.prepare(
      'INSERT INTO users (username, password_hash, role, name, email, permissions, must_change_password) VALUES (?, ?, ?, ?, ?, ?, 1)'
    ).run(username.trim(), hash, role, name || username, email || null, permJson);

    // Send welcome email if email provided
    if (email) {
      const appUrl = process.env.APP_URL || 'https://friendly-patience-production-6fdc.up.railway.app';
      const roleLabel = { administrator: 'Administrator', engineer: 'Engineer', admin_assist: 'Admin Assistant', viewer: 'Viewer' }[role] || role;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #333;">
          <div style="background: #4A86C8; padding: 24px 32px; border-radius: 8px 8px 0 0;">
            <img src="https://dmadminpanelstrapiprod15.blob.core.windows.net/strapi-uploads/assets/Diatec_logo_2e83ff14b9.png"
                 alt="Diatec" style="height: 36px; filter: brightness(0) invert(1);" />
          </div>
          <div style="background: #f9f9f9; padding: 32px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1A3C7A; margin-top: 0;">Welcome to Diatec Tech &amp; Support</h2>
            <p>Hi <strong>${name || username}</strong>,</p>
            <p>Your account has been created. Here are your login details:</p>

            <table style="background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 16px 20px; width: 100%; margin: 16px 0;">
              <tr><td style="color: #666; padding: 4px 0; width: 140px;">Username</td><td><strong>${username}</strong></td></tr>
              <tr><td style="color: #666; padding: 4px 0;">Temporary Password</td><td><strong style="font-family: monospace; font-size: 16px; color: #1A3C7A;">${tempPassword}</strong></td></tr>
              <tr><td style="color: #666; padding: 4px 0;">Role</td><td>${roleLabel}</td></tr>
            </table>

            <a href="${appUrl}" style="display: inline-block; background: #4A86C8; color: #fff; text-decoration: none;
               padding: 12px 28px; border-radius: 6px; font-weight: bold; margin: 8px 0;">
              Log In Now →
            </a>

            <div style="background: #fff8e1; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
              <strong>⚠️ Action Required:</strong> You will be prompted to change your password immediately after your first login.
              Please also set a password hint to help you remember it.
            </div>

            <p style="color: #888; font-size: 12px; margin-top: 24px;">
              This is an automated message from Diatec Tech &amp; Support · Technical, Support &amp; Calibration App.<br>
              Please do not reply to this email.
            </p>
          </div>
        </div>`;

      sendMail({ to: email, subject: 'Your Diatec Account Has Been Created', html })
        .catch(err => console.error('Welcome email failed:', err.message));
    }

    res.json({ id: result.lastInsertRowid, username, role, name: name || username, temp_password: tempPassword });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/auth/users/:id — update user (admin only)
router.put('/users/:id', requireAdmin, (req, res) => {
  const { username, password, role, name, active, permissions } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newRole = role || user.role;

  // Prevent removing the last administrator
  if (newRole !== 'administrator' && user.role === 'administrator') {
    const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='administrator' AND active=1").get().c;
    if (adminCount <= 1) return res.status(400).json({ error: 'Cannot demote the only Administrator' });
  }

  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;
  const roleDefaults = ROLE_DEFAULTS[newRole] || DEFAULT_PERMISSIONS;
  const permJson = newRole === 'administrator' ? null : JSON.stringify({ ...roleDefaults, ...(permissions || {}) });

  db.prepare('UPDATE users SET username=?, password_hash=?, role=?, name=?, active=?, permissions=? WHERE id=?')
    .run(username || user.username, newHash, newRole, name || user.name, active !== undefined ? (active ? 1 : 0) : user.active, permJson, req.params.id);
  res.json({ success: true });
});

// GET /api/auth/profile — get own full profile
router.get('/profile', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, name, active, permissions, position, email, phone, password_hint, created_at FROM users WHERE id=?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ ...user, permissions: parsePermissions(user) });
});

// PUT /api/auth/profile — update own profile details (name, position, email, phone)
router.put('/profile', requireAuth, (req, res) => {
  const { name, position, email, phone } = req.body;
  const db = getDb();
  try {
    db.prepare('UPDATE users SET name=?, position=?, email=?, phone=? WHERE id=?')
      .run(name || req.user.name, position || null, email || null, phone || null, req.user.id);
    res.json({ success: true });
  } catch (e) {
    console.error('Profile update error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/auth/hint — update own password hint without changing password
router.put('/hint', requireAuth, (req, res) => {
  const { password_hint } = req.body;
  if (!password_hint || !password_hint.trim()) return res.status(400).json({ error: 'Hint cannot be empty' });
  const db = getDb();
  db.prepare('UPDATE users SET password_hint=? WHERE id=?').run(password_hint.trim(), req.user.id);
  res.json({ success: true });
});

// GET /api/auth/hint — public endpoint, returns password hint for a username (no auth needed)
router.get('/hint', (req, res) => {
  const { username } = req.query;
  if (!username) return res.json({ hint: null });
  const db = getDb();
  const user = db.prepare('SELECT password_hint FROM users WHERE username = ? AND active = 1').get(username.trim());
  res.json({ hint: user?.password_hint || null });
});

// POST /api/auth/change-password — any logged-in user can change their own password
router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password, password_hint } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both current and new password are required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  if (!password_hint || !password_hint.trim()) return res.status(400).json({ error: 'Password hint is required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  db.prepare('UPDATE users SET password_hash=?, password_hint=?, must_change_password=0 WHERE id=?').run(bcrypt.hashSync(new_password, 10), password_hint.trim(), req.user.id);
  res.json({ success: true });
});

// POST /api/auth/users/:id/reset-password — admin resets any user's password
router.post('/users/:id/reset-password', requireAdmin, (req, res) => {
  const { new_password, password_hint } = req.body;
  if (!new_password) return res.status(400).json({ error: 'New password is required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET password_hash=?, password_hint=? WHERE id=?')
    .run(bcrypt.hashSync(new_password, 10), password_hint?.trim() || null, req.params.id);
  res.json({ success: true });
});

// DELETE /api/auth/users/:id — delete user (admin only)
router.delete('/users/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'administrator') {
    const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='administrator' AND active=1").get().c;
    if (adminCount <= 1) return res.status(400).json({ error: 'Cannot delete the only Administrator' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
