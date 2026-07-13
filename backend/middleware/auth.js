const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'calibpro-jwt-secret-2025';

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Administrator only (also accept legacy 'admin')
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!['administrator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Administrator access required' });
    }
    next();
  });
}

// Administrator, Engineer or Admin Assist (also accept legacy 'admin', 'editor')
function requireEditor(req, res, next) {
  requireAuth(req, res, () => {
    if (!['administrator', 'engineer', 'admin_assist', 'admin', 'editor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You have view-only access' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin, requireEditor };
