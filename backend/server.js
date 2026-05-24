require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./database');
const { requireAuth, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

initDb();

// Public route — login
app.use('/api/auth', require('./routes/auth'));

// All other API routes require authentication
app.use('/api', (req, res, next) => {
  requireAuth(req, res, next);
});

// Write operations (POST/PUT/DELETE) require admin role
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
  }
  next();
});

app.use('/api/customers', require('./routes/customers'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/calibrations', require('./routes/calibrations'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/export', require('./routes/export'));
app.use('/api/telegram', require('./routes/telegram'));
app.use('/api/email', require('./routes/email'));
app.use('/api/staff', require('./routes/staff'));

const distPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
