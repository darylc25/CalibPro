require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, importFromFile, importSalesFromFile, importInvoicesFromFile, tagDealers } = require('./database');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

initDb();
importFromFile();
importSalesFromFile();
importInvoicesFromFile();
tagDealers();

// Public — login only
app.use('/api/auth', require('./routes/auth'));

// All other /api routes require a valid token
app.use('/api', (req, res, next) => requireAuth(req, res, next));

// Role-based method gating
app.use('/api', (req, res, next) => {
  const role = req.user.role;
  const method = req.method;
  const path = req.path;

  // Delete requests — any authenticated user can POST/GET; PUT is admin-only (handled in route)
  if (path.startsWith('/delete-requests')) return next();

  // DELETE — administrator only (accept old 'admin' role for backward compat)
  if (method === 'DELETE' && role !== 'administrator' && role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can delete records' });
  }

  // POST / PUT / PATCH — viewer is read-only
  if (['POST', 'PUT', 'PATCH'].includes(method) && role === 'viewer') {
    return res.status(403).json({ error: 'You have view-only access' });
  }

  next();
});

app.use('/api/delete-requests', require('./routes/deleteRequests'));

app.use('/api/customers',    require('./routes/customers'));
app.use('/api/equipment',    require('./routes/equipment'));
app.use('/api/calibrations', require('./routes/calibrations'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/export',       require('./routes/export'));
app.use('/api/telegram',     require('./routes/telegram'));
app.use('/api/email',        require('./routes/email'));
app.use('/api/staff',        require('./routes/staff'));
app.use('/api/audit',        require('./routes/audit'));
app.use('/api/pipeline',     require('./routes/pipeline'));
app.use('/api/contracts',    require('./routes/contracts'));
app.use('/api/access-control', require('./routes/access-control'));

const distPath = path.join(__dirname, '../frontend/dist');
// Static assets (JS/CSS have content hashes) — cache for 1 year
app.use(express.static(distPath, { maxAge: '1y', index: false }));
// index.html — never cache so browser always gets latest JS references
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
