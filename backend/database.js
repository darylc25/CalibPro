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
      role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      name TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedIfEmpty(db);
  seedUsers(db);
  return db;
}

function seedUsers(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0) return;
  const bcrypt = require('bcryptjs');
  const users = [
    { username: 'admin', password: 'Admin@123', role: 'admin', name: 'Administrator' },
    { username: 'user', password: 'User@123', role: 'user', name: 'Standard User' },
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

module.exports = { getDb, initDb };
