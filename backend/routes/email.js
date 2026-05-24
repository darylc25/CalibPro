const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');
const { getDb } = require('../database');

const NAVY = '0D2847';
const OVERDUE_BG = 'FDECEA';
const DUE_SOON_BG = 'FFF3CD';

function getQuarter(date) {
  return Math.floor(date.getMonth() / 3) + 1;
}

function quarterRange(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    label: `Q${quarter} ${year}`,
    months: ['January – March', 'April – June', 'July – September', 'October – December'][quarter - 1],
  };
}

function getPriority(nextCal) {
  if (!nextCal) return 'unknown';
  const today = new Date().toISOString().split('T')[0];
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  if (nextCal < today) return 'overdue';
  if (nextCal <= soon.toISOString().split('T')[0]) return 'due_soon';
  return 'scheduled';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function buildExcelAttachment(db) {
  const rows = db.prepare(`
    SELECT c.name as customer, c.state, c.contact_person as contact, c.email, c.phone,
      e.equipment_name, e.model, e.modules, e.serial_number, e.status, e.warranty_period, e.remarks, e.updated_at,
      MAX(cr.calibration_date) as last_cal, MAX(cr.next_calibration_date) as next_cal
    FROM equipment e
    JOIN customers c ON c.id = e.customer_id
    LEFT JOIN calibration_records cr ON cr.equipment_id = e.id
    GROUP BY e.id ORDER BY c.name, e.equipment_name
  `).all();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Master Database');
  const today = new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });

  sheet.mergeCells('A1:Q1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Calibration Master Database — Exported: ${today}`;
  titleCell.font = { bold: true, size: 13, color: { argb: 'FF' + NAVY } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 28;
  sheet.addRow([]);

  const headers = ['NO','CUSTOMER','EQUIPMENT','MODEL','MODULE','SERIAL NO','STATUS','STATE','CONTACT','EMAIL','PHONE','LAST CALIBRATION','NEXT CALIBRATION','DAYS OVERDUE','WARRANTY','REMARKS','LAST UPDATED'];
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + NAVY } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  sheet.getRow(3).height = 22;

  const colWidths = [6,30,18,16,20,16,12,14,20,32,16,16,16,14,14,22,16];
  colWidths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

  rows.forEach((row, idx) => {
    const p = getPriority(row.next_cal);
    const todayStr = new Date().toISOString().split('T')[0];
    const daysOver = p === 'overdue' ? Math.round((new Date(todayStr) - new Date(row.next_cal)) / 86400000) : '';
    const dataRow = sheet.addRow([
      idx + 1, row.customer, row.equipment_name, row.model||'', row.modules||'',
      row.serial_number||'', row.status||'', row.state||'', row.contact||'',
      row.email||'', row.phone||'', row.last_cal||'', row.next_cal||'',
      daysOver, row.warranty_period||'', row.remarks||'',
      row.updated_at ? row.updated_at.split('T')[0] : '',
    ]);
    const bgColor = p === 'overdue' ? OVERDUE_BG : p === 'due_soon' ? DUE_SOON_BG : null;
    if (bgColor) {
      dataRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgColor } };
      });
    }
    dataRow.height = 18;
  });

  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, topLeftCell: 'A4', activeCell: 'A4' }];
  sheet.autoFilter = { from: 'A3', to: 'Q3' };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

