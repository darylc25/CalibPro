const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// On Railway, set DATABASE_PATH=/data/calibration.db and attach a volume at /data
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'calibration.db');

// Ensure the directory exists before opening the database
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      location TEXT,
      state TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      equipment_name TEXT NOT NULL,
      model TEXT,
      serial_number TEXT,
      cal_code TEXT,
      modules TEXT,
      status TEXT DEFAULT 'Active',
      warranty_period TEXT,
      installation_date DATE,
      end_of_warranty DATE,
      location TEXT,
      accessories TEXT,
      software_version TEXT,
      otoaccess_version TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT DEFAULT 'Technician',
      department TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS calibration_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      calibration_date DATE NOT NULL,
      next_calibration_date DATE,
      performed_by TEXT,
      cal_report_status TEXT,
      quotation_sent BOOLEAN DEFAULT 0,
      job_sheet_number TEXT,
      notes TEXT,
      service_type TEXT DEFAULT 'Calibration',
      fee DECIMAL(10,2),
      currency TEXT DEFAULT 'MYR',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'viewer' CHECK(role IN ('administrator', 'engineer', 'admin_assist', 'viewer')),
      name TEXT,
      active INTEGER DEFAULT 1,
      permissions TEXT DEFAULT NULL,
      position TEXT,
      email TEXT,
      phone TEXT,
      password_hint TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS delete_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requested_by_id INTEGER,
      requested_by_name TEXT NOT NULL,
      record_type TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      record_label TEXT,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_review', 'approved', 'rejected')),
      admin_response TEXT,
      reviewed_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      user_name TEXT,
      action TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id INTEGER,
      record_label TEXT,
      changes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  migrateUsers(db);
  migratePermissions(db);
  purgeSingaporeOnce(db);
  seedIfEmpty(db);
  seedUsers(db);
  return db;
}

function purgeSingaporeOnce(db) {
  // Delete Singapore customers and reset import hash so the cleaned import_data.json re-runs
  const count = db.prepare("SELECT COUNT(*) as n FROM customers WHERE country = 'Singapore'").get();
  if (count.n === 0) return;
  db.prepare("DELETE FROM customers WHERE country = 'Singapore'").run();
  db.prepare("DELETE FROM import_log WHERE key = 'import_data'").run();
  console.log(`Purged ${count.n} Singapore customers and reset import hash for re-import`);
}

