# CalibPro — Calibration Management System

Full-stack web application for managing audiological equipment calibration schedules across hospitals and clinics in Malaysia.

## Tech Stack

- **Frontend**: React 18 + Vite + TailwindCSS + Recharts
- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)
- **Export**: ExcelJS

---

## Quick Start

### Prerequisites
- Node.js 18+ (v24 recommended)
- npm

### 1. Install Backend

```bash
cd backend
npm install
```

### 2. Install Frontend

```bash
cd frontend
npm install
```

### 3. Run in Development

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd backend
node server.js
# Runs on http://localhost:3001
# Database auto-created and seeded on first run
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
# API calls proxied to :3001 automatically
```

Open **http://localhost:5173** in your browser.

### 4. Run in Production

```bash
cd frontend
npm run build        # builds to frontend/dist/

cd ../backend
node server.js       # serves frontend/dist/ + API on :3001
```

Open **http://localhost:3001**.

---

## Features

| Page | Description |
|------|-------------|
| **Dashboard** | Metric cards, overdue/due-soon alerts, bar chart (monthly cals), pie chart (status), recent activity |
| **Customers** | Searchable/filterable table, add customer modal, click-through to detail |
| **Customer Detail** | Edit customer info, manage equipment, view calibration history, record calibration |
| **Equipment** | Full equipment list with type/status/state filters, inline calibration recording |
| **Schedule** | Calibration schedule sorted by next-due date, colour-coded priority, Excel export |
| **Export** | One-click Excel exports (Master DB + Schedule) with colour-coded rows |

## Calibration Logic

- **Next calibration** = calibration date + exactly 1 year
- **Overdue** = next calibration date < today (red)
- **Due Soon** = next calibration date within 30 days (amber)
- **Scheduled** = next calibration date > 30 days away (green)

## Database

SQLite file lives at `backend/calibration.db`. Seeded on first run with 20 customers and 50 equipment units across Malaysia. Delete `calibration.db` to reset and re-seed.

## API Endpoints

```
GET/POST   /api/customers
GET/PUT/DELETE  /api/customers/:id

GET/POST   /api/equipment
GET/PUT/DELETE  /api/equipment/:id

GET/POST   /api/calibrations
GET        /api/calibrations/due
GET        /api/calibrations/overdue
GET/PUT/DELETE  /api/calibrations/:id

GET        /api/dashboard/stats
GET        /api/export/master     → .xlsx download
GET        /api/export/schedule   → .xlsx download
```

## Excel Export Format

**Master Database** (`CalibrationDatabase_YYYY-MM-DD.xlsx`):
- Columns: NO, CUSTOMER, EQUIPMENT, MODEL, MODULE, SERIAL NO, STATUS, STATE, CONTACT, EMAIL, PHONE, LAST CALIBRATION, NEXT CALIBRATION, DAYS OVERDUE, WARRANTY, REMARKS, LAST UPDATED
- Navy header (#0D2847), frozen row, auto-filter enabled
- Overdue rows: red (#FDECEA), Due-soon rows: amber (#FFF3CD)

**Calibration Schedule** (`CalibrationSchedule_YYYY-MM-DD.xlsx`):
- Latest calibration record per equipment, sorted by next due date
- Same colour-coding as master
