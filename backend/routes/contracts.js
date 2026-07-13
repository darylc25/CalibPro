'use strict';
const express = require('express');
const { getDb } = require('../database');
const { generateContractDoc } = require('../utils/contractDoc');

const router = express.Router();

function generateContractNumber(db, endYear) {
  const row = db.prepare(
    `SELECT MAX(CAST(SUBSTR(contract_number, -4) AS INTEGER)) AS max_seq
     FROM service_contracts WHERE contract_number LIKE ?`
  ).get(`DM-${endYear}-%`);
  const next = (row?.max_seq ?? 0) + 1;
  return `DM-${endYear}-${String(next).padStart(4, '0')}`;
}

function computeStatus(contract) {
  if (contract.status !== 'active') return contract.status;
  if (Number(contract.contract_end_year) < new Date().getFullYear()) return 'expired';
  return 'active';
}

function parseRow(r) {
  return {
    ...r,
    status: computeStatus(r),
    equipment_list: r.equipment_list ? JSON.parse(r.equipment_list) : null,
  };
}

// GET /api/contracts
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT sc.* FROM service_contracts sc ORDER BY sc.created_at DESC`).all();
    res.json(rows.map(parseRow));
  } catch (err) { console.error('[contracts GET /]', err); res.status(500).json({ error: err.message }); }
});

// GET /api/contracts/validate/:contractNumber  (before /:id to avoid collision)
router.get('/validate/:contractNumber', (req, res) => {
  try {
    const db = getDb();
    const c = db.prepare(`SELECT * FROM service_contracts WHERE contract_number = ?`).get(req.params.contractNumber);
    if (!c) return res.json({ valid: false, message: 'Contract not found' });
    const status = computeStatus(c);
    if (status !== 'active') return res.json({ valid: false, status, message: `Contract is ${status}` });
    res.json({ valid: true, status: 'active', contract: parseRow({ ...c, status: 'active' }) });
  } catch (err) { console.error('[contracts validate]', err); res.status(500).json({ error: err.message }); }
});

// GET /api/contracts/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const c = db.prepare(`SELECT * FROM service_contracts WHERE id = ?`).get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(parseRow(c));
  } catch (err) { console.error('[contracts GET /:id]', err); res.status(500).json({ error: err.message }); }
});

// POST /api/contracts
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const {
      customer_id, customer_name, customer_address_1, customer_address_2,
      customer_city_postcode, customer_state, customer_tel,
      contract_date, equipment_list,
      duration_years, contract_start_year, annual_fee, notes,
    } = req.body;

    // equipment_list is an array of { equipment_id, equipment_model, serial_number }
    const equipList = Array.isArray(equipment_list) && equipment_list.length > 0 ? equipment_list : null;
    const primaryEquip = equipList ? equipList[0] : {};

    if (!customer_name || !contract_date || !primaryEquip.equipment_model || !duration_years || !contract_start_year || !annual_fee) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const dur     = parseInt(duration_years, 10);
    const startYr = parseInt(contract_start_year, 10);
    const endYr   = startYr + dur - 1;
    const fee     = parseFloat(annual_fee);
    const total   = fee * dur;

    const contractNumber = generateContractNumber(db, endYr);

    const result = db.prepare(`
      INSERT INTO service_contracts (
        contract_number, customer_id, customer_name,
        customer_address_1, customer_address_2, customer_city_postcode, customer_state, customer_tel,
        contract_date, equipment_model, equipment_id, serial_number, equipment_list,
        duration_years, contract_start_year, contract_end_year, annual_fee, total_value,
        notes, status
      ) VALUES (
        @contract_number, @customer_id, @customer_name,
        @customer_address_1, @customer_address_2, @customer_city_postcode, @customer_state, @customer_tel,
        @contract_date, @equipment_model, @equipment_id, @serial_number, @equipment_list,
        @duration_years, @contract_start_year, @contract_end_year, @annual_fee, @total_value,
        @notes, 'active'
      )
    `).run({
      contract_number: contractNumber,
      customer_id: customer_id || null,
      customer_name,
      customer_address_1: customer_address_1 || null,
      customer_address_2: customer_address_2 || null,
      customer_city_postcode: customer_city_postcode || null,
      customer_state: customer_state || null,
      customer_tel: customer_tel || null,
      contract_date,
      equipment_model: primaryEquip.equipment_model || '',
      equipment_id: primaryEquip.equipment_id || null,
      serial_number: primaryEquip.serial_number || null,
      equipment_list: equipList ? JSON.stringify(equipList) : null,
      duration_years: dur,
      contract_start_year: startYr,
      contract_end_year: endYr,
      annual_fee: fee,
      total_value: total,
      notes: notes || null,
    });

    const created = db.prepare(`SELECT * FROM service_contracts WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json(parseRow(created));
  } catch (err) { console.error('[contracts POST /]', err); res.status(500).json({ error: err.message }); }
});

// PATCH /api/contracts/:id/status  (admin only)
router.patch('/:id/status', (req, res) => {
  const role = req.user?.role;
  if (role !== 'administrator' && role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can update contract status' });
  }
  const { status } = req.body;
  if (!['active', 'expired', 'terminated'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const db = getDb();
  const c = db.prepare(`SELECT id FROM service_contracts WHERE id = ?`).get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  db.prepare(`UPDATE service_contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(status, req.params.id);
  const updated = db.prepare(`SELECT * FROM service_contracts WHERE id = ?`).get(req.params.id);
  res.json({ ...updated, status: computeStatus(updated) });
});

// DELETE /api/contracts/:id  (admin only — blocked at server.js level for non-admins)
router.delete('/:id', (req, res) => {
  const db = getDb();
  const c = db.prepare(`SELECT id FROM service_contracts WHERE id = ?`).get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  db.prepare(`DELETE FROM service_contracts WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// GET /api/contracts/:id/download
router.get('/:id/download', async (req, res) => {
  const db = getDb();
  const c = db.prepare(`SELECT * FROM service_contracts WHERE id = ?`).get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  try {
    const buffer = await generateContractDoc({ ...c, status: computeStatus(c) });
    const safeName = c.contract_number.replace(/[^A-Z0-9-]/gi, '_');
    res.setHeader('Content-Disposition', `attachment; filename="Contract_${safeName}.docx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('Contract doc generation failed:', err);
    res.status(500).json({ error: 'Failed to generate document' });
  }
});

module.exports = router;