function migratePermissions(db) {
  const cols = ['permissions TEXT DEFAULT NULL', 'position TEXT', 'email TEXT', 'phone TEXT', 'password_hint TEXT', 'must_change_password INTEGER DEFAULT 0'];
  for (const col of cols) {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN ${col}`);
      console.log(`Added column: ${col.split(' ')[0]}`);
    } catch {
      // already exists — ignore
    }
  }
  // Ensure equipment columns added after initial schema
  const eqCols = [
    'otoaccess_version TEXT', 'software_version TEXT', 'accessories TEXT',
    'end_of_warranty DATE', 'warranty_period TEXT', 'brand TEXT',
    'end_user_name TEXT',    // actual end-user (for dealer-held equipment)
    'end_user_contact TEXT', // end-user phone/email
    'transferred_from INTEGER', // previous customer_id if this equipment was transferred in
    'transfer_note TEXT',    // note recorded at time of transfer
  ];
  for (const col of eqCols) {
    try { db.exec(`ALTER TABLE equipment ADD COLUMN ${col}`); } catch { /* already exists */ }
  }
  // Add country to customers
  try { db.exec('ALTER TABLE customers ADD COLUMN country TEXT'); } catch { /* already exists */ }
  // Track import source so PPM sync never deletes sales customers
  try { db.exec("ALTER TABLE customers ADD COLUMN import_source TEXT DEFAULT 'manual'"); } catch { /* already exists */ }
  // Customer type: Direct (default) or Dealer
  try { db.exec("ALTER TABLE customers ADD COLUMN customer_type TEXT DEFAULT 'Direct'"); } catch { /* already exists */ }

  // equipment_list for multi-equipment contracts (JSON array)
  try { db.exec('ALTER TABLE service_contracts ADD COLUMN equipment_list TEXT'); } catch { /* already exists */ }
  // Extended address fields on customers
  try { db.exec('ALTER TABLE customers ADD COLUMN address_2 TEXT'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE customers ADD COLUMN city_postcode TEXT'); } catch { /* already exists */ }

  // Service contracts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_address_1 TEXT,
      customer_address_2 TEXT,
      customer_city_postcode TEXT,
      customer_state TEXT,
      customer_tel TEXT,
      contract_date DATE NOT NULL,
      equipment_model TEXT NOT NULL,
      equipment_id INTEGER REFERENCES equipment(id) ON DELETE SET NULL,
      serial_number TEXT,
      duration_years INTEGER NOT NULL,
      contract_start_year INTEGER NOT NULL,
      contract_end_year INTEGER NOT NULL,
      annual_fee DECIMAL(10,2) NOT NULL,
      total_value DECIMAL(10,2) NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'terminated')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Clean up invalid brand values — only the 4 recognised brands are valid
  const validBrands = ['Interacoustics', 'Amplivox', 'Maico', 'MedRx'];
  db.prepare(
    `UPDATE equipment SET brand = NULL WHERE brand IS NOT NULL AND brand NOT IN (${validBrands.map(() => '?').join(',')})`
  ).run(...validBrands);
  // Normalise legacy variant spellings
  db.prepare("UPDATE equipment SET brand = 'Amplivox' WHERE brand IN ('Madsen/Amplivox','Madsen','AMPLIVOX')").run();
}

function migrateUsers(db) {
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!sql || !sql.sql) return;

  // Only rebuild if the schema does NOT already have the new roles
  const alreadyMigrated = sql.sql.includes("'administrator'") && sql.sql.includes("'admin_assist'");
  const needsRebuild = !alreadyMigrated;

  if (needsRebuild) {
    // Check which extra columns already exist in old table so we can carry them over
    const oldCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    const hasPerms    = oldCols.includes('permissions');
    const hasPosition = oldCols.includes('position');
    const hasEmail    = oldCols.includes('email');
    const hasPhone    = oldCols.includes('phone');
    const hasHint     = oldCols.includes('password_hint');

    db.exec(`
      CREATE TABLE IF NOT EXISTS users_v3 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'viewer' CHECK(role IN ('administrator', 'engineer', 'admin_assist', 'viewer')),
        name TEXT,
        active INTEGER DEFAULT 1,
        permissions TEXT DEFAULT NULL,
        position TEXT,
        email TEXT,
        phone TEXT,
        password_hint TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO users_v3
        SELECT id, username, password_hash,
          CASE role
            WHEN 'admin'   THEN 'administrator'
            WHEN 'editor'  THEN 'engineer'
            WHEN 'viewer'  THEN 'viewer'
            WHEN 'user'    THEN 'viewer'
            ELSE 'viewer'
          END,
          name, active,
          ${hasPerms ? 'CASE WHEN permissions IS NULL THEN NULL ELSE permissions END' : 'NULL'},
          ${hasPosition ? 'position' : 'NULL'},
          ${hasEmail    ? 'email'    : 'NULL'},
          ${hasPhone    ? 'phone'    : 'NULL'},
          ${hasHint     ? 'password_hint' : 'NULL'},
          created_at
        FROM users;
      DROP TABLE users;
      ALTER TABLE users_v3 RENAME TO users;
    `);
    console.log('Migrated users table to new role schema (administrator/engineer/admin_assist/viewer)');
  }
}

function seedUsers(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0) return;
  const bcrypt = require('bcryptjs');
  const users = [
    { username: 'admin', password: 'Admin@123', role: 'administrator', name: 'Administrator' },
    { username: 'engineer', password: 'Engineer@123', role: 'engineer', name: 'Engineer User' },
    { username: 'viewer', password: 'Viewer@123', role: 'viewer', name: 'View Only User' },
  ];
  const insert = db.prepare('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)');
  for (const u of users) {
    insert.run(u.username, bcrypt.hashSync(u.password, 10), u.role, u.name);
  }
  console.log('Default users seeded: admin / user');
}

function addYears(dateStr, years) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}

function seedIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM customers').get();
  if (count.c > 0) return;

  console.log('Seeding database...');

  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, contact_person, email, phone, address, state)
    VALUES (@name, @contact_person, @email, @phone, @address, @state)
  `);

  const insertEquipment = db.prepare(`
    INSERT INTO equipment (customer_id, equipment_name, model, serial_number, modules, status)
    VALUES (@customer_id, @equipment_name, @model, @serial_number, @modules, @status)
  `);

  const insertCal = db.prepare(`
    INSERT INTO calibration_records (equipment_id, customer_id, calibration_date, next_calibration_date, performed_by, service_type, cal_report_status)
    VALUES (@equipment_id, @customer_id, @calibration_date, @next_calibration_date, @performed_by, @service_type, @cal_report_status)
  `);

  const customers = [
    { name: 'Thomson Medical Centre', contact_person: 'En Nik Alwi', email: 'alwinb@tmclife.com', phone: '012-6574590', address: '', state: 'Kuala Lumpur' },
    { name: 'Sunway Medical Centre', contact_person: 'Cik Atiqah / En Afiq', email: 'natiqaho@sunway.com.my', phone: '012-2594598', address: '', state: 'Selangor' },
    { name: 'Gleneagles Hospital KL', contact_person: 'Ms Fatimah', email: 'my.gkl.biomedical.workshop@parkwaypantai.com', phone: '', address: '', state: 'Kuala Lumpur' },
    { name: 'Gleneagles Hospital Penang', contact_person: 'Ms Zuhaira', email: 'my.gpg.biomed@parkwaypantai.com', phone: '013-356-2247', address: '', state: 'Penang' },
    { name: 'Jesselton Medical Centre', contact_person: 'Mr Timothy', email: '', phone: '', address: '', state: 'Sabah' },
    { name: 'Avisena Specialist Hospital', contact_person: 'Ms Umaizah', email: '', phone: '017-3891938', address: '', state: 'Selangor' },
    { name: 'KPJ Sabah Specialist Hospital', contact_person: 'En Hafizi', email: 'hafizi@kpjsabah.com', phone: '016-880-7545', address: '', state: 'Sabah' },
    { name: 'KPJ Penang Specialist Hospital', contact_person: 'Ms Yani', email: '', phone: '', address: '', state: 'Penang' },
    { name: 'KPJ Bandar Dato Onn', contact_person: 'Ms Farah', email: 'farah.mohammad@kpjbdo.com', phone: '014-2713969', address: '', state: 'Johor' },
    { name: 'Hearing Partners Pantai Bangsar', contact_person: 'Nik', email: 'nnas@interacoustics.com', phone: '013-3562247', address: '', state: 'Kuala Lumpur' },
    { name: 'Island Hospital', contact_person: 'En Helmy', email: 'helmy@islandhospital.com', phone: '016-4702262', address: '', state: 'Penang' },
    { name: 'UTAR Hospital', contact_person: '', email: '', phone: '', address: '', state: 'Perak' },
    { name: 'Soundlife PJ Healthcare', contact_person: '', email: '', phone: '', address: '', state: 'Selangor' },
    { name: 'ParkCity Medical Centre', contact_person: 'Ms Hasliza', email: 'norhasliza.abdul@ramsaysimedarbyhealth.com', phone: '019-3473801', address: '', state: 'Kuala Lumpur' },
    { name: 'Pantai Mutiara Bayan Baru', contact_person: '', email: '', phone: '', address: '', state: 'Penang' },
    { name: 'Bukit Tinggi Medical Centre', contact_person: 'Mr Sazynarash', email: 'sazynrash@gmail.com', phone: '010-2132009', address: '', state: 'Selangor' },
    { name: 'Hospital IIUM Medical Centre', contact_person: 'En Mohd Noor', email: '', phone: '', address: '', state: 'Pahang' },
    { name: 'Kuantan Medical Centre', contact_person: '', email: '', phone: '', address: '', state: 'Pahang' },
    { name: 'SALAM Terengganu Specialist Hospital', contact_person: 'En Mohd Noor', email: '', phone: '', address: '', state: 'Terengganu' },
    { name: 'Kedah Medical Centre', contact_person: 'Ms Noratasha', email: '', phone: '', address: '', state: 'Kedah' },
  ];

  const equipmentTemplates = [
    { equipment_name: 'TITAN', model: 'TITAN', modules: 'DPOAE, TEOAE, ABR', status: 'Active' },
    { equipment_name: 'ECLIPSE', model: 'EP25', modules: 'ABR, ASSR, TEOAE', status: 'Active' },
    { equipment_name: 'AD629', model: 'AD629', modules: 'PTA, Speech', status: 'Active' },
    { equipment_name: 'AD226', model: 'AD226', modules: 'PTA', status: 'Active' },
    { equipment_name: 'Otoread', model: 'Otoread', modules: 'OAE', status: 'Active' },
    { equipment_name: 'AFFINITY COMPACT', model: 'Affinity 2.0', modules: 'PTA, Immittance', status: 'Active' },
    { equipment_name: 'SERA', model: 'SERA', modules: 'DPOAE', status: 'Active' },
    { equipment_name: 'Silent Cabin', model: 'SC-3', modules: '', status: 'Active' },
    { equipment_name: 'MT10-II', model: 'MT10-II', modules: 'Tympanometry', status: 'Active' },
  ];

  const calDates = [
    '2024-03-15', '2024-05-20', '2024-07-10', '2024-09-05',
    '2024-11-12', '2025-01-08', '2025-03-22', '2025-05-14',
    '2025-07-30', '2025-09-18', '2024-06-25', '2024-08-14',
    '2025-02-10', '2025-04-05', '2025-06-20', '2024-12-01',
    '2025-08-15', '2025-10-22', '2024-04-18', '2025-11-05',
  ];

  const seedTransaction = db.transaction(() => {
    customers.forEach((cust, ci) => {
      const result = insertCustomer.run(cust);
      const customerId = result.lastInsertRowid;

      const numEquip = 2 + (ci % 2);
      for (let ei = 0; ei < numEquip; ei++) {
        const tmpl = equipmentTemplates[(ci * 3 + ei) % equipmentTemplates.length];
        const serialNum = `SN${String(customerId).padStart(3, '0')}${String(ei + 1).padStart(2, '0')}${String(2020 + ci).slice(-2)}`;
        const eqResult = insertEquipment.run({
          customer_id: customerId,
          equipment_name: tmpl.equipment_name,
          model: tmpl.model,
          serial_number: serialNum,
          modules: tmpl.modules,
          status: tmpl.status,
        });
        const equipmentId = eqResult.lastInsertRowid;

        const calDate = calDates[(ci * 3 + ei) % calDates.length];
        const nextCalDate = addYears(calDate, 1);
        insertCal.run({
          equipment_id: equipmentId,
          customer_id: customerId,
          calibration_date: calDate,
          next_calibration_date: nextCalDate,
          performed_by: 'Tech Team',
          service_type: 'Calibration',
          cal_report_status: 'Completed',
        });
      }
    });
  });

  seedTransaction();
  console.log('Database seeded successfully.');
}

