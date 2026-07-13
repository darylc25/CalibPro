const IGNORED_FIELDS = ['created_at', 'updated_at', 'password_hash'];

function logAudit(db, user, action, tableName, recordId, recordLabel, oldData, newData) {
  try {
    let changes = {};
    if (action === 'UPDATE' && oldData && newData) {
      for (const key of Object.keys({ ...oldData, ...newData })) {
        if (IGNORED_FIELDS.includes(key)) continue;
        const oldVal = oldData[key];
        const newVal = newData[key];
        if (String(oldVal) !== String(newVal)) {
          changes[key] = { from: oldVal ?? null, to: newVal ?? null };
        }
      }
    } else if (action === 'CREATE' && newData) {
      for (const [k, v] of Object.entries(newData)) {
        if (!IGNORED_FIELDS.includes(k)) changes[k] = v;
      }
    }

    db.prepare(`
      INSERT INTO audit_log (user_id, username, user_name, action, table_name, record_id, record_label, changes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user?.id || null,
      user?.username || 'system',
      user?.name || user?.username || 'system',
      action,
      tableName,
      recordId || null,
      recordLabel || `#${recordId}`,
      JSON.stringify(changes)
    );
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

module.exports = { logAudit };
