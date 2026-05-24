const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

async function sendTelegram(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'Telegram API error');
  return data;
}

function getQuarter(date) {
  const m = date.getMonth();
  return Math.floor(m / 3) + 1;
}

function quarterRange(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    label: `Q${quarter} ${year}`,
    months: ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'][quarter - 1],
  };
}

function esc(text) {
  return String(text || '');
}

router.post('/quarterly', async (req, res) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || token === 'your_bot_token_here') {
      return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not configured in .env' });
    }
    if (!chatId || chatId === 'your_group_chat_id_here') {
      return res.status(400).json({ error: 'TELEGRAM_CHAT_ID not configured in .env' });
    }

    const db = getDb();
    const now = new Date();

    // Allow override via body: { year, quarter }
    const year = parseInt(req.body.year) || now.getFullYear();
    const quarter = parseInt(req.body.quarter) || getQuarter(now);
    const range = quarterRange(year, quarter);
    const today = now.toISOString().split('T')[0];

    // Calibrations performed this quarter
    const calsDone = db.prepare(`
      SELECT COUNT(*) as count FROM calibration_records
      WHERE calibration_date >= ? AND calibration_date <= ?
    `).get(range.start, range.end);

    const customersServed = db.prepare(`
      SELECT COUNT(DISTINCT customer_id) as count FROM calibration_records
      WHERE calibration_date >= ? AND calibration_date <= ?
    `).get(range.start, range.end);

    const equipmentServiced = db.prepare(`
      SELECT COUNT(DISTINCT equipment_id) as count FROM calibration_records
      WHERE calibration_date >= ? AND calibration_date <= ?
    `).get(range.start, range.end);

    const totalFees = db.prepare(`
      SELECT COALESCE(SUM(fee), 0) as total FROM calibration_records
      WHERE calibration_date >= ? AND calibration_date <= ? AND fee IS NOT NULL
    `).get(range.start, range.end);

    // Overdue (using latest cal per equipment)
    const overdueRows = db.prepare(`
      SELECT cr.*, c.name as customer_name, c.state, e.equipment_name
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      JOIN customers c ON c.id = cr.customer_id
      INNER JOIN (
        SELECT equipment_id, MAX(calibration_date) as max_date FROM calibration_records GROUP BY equipment_id
      ) latest ON cr.equipment_id = latest.equipment_id AND cr.calibration_date = latest.max_date
      WHERE cr.next_calibration_date < ?
      ORDER BY cr.next_calibration_date ASC
    `).all(today);

    // Due next quarter
    const nextRange = quarterRange(quarter === 4 ? year + 1 : year, quarter === 4 ? 1 : quarter + 1);
    const dueNextQuarter = db.prepare(`
      SELECT cr.*, c.name as customer_name, c.state, e.equipment_name
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      JOIN customers c ON c.id = cr.customer_id
      INNER JOIN (
        SELECT equipment_id, MAX(calibration_date) as max_date FROM calibration_records GROUP BY equipment_id
      ) latest ON cr.equipment_id = latest.equipment_id AND cr.calibration_date = latest.max_date
      WHERE cr.next_calibration_date >= ? AND cr.next_calibration_date <= ?
      ORDER BY cr.next_calibration_date ASC
      LIMIT 10
    `).all(nextRange.start, nextRange.end);

    // Top customers this quarter
    const topCustomers = db.prepare(`
      SELECT c.name, COUNT(*) as count
      FROM calibration_records cr
      JOIN customers c ON c.id = cr.customer_id
      WHERE cr.calibration_date >= ? AND cr.calibration_date <= ?
      GROUP BY cr.customer_id
      ORDER BY count DESC
      LIMIT 5
    `).all(range.start, range.end);

    // By state this quarter
    const byState = db.prepare(`
      SELECT c.state, COUNT(*) as count
      FROM calibration_records cr
      JOIN customers c ON c.id = cr.customer_id
      WHERE cr.calibration_date >= ? AND cr.calibration_date <= ? AND c.state IS NOT NULL AND c.state != ''
      GROUP BY c.state
      ORDER BY count DESC
    `).all(range.start, range.end);

    // By equipment type this quarter
    const byType = db.prepare(`
      SELECT e.equipment_name, COUNT(*) as count
      FROM calibration_records cr
      JOIN equipment e ON e.id = cr.equipment_id
      WHERE cr.calibration_date >= ? AND cr.calibration_date <= ?
      GROUP BY e.equipment_name
      ORDER BY count DESC
    `).all(range.start, range.end);

    // Build message
    const lines = [];

    lines.push(`<b>📊 CalibPro Quarterly Report</b>`);
    lines.push(`<b>${range.label} | ${range.months}</b>`);
    lines.push(`<i>Generated ${now.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}</i>`);
    lines.push('');

    lines.push(`<b>── Calibration Summary ──</b>`);
    lines.push(`✅ Calibrations performed: <b>${calsDone.count}</b>`);
    lines.push(`🏥 Customers served: <b>${customersServed.count}</b>`);
    lines.push(`🔧 Equipment units serviced: <b>${equipmentServiced.count}</b>`);
    if (totalFees.total > 0) {
      lines.push(`💰 Total fees collected: <b>MYR ${parseFloat(totalFees.total).toLocaleString('en-MY', { minimumFractionDigits: 2 })}</b>`);
    }
    lines.push('');

    if (overdueRows.length > 0) {
      lines.push(`<b>🔴 Overdue Equipment (${overdueRows.length} units)</b>`);
      overdueRows.slice(0, 5).forEach(r => {
        const days = Math.round((new Date(today) - new Date(r.next_calibration_date)) / 86400000);
        lines.push(`• ${esc(r.customer_name)} — ${esc(r.equipment_name)} <i>(${days}d overdue)</i>`);
      });
      if (overdueRows.length > 5) lines.push(`  <i>...and ${overdueRows.length - 5} more</i>`);
      lines.push('');
    }

    if (dueNextQuarter.length > 0) {
      lines.push(`<b>🟡 Due Next Quarter (${nextRange.label})</b>`);
      dueNextQuarter.slice(0, 5).forEach(r => {
        lines.push(`• ${esc(r.customer_name)} — ${esc(r.equipment_name)} [${esc(r.next_calibration_date)}]`);
      });
      if (dueNextQuarter.length > 5) lines.push(`  <i>...and ${dueNextQuarter.length - 5} more</i>`);
      lines.push('');
    }

    if (topCustomers.length > 0) {
      lines.push(`<b>🏆 Top Customers This Quarter</b>`);
      topCustomers.forEach((c, i) => {
        lines.push(`${i + 1}. ${esc(c.name)} — ${c.count} service${c.count !== 1 ? 's' : ''}`);
      });
      lines.push('');
    }

    if (byType.length > 0) {
      lines.push(`<b>🔧 Equipment Serviced by Type</b>`);
      byType.forEach(t => {
        lines.push(`• ${esc(t.equipment_name)}: ${t.count}`);
      });
      lines.push('');
    }

    if (byState.length > 0) {
      lines.push(`<b>📍 Coverage by State</b>`);
      byState.forEach(s => {
        lines.push(`• ${esc(s.state)}: ${s.count} service${s.count !== 1 ? 's' : ''}`);
      });
    }

    lines.push('');
    lines.push(`<i>— CalibPro Calibration Management System</i>`);

    const message = lines.join('\n');
    await sendTelegram(token, chatId, message);

    res.json({
      success: true,
      quarter: range.label,
      stats: {
        calibrationsDone: calsDone.count,
        customersServed: customersServed.count,
        equipmentServiced: equipmentServiced.count,
        overdueCount: overdueRows.length,
        dueNextQuarter: dueNextQuarter.length,
      },
    });
  } catch (err) {
    console.error('Telegram report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Test connection: verify bot token + chat ID are valid
router.get('/test', async (req, res) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || token === 'your_bot_token_here') {
      return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
    }
    if (!chatId || chatId === 'your_group_chat_id_here') {
      return res.status(400).json({ error: 'TELEGRAM_CHAT_ID not configured' });
    }

    // Verify bot token
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me = await meRes.json();
    if (!me.ok) throw new Error('Invalid bot token');

    // Send test message
    await sendTelegram(token, chatId, `✅ <b>CalibPro connected!</b>\nTelegram reports are configured correctly.`);

    res.json({ success: true, botName: me.result.first_name, botUsername: me.result.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