function importFromFile() {
  const importPath = path.join(__dirname, 'data', 'import_data.json');
  if (!fs.existsSync(importPath)) return;

  const db = getDb();

  // Only re-import when the file actually changes (hash-based lock)
  const crypto = require('crypto');
  const fileContent = fs.readFileSync(importPath, 'utf8');
  const fileHash = crypto.createHash('md5').update(fileContent).digest('hex');

  db.exec("CREATE TABLE IF NOT EXISTS import_log (key TEXT PRIMARY KEY, value TEXT)");
  const lastHash = db.prepare("SELECT value FROM import_log WHERE key='import_hash'").get();
  if (lastHash?.value === fileHash) {
    console.log('Import skipped: data already up to date');
    return;
  }

  const data = JSON.parse(fileContent);
  const { customers = [], equipment = [] } = data;

  const getCustomerByName = db.prepare('SELECT id FROM customers WHERE name = ?');
  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, contact_person, email, phone, address, location, state, country, import_source)
    VALUES (@name, @contact_person, @email, @phone, @address, @location, @state, @country, 'ppm')
  `);
  const updateCountry = db.prepare('UPDATE customers SET country = ? WHERE name = ? AND (country IS NULL OR country = ?)');

  // Equipment dedup: by serial number (if present), else by import_key stored in remarks
  const getEquipmentBySN  = db.prepare('SELECT id FROM equipment WHERE serial_number = ?');
  const getEquipmentByKey = db.prepare("SELECT id FROM equipment WHERE remarks LIKE 'IMPORT-KEY:%' AND remarks = ?");
  const updateEquipmentBrand = db.prepare('UPDATE equipment SET brand = ? WHERE id = ? AND (brand IS NULL OR brand = ?)');
  const insertEquipment = db.prepare(`
    INSERT INTO equipment
      (customer_id, equipment_name, brand, modules, otoaccess_version, software_version,
       serial_number, cal_code, status, installation_date, end_of_warranty,
       warranty_period, location, accessories, remarks)
    VALUES
      (@customer_id, @equipment_name, @brand, @modules, @otoaccess_version, @software_version,
       @serial_number, @cal_code, @status, @installation_date, @end_of_warranty,
       @warranty_period, @location, @accessories, @remarks)
  `);

  const calExists = db.prepare(
    'SELECT id FROM calibration_records WHERE equipment_id = ? AND calibration_date = ?'
  );
  const insertCal = db.prepare(`
    INSERT INTO calibration_records
      (equipment_id, customer_id, calibration_date, next_calibration_date,
       cal_report_status, service_type)
    VALUES
      (@equipment_id, @customer_id, @calibration_date, @next_calibration_date,
       @cal_report_status, 'Calibration')
  `);

  const deleteCustomerByName = db.prepare("DELETE FROM customers WHERE name = ? AND (import_source = 'ppm' OR import_source IS NULL)");
  const getPpmCustomerNames  = db.prepare("SELECT name FROM customers WHERE import_source = 'ppm' OR import_source IS NULL");

  const doImport = db.transaction(() => {
    let custAdded = 0, eqAdded = 0, calAdded = 0, custDeleted = 0;

    // Only delete PPM-sourced customers no longer in the PPM data (never touch sales customers)
    const importNames = new Set(customers.map(c => c.name));
    for (const { name } of getPpmCustomerNames.all()) {
      if (!importNames.has(name)) {
        deleteCustomerByName.run(name);
        custDeleted++;
      }
    }

    for (const c of customers) {
      if (!getCustomerByName.get(c.name)) {
        insertCustomer.run({
          name: c.name || null,
          contact_person: c.contact_person || null,
          email: c.email || null,
          phone: c.phone || null,
          address: c.address || null,
          location: c.location || null,
          state: c.state || null,
          country: c.country || null,
        });
        custAdded++;
      } else if (c.country) {
        updateCountry.run(c.country, c.name, c.country);
      }
    }

    equipment.forEach((eq, idx) => {
      const cust = getCustomerByName.get(eq.owner);
      if (!cust) return;

      const hasSN = eq.serial_number && String(eq.serial_number).trim() !== '';
      const importKey = hasSN ? null : `IMPORT-KEY:${eq.import_key || idx}`;

      let eqId;
      if (hasSN) {
        const existing = getEquipmentBySN.get(eq.serial_number);
        if (existing) eqId = existing.id;
      } else {
        const existing = getEquipmentByKey.get(importKey);
        if (existing) eqId = existing.id;
      }

      // Update brand on existing equipment that doesn't have one yet
      if (eqId && eq.brand) {
        updateEquipmentBrand.run(eq.brand, eqId, eq.brand);
      }

      if (!eqId) {
        const remarksVal = hasSN ? (eq.remarks || null) : importKey;
        const res = insertEquipment.run({
          customer_id: cust.id,
          equipment_name: eq.equipment_name || null,
          brand: eq.brand || null,
          modules: eq.modules || null,
          otoaccess_version: eq.otoaccess_version || null,
          software_version: eq.software_version || null,
          serial_number: hasSN ? eq.serial_number : null,
          cal_code: eq.cal_code || null,
          status: eq.status || null,
          installation_date: eq.installation_date || null,
          end_of_warranty: eq.end_of_warranty || null,
          warranty_period: eq.warranty_period || null,
          location: eq.location || null,
          accessories: eq.accessories || null,
          remarks: remarksVal,
        });
        eqId = res.lastInsertRowid;
        eqAdded++;
      }

      if (eqId && eq.last_calibration) {
        if (!calExists.get(eqId, eq.last_calibration)) {
          const next = new Date(eq.last_calibration);
          if (isNaN(next.getTime())) {
            console.warn(`Skipping bad date for equipment ${eq.equipment_name}: ${eq.last_calibration}`);
            return;
          }
          next.setFullYear(next.getFullYear() + 1);
          insertCal.run({
            equipment_id: eqId,
            customer_id: cust.id,
            calibration_date: eq.last_calibration,
            next_calibration_date: next.toISOString().slice(0, 10),
            cal_report_status: eq.cal_report_status || 'Completed',
          });
          calAdded++;
        }
      }
    });

    console.log(`Import complete: +${custAdded} added, -${custDeleted} deleted customers, +${eqAdded} equipment, +${calAdded} calibration records`);
    // If customers were deleted, force sales import to re-run so their records are restored
    if (custDeleted > 0) {
      db.prepare("DELETE FROM import_log WHERE key='sales_hash'").run();
    }
  });

  try {
    doImport();
    db.prepare("INSERT OR REPLACE INTO import_log (key, value) VALUES ('import_hash', ?)").run(fileHash);
  } catch (e) {
    console.error('Import error:', e.message);
  }
}

function importSalesFromFile() {
  const salesPath = path.join(__dirname, 'data', 'import_sales.json');
  if (!fs.existsSync(salesPath)) return;

  const db = getDb();
  const crypto = require('crypto');
  const fileContent = fs.readFileSync(salesPath, 'utf8');
  const fileHash = crypto.createHash('md5').update(fileContent).digest('hex');

  db.exec("CREATE TABLE IF NOT EXISTS import_log (key TEXT PRIMARY KEY, value TEXT)");
  const lastHash = db.prepare("SELECT value FROM import_log WHERE key='sales_hash'").get();
  if (lastHash?.value === fileHash) {
    console.log('Sales import skipped: already up to date');
    return;
  }

  const { customers = [], jobs = [] } = JSON.parse(fileContent);

  const getCustomerByName = db.prepare('SELECT id FROM customers WHERE UPPER(name) = UPPER(?)');
  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, country, contact_person, phone, address, email, state, location, import_source)
    VALUES (@name, @country, @contact_person, @phone, @address, @email, @state, @location, 'sales')
  `);
  const jobExists = db.prepare(
    "SELECT id FROM calibration_records WHERE job_sheet_number = ? AND customer_id = ?"
  );
  const insertJob = db.prepare(`
    INSERT INTO calibration_records
      (customer_id, calibration_date, service_type, job_sheet_number, notes, fee, currency, cal_report_status)
    VALUES
      (@customer_id, @calibration_date, @service_type, @job_sheet_number, @notes, @fee, @currency, @cal_report_status)
  `);

  const doSalesImport = db.transaction(() => {
    let custAdded = 0, jobAdded = 0, skipped = 0;

    // Ensure all customers exist
    for (const c of customers) {
      if (!getCustomerByName.get(c.name)) {
        insertCustomer.run({
          name: c.name, country: c.country || 'Malaysia',
          contact_person: c.contact_person || null, phone: c.phone || null,
          address: c.address || null, email: c.email || null,
          state: c.state || null, location: c.location || null,
        });
        custAdded++;
      }
    }

    // Import jobs
    for (const j of jobs) {
      const cust = getCustomerByName.get(j.customer_name);
      if (!cust) { skipped++; continue; }

      if (j.job_sheet_number && jobExists.get(j.job_sheet_number, cust.id)) {
        skipped++;
        continue;
      }

      insertJob.run({
        customer_id: cust.id,
        calibration_date: j.calibration_date || null,
        service_type: j.service_type,
        job_sheet_number: j.job_sheet_number || null,
        notes: j.notes || null,
        fee: j.fee || null,
        currency: j.currency || 'MYR',
        cal_report_status: j.cal_report_status || 'Completed',
      });
      jobAdded++;
    }

    console.log(`Sales import: +${custAdded} customers, +${jobAdded} jobs added, ${skipped} skipped`);
  });

  try {
    doSalesImport();
    db.prepare("INSERT OR REPLACE INTO import_log (key, value) VALUES ('sales_hash', ?)").run(fileHash);
  } catch (e) {
    console.error('Sales import error:', e.message);
  }
}