function buildHtmlReport({ range, nextRange, calsDone, customersServed, equipmentServiced, totalFees, overdueRows, dueNextQuarter, topCustomers, byState, byType, today }) {
  const overdueTable = overdueRows.slice(0, 20).map((r, i) => {
    const days = Math.round((new Date(today) - new Date(r.next_calibration_date)) / 86400000);
    return `<tr style="background:${i % 2 === 0 ? '#fff9f9' : '#ffffff'}">
      <td style="padding:8px 12px;border-bottom:1px solid #fde;font-weight:600">${r.customer_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fde">${r.equipment_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fde;font-family:monospace;font-size:12px">${r.serial_number || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fde">${r.state || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fde;color:#c0392b;font-weight:700">${days}d overdue</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fde">${fmtDate(r.next_calibration_date)}</td>
    </tr>`;
  }).join('');

  const dueTable = dueNextQuarter.slice(0, 15).map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#fffdf5' : '#ffffff'}">
      <td style="padding:8px 12px;border-bottom:1px solid #fde8a0;font-weight:600">${r.customer_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fde8a0">${r.equipment_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fde8a0;font-family:monospace;font-size:12px">${r.serial_number || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fde8a0">${r.state || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #fde8a0;color:#e67e22;font-weight:700">${fmtDate(r.next_calibration_date)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;color:#333">
  <div style="max-width:720px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:#0D2847;padding:32px 36px">
      <div style="color:#93c5fd;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Calibration Management System</div>
      <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700">Quarterly Report</h1>
      <div style="color:#bfdbfe;font-size:16px;margin-top:6px">${range.label} &nbsp;·&nbsp; ${range.months}</div>
      <div style="color:#93c5fd;font-size:13px;margin-top:4px">Generated ${fmtDate(today)}</div>
    </div>

    <!-- Summary cards -->
    <div style="padding:28px 36px 0">
      <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#0D2847;text-transform:uppercase;letter-spacing:1px">Quarter Summary</h2>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
        ${[
          ['✅', 'Calibrations Done', calsDone.count, '#16a34a'],
          ['🏥', 'Customers Served', customersServed.count, '#2563eb'],
          ['🔧', 'Equipment Serviced', equipmentServiced.count, '#7c3aed'],
          ['💰', 'Fees Collected', totalFees.total > 0 ? `MYR ${parseFloat(totalFees.total).toLocaleString('en-MY', {minimumFractionDigits:2})}` : '—', '#d97706'],
        ].map(([icon, label, val, color]) => `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;border-left:4px solid ${color}">
            <div style="font-size:22px;margin-bottom:4px">${icon}</div>
            <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
            <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:2px">${val}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- Overdue -->
    ${overdueRows.length > 0 ? `
    <div style="padding:28px 36px 0">
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#c0392b;text-transform:uppercase;letter-spacing:1px">
        🔴 Overdue Equipment &nbsp;<span style="background:#fdecea;color:#c0392b;border-radius:20px;padding:2px 10px;font-size:13px">${overdueRows.length} units</span>
      </h2>
      <div style="border-radius:8px;overflow:hidden;border:1px solid #fca5a5">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#c0392b;color:#fff">
              <th style="padding:10px 12px;text-align:left;font-weight:600">Customer</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600">Equipment</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600">Serial No</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600">State</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600">Overdue By</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600">Was Due</th>
            </tr>
          </thead>
          <tbody>${overdueTable}</tbody>
        </table>
      </div>
      ${overdueRows.length > 20 ? `<p style="color:#64748b;font-size:12px;margin:8px 0 0">+ ${overdueRows.length - 20} more units — see attached Excel file</p>` : ''}
    </div>` : ''}

    <!-- Due Next Quarter -->
    ${dueNextQuarter.length > 0 ? `
    <div style="padding:28px 36px 0">
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:1px">
        🟡 Due Next Quarter (${nextRange.label}) &nbsp;<span style="background:#fff3cd;color:#d97706;border-radius:20px;padding:2px 10px;font-size:13px">${dueNextQuarter.length} units</span>
      </h2>
      <div style="border-radius:8px;overflow:hidden;border:1px solid #fcd34d">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#d97706;color:#fff">
              <th style="padding:10px 12px;text-align:left;font-weight:600">Customer</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600">Equipment</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600">Serial No</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600">State</th>
              <th style="padding:10px 12px;text-align:left;font-weight:600">Due Date</th>
            </tr>
          </thead>
          <tbody>${dueTable}</tbody>
        </table>
      </div>
      ${dueNextQuarter.length > 15 ? `<p style="color:#64748b;font-size:12px;margin:8px 0 0">+ ${dueNextQuarter.length - 15} more — see attached Excel file</p>` : ''}
    </div>` : ''}

    <!-- Top Customers & By State -->
    <div style="padding:28px 36px 0;display:grid;grid-template-columns:1fr 1fr;gap:20px">
      ${topCustomers.length > 0 ? `
      <div>
        <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#0D2847">🏆 Top Customers</h3>
        ${topCustomers.map((c, i) => `
          <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px">
            <span style="color:#334155">${i+1}. ${c.name}</span>
            <span style="font-weight:700;color:#0D2847">${c.count}</span>
          </div>`).join('')}
      </div>` : ''}
      ${byState.length > 0 ? `
      <div>
        <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#0D2847">📍 By State</h3>
        ${byState.map(s => `
          <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px">
            <span style="color:#334155">${s.state}</span>
            <span style="font-weight:700;color:#0D2847">${s.count}</span>
          </div>`).join('')}
      </div>` : ''}
    </div>

    <!-- Footer -->
    <div style="margin:32px 36px;padding:20px;background:#f8fafc;border-radius:8px;text-align:center">
      <p style="margin:0;color:#64748b;font-size:13px">📎 Full master database attached as Excel file</p>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:12px">CalibPro Calibration Management System &nbsp;·&nbsp; ${fmtDate(today)}</p>
    </div>
  </div>
</body>
</html>`;
}

router.post('/quarterly', async (req, res) => {
  try {
    const gmailUser = process.env.GMAIL_USER;
    const appPassword = process.env.GMAIL_APP_PASSWORD;
    // Accept custom recipients from request body, fall back to .env default
    const extraRecipients = Array.isArray(req.body.recipients) ? req.body.recipients : [];
    const defaultRecipient = process.env.EMAIL_RECIPIENT;
    const allRecipients = extraRecipients.length > 0 ? extraRecipients : [defaultRecipient];
    const recipient = allRecipients.join(', ');

    if (!gmailUser || gmailUser === 'your_gmail@gmail.com') return res.status(400).json({ error: 'GMAIL_USER not configured in .env' });
    if (!appPassword || appPassword === 'xxxx xxxx xxxx xxxx') return res.status(400).json({ error: 'GMAIL_APP_PASSWORD not configured in .env' });
    if (!recipient || recipient.trim() === '') return res.status(400).json({ error: 'No recipients specified' });

    const db = getDb();
    const now = new Date();
    const year = parseInt(req.body.year) || now.getFullYear();
    const quarter = parseInt(req.body.quarter) || getQuarter(now);
    const range = quarterRange(year, quarter);
    const nextRange = quarterRange(quarter === 4 ? year + 1 : year, quarter === 4 ? 1 : quarter + 1);
    const today = now.toISOString().split('T')[0];

    const calsDone = db.prepare(`SELECT COUNT(*) as count FROM calibration_records WHERE calibration_date >= ? AND calibration_date <= ?`).get(range.start, range.end);
    const customersServed = db.prepare(`SELECT COUNT(DISTINCT customer_id) as count FROM calibration_records WHERE calibration_date >= ? AND calibration_date <= ?`).get(range.start, range.end);
    const equipmentServiced = db.prepare(`SELECT COUNT(DISTINCT equipment_id) as count FROM calibration_records WHERE calibration_date >= ? AND calibration_date <= ?`).get(range.start, range.end);
    const totalFees = db.prepare(`SELECT COALESCE(SUM(fee),0) as total FROM calibration_records WHERE calibration_date >= ? AND calibration_date <= ? AND fee IS NOT NULL`).get(range.start, range.end);

    const overdueRows = db.prepare(`
      SELECT cr.*, c.name as customer_name, c.state, e.equipment_name, e.serial_number
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      JOIN customers c ON c.id = cr.customer_id
      INNER JOIN (SELECT equipment_id, MAX(calibration_date) as max_date FROM calibration_records GROUP BY equipment_id) latest
        ON cr.equipment_id = latest.equipment_id AND cr.calibration_date = latest.max_date
      WHERE cr.next_calibration_date < ? ORDER BY cr.next_calibration_date ASC
    `).all(today);

    const dueNextQuarter = db.prepare(`
      SELECT cr.*, c.name as customer_name, c.state, e.equipment_name, e.serial_number
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      JOIN customers c ON c.id = cr.customer_id
      INNER JOIN (SELECT equipment_id, MAX(calibration_date) as max_date FROM calibration_records GROUP BY equipment_id) latest
        ON cr.equipment_id = latest.equipment_id AND cr.calibration_date = latest.max_date
      WHERE cr.next_calibration_date >= ? AND cr.next_calibration_date <= ? ORDER BY cr.next_calibration_date ASC
    `).all(nextRange.start, nextRange.end);

    const topCustomers = db.prepare(`
      SELECT c.name, COUNT(*) as count FROM calibration_records cr
      JOIN customers c ON c.id = cr.customer_id
      WHERE cr.calibration_date >= ? AND cr.calibration_date <= ?
      GROUP BY cr.customer_id ORDER BY count DESC LIMIT 5
    `).all(range.start, range.end);

    const byState = db.prepare(`
      SELECT c.state, COUNT(*) as count FROM calibration_records cr
      JOIN customers c ON c.id = cr.customer_id
      WHERE cr.calibration_date >= ? AND cr.calibration_date <= ? AND c.state != ''
      GROUP BY c.state ORDER BY count DESC
    `).all(range.start, range.end);

    const html = buildHtmlReport({ range, nextRange, calsDone, customersServed, equipmentServiced, totalFees, overdueRows, dueNextQuarter, topCustomers, byState, today });
    const excelBuffer = await buildExcelAttachment(db);
    const dateStr = now.toISOString().split('T')[0];

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"CalibPro Reports" <${gmailUser}>`,
      to: recipient,
      subject: `📊 CalibPro ${range.label} Calibration Report — ${overdueRows.length} Overdue`,
      html,
      attachments: [{
        filename: `CalibrationDatabase_${dateStr}.xlsx`,
        content: excelBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
    });

    res.json({
      success: true,
      quarter: range.label,
      sentTo: allRecipients,
      stats: {
        calibrationsDone: calsDone.count,
        customersServed: customersServed.count,
        equipmentServiced: equipmentServiced.count,
        overdueCount: overdueRows.length,
        dueNextQuarter: dueNextQuarter.length,
      },
    });
  } catch (err) {
    console.error('Email report error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/test', async (req, res) => {
  try {
    const gmailUser = process.env.GMAIL_USER;
    const appPassword = process.env.GMAIL_APP_PASSWORD;
    const recipient = process.env.EMAIL_RECIPIENT;

    if (!gmailUser || gmailUser === 'your_gmail@gmail.com') return res.status(400).json({ error: 'GMAIL_USER not configured' });
    if (!appPassword || appPassword === 'xxxx xxxx xxxx xxxx') return res.status(400).json({ error: 'GMAIL_APP_PASSWORD not configured' });
    if (!recipient || recipient === 'recipient@email.com') return res.status(400).json({ error: 'EMAIL_RECIPIENT not configured' });

    const transporter = createTransporter();
    await transporter.verify();
    await transporter.sendMail({
      from: `"CalibPro Reports" <${gmailUser}>`,
      to: recipient,
      subject: '✅ CalibPro Email Connected',
      html: `<div style="font-family:Arial,sans-serif;padding:24px;max-width:480px">
        <h2 style="color:#0D2847">✅ CalibPro email is working!</h2>
        <p>Your quarterly reports will be delivered to <b>${recipient}</b>.</p>
        <p style="color:#64748b;font-size:13px">CalibPro Calibration Management System</p>
      </div>`,
    });

    res.json({ success: true, from: gmailUser, to: recipient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
