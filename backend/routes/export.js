const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { getDb } = require('../database');

const NAVY = '0D2847';
const OVERDUE_BG = 'FDECEA';
const DUE_SOON_BG = 'FFF3CD';

function getPriority(nextCal) {
  if (!nextCal) return 'unknown';
  const today = new Date().toISOString().split('T')[0];
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const soonStr = soon.toISOString().split('T')[0];
  if (nextCal < today) return 'overdue';
  if (nextCal <= soonStr) return 'due_soon';
  return 'scheduled';
}

function daysDiff(dateStr) {
  if (!dateStr) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  const diff = Math.round((today - d) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

router.get('/master', async (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        c.name as customer, c.state, c.contact_person as contact, c.email, c.phone,
        e.equipment_name, e.model, e.modules, e.serial_number, e.status, e.warranty_period, e.remarks, e.updated_at,
        MAX(cr.calibration_date) as last_cal,
        MAX(cr.next_calibration_date) as next_cal
      FROM equipment e
      JOIN customers c ON c.id = e.customer_id
      LEFT JOIN calibration_records cr ON cr.equipment_id = e.id
      GROUP BY e.id
      ORDER BY c.name, e.equipment_name
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

    const headers = [
      'NO', 'CUSTOMER', 'EQUIPMENT', 'MODEL', 'MODULE', 'SERIAL NO', 'STATUS',
      'STATE', 'CONTACT', 'EMAIL', 'PHONE', 'LAST CALIBRATION', 'NEXT CALIBRATION',
      'DAYS OVERDUE', 'WARRANTY', 'REMARKS', 'LAST UPDATED'
    ];
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + NAVY } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
    });
    sheet.getRow(3).height = 22;

    const colWidths = [6, 30, 18, 16, 20, 16, 12, 14, 20, 32, 16, 16, 16, 14, 14, 22, 16];
    colWidths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

    rows.forEach((row, idx) => {
      const priority = getPriority(row.next_cal);
      const daysOver = priority === 'overdue' ? daysDiff(row.next_cal) : '';

      const dataRow = sheet.addRow([
        idx + 1,
        row.customer,
        row.equipment_name,
        row.model || '',
        row.modules || '',
        row.serial_number || '',
        row.status || '',
        row.state || '',
        row.contact || '',
        row.email || '',
        row.phone || '',
        row.last_cal || '',
        row.next_cal || '',
        daysOver,
        row.warranty_period || '',
        row.remarks || '',
        row.updated_at ? row.updated_at.split('T')[0] : '',
      ]);

      let bgColor = null;
      if (priority === 'overdue') bgColor = OVERDUE_BG;
      else if (priority === 'due_soon') bgColor = DUE_SOON_BG;

      if (bgColor) {
        dataRow.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgColor } };
        });
      }

      dataRow.eachCell(cell => {
        cell.border = {
          top: { style: 'hair', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
        };
        cell.alignment = { vertical: 'middle', wrapText: false };
      });
      dataRow.height = 18;
    });

    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, topLeftCell: 'A4', activeCell: 'A4' }];
    sheet.autoFilter = { from: 'A3', to: 'Q3' };

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="CalibrationDatabase_${dateStr}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/schedule', async (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT cr.*, e.equipment_name, e.model, e.serial_number, e.modules,
        c.name as customer_name, c.state, c.contact_person, c.phone, c.email
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      JOIN customers c ON c.id = cr.customer_id
      INNER JOIN (
        SELECT equipment_id, MAX(calibration_date) as max_date FROM calibration_records GROUP BY equipment_id
      ) latest ON cr.equipment_id = latest.equipment_id AND cr.calibration_date = latest.max_date
      ORDER BY cr.next_calibration_date ASC
    `).all();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Calibration Schedule');
    const today = new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });

    sheet.mergeCells('A1:K1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `Calibration Schedule — Exported: ${today}`;
    titleCell.font = { bold: true, size: 13, color: { argb: 'FF' + NAVY } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 28;

    sheet.addRow([]);

    const headers = ['NO', 'CUSTOMER', 'STATE', 'EQUIPMENT', 'MODEL', 'SERIAL NO', 'MODULE', 'LAST CAL', 'NEXT CAL', 'STATUS', 'NOTES'];
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + NAVY } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    sheet.getRow(3).height = 22;

    const colWidths = [6, 30, 14, 18, 16, 16, 20, 14, 14, 12, 24];
    colWidths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });

    rows.forEach((row, idx) => {
      const priority = getPriority(row.next_calibration_date);
      const statusLabel = priority === 'overdue' ? 'OVERDUE' : priority === 'due_soon' ? 'DUE SOON' : 'Scheduled';

      const dataRow = sheet.addRow([
        idx + 1,
        row.customer_name,
        row.state || '',
        row.equipment_name,
        row.model || '',
        row.serial_number || '',
        row.modules || '',
        row.calibration_date || '',
        row.next_calibration_date || '',
        statusLabel,
        row.notes || '',
      ]);

      let bgColor = null;
      if (priority === 'overdue') bgColor = OVERDUE_BG;
      else if (priority === 'due_soon') bgColor = DUE_SOON_BG;

      if (bgColor) {
        dataRow.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bgColor } };
        });
      }
      dataRow.height = 18;
    });

    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 3, topLeftCell: 'A4', activeCell: 'A4' }];
    sheet.autoFilter = { from: 'A3', to: 'K3' };

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="CalibrationSchedule_${dateStr}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