function importInvoicesFromFile() {
  const invoicePath = path.join(__dirname, 'data', 'import_invoices.json');
  if (!fs.existsSync(invoicePath)) return;

  const db = getDb();
  const crypto = require('crypto');
  const fileContent = fs.readFileSync(invoicePath, 'utf8');
  const fileHash = crypto.createHash('md5').update(fileContent).digest('hex');

  db.exec("CREATE TABLE IF NOT EXISTS import_log (key TEXT PRIMARY KEY, value TEXT)");
  const lastHash = db.prepare("SELECT value FROM import_log WHERE key='invoices_hash'").get();
  if (lastHash?.value === fileHash) {
    console.log('Invoice import skipped: already up to date');
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sell_to_no TEXT,
      family_decrip TEXT,
      item_description TEXT,
      invoice_year INTEGER,
      invoice_month INTEGER,
      quantity INTEGER DEFAULT 1,
      invoice_key TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const { invoices = [] } = JSON.parse(fileContent);
  const insertInvoice = db.prepare(`
    INSERT OR REPLACE INTO invoice_records
      (sell_to_no, family_decrip, item_description, invoice_year, invoice_month, quantity, invoice_key)
    VALUES
      (@sell_to_no, @family_decrip, @item_description, @invoice_year, @invoice_month, @quantity, @invoice_key)
  `);

  const doInvoiceImport = db.transaction(() => {
    // Full refresh: clear old data then re-insert from file
    db.exec('DELETE FROM invoice_records');
    for (const inv of invoices) {
      insertInvoice.run(inv);
    }
    console.log(`Invoice import: ${invoices.length} records loaded`);
  });

  try {
    doInvoiceImport();
    db.prepare("INSERT OR REPLACE INTO import_log (key, value) VALUES ('invoices_hash', ?)").run(fileHash);
  } catch (e) {
    console.error('Invoice import error:', e.message);
  }
}

// Tag known dealers (Global Precision, Philiear, Ahza — same management group).
// Must run AFTER imports, not during initDb() — imports populate/refresh the customers
// table, so tagging beforehand matches zero rows on a fresh boot and silently no-ops.
// Match anywhere in the name, not just prefix — real records look like
// "UCSI GLOBAL PRECISION SUPPLY" or "HUSM (SUPPLY BY AHZA EXCELLENT)".
function tagDealers() {
  const db = getDb();
  // Migrate any legacy 'Distributor' value from before the Dealer rename
  db.prepare(`UPDATE customers SET customer_type = 'Dealer' WHERE customer_type = 'Distributor'`).run();
  const result = db.prepare(`
    UPDATE customers SET customer_type = 'Dealer'
    WHERE name LIKE '%Global Precision%' OR name LIKE '%Philiear%' OR name LIKE '%Ahza%'
  `).run();
  if (result.changes > 0) console.log(`Tagged ${result.changes} dealer customers`);
}

module.exports = { getDb, initDb, importFromFile, importSalesFromFile, importInvoicesFromFile, tagDealers };
