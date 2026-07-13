"""
Extract data from PPM Schedule 2026.xlsx into import_data.json.
Run: python3 backend/data/extract_ppm.py
"""
import json, re, openpyxl
from datetime import datetime

XLSX = "/Users/darylchow/Documents/Calibration reports/PPM Schedule 2026.xlsx"
OUT  = "/Users/darylchow/Documents/Claude/calibration-app/backend/data/import_data.json"

def clean(v):
    if v is None: return None
    if isinstance(v, datetime): return v.strftime('%Y-%m-%d')
    s = str(v).strip().replace('\xa0', ' ').replace('\n', ' ')
    return s if s and s not in ('-', '#VALUE!', 'None') else None

def detect_country_from_name(name):
    n = (name or '').lower()
    if 'thailand' in n: return 'Thailand'
    if 'hong kong' in n or ' hk' in n or '-ec(hk)' in n: return 'Hong Kong'
    if 'cambodia' in n: return 'Cambodia'
    if 'vietnam' in n or 'viet' in n: return 'Vietnam'
    if 'mynamar' in n or 'myanmar' in n: return 'Myanmar'
    if 'indonesia' in n: return 'Indonesia'
    if 'philippines' in n or 'phili' in n: return 'Philippines'
    if 'singapore' in n: return None  # exclude Singapore
    return 'Others'

wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)

customers_map = {}  # name -> customer dict
equipment_list = []

def get_or_create_customer(name, country, contact=None, phone=None, address=None):
    if not name: return None
    name = name.strip()
    if name not in customers_map:
        customers_map[name] = {
            'name': name,
            'country': country,
            'contact_person': clean(contact),
            'phone': clean(phone),
            'address': clean(address),
            'email': None,
            'state': None,
            'location': None,
        }
    else:
        # Update missing fields
        c = customers_map[name]
        if not c.get('contact_person') and contact: c['contact_person'] = clean(contact)
        if not c.get('phone') and phone: c['phone'] = clean(phone)
        if not c.get('address') and address: c['address'] = clean(address)
    return name

eq_idx = 0

# ── MA sheet (Malaysia, header at row 0) ────────────────────────────────────
ws = wb['MA']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i == 0: continue  # skip header
    eq_name = clean(row[0])
    sn       = clean(row[1])
    owner    = clean(row[2])
    cal_date = clean(row[3])
    contact  = clean(row[5]) if len(row) > 5 else None
    phone    = clean(row[6]) if len(row) > 6 else None
    address  = clean(row[7]) if len(row) > 7 else None
    if not eq_name or not owner: continue

    cname = get_or_create_customer(owner, 'Malaysia', contact, phone, address)
    equipment_list.append({
        'owner': cname,
        'equipment_name': eq_name,
        'brand': 'Interacoustics',
        'serial_number': sn,
        'modules': None,
        'otoaccess_version': None,
        'software_version': None,
        'cal_code': None,
        'status': None,
        'last_calibration': cal_date,
        'cal_report_status': 'Completed',
        'import_key': f'MA-{i}',
    })
    eq_idx += 1

# ── Interacoustics sheet (Malaysia, has header at row 0) ────────────────────
ws = wb['Interacoustics']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i == 0: continue  # skip header
    eq_name  = clean(row[0])
    modules  = clean(row[1])
    oa_ver   = clean(row[2])
    sw_ver   = clean(row[3])
    sn       = clean(row[4])
    cal_code = clean(row[5])
    owner    = clean(row[6])
    status   = clean(row[7])
    if not eq_name or not owner: continue

    cname = get_or_create_customer(owner, 'Malaysia')
    equipment_list.append({
        'owner': cname,
        'equipment_name': eq_name,
        'brand': 'Interacoustics',
        'serial_number': sn,
        'modules': modules,
        'otoaccess_version': oa_ver,
        'software_version': sw_ver,
        'cal_code': cal_code,
        'status': status,
        'last_calibration': None,
        'cal_report_status': None,
        'import_key': f'IA-{i}',
    })
    eq_idx += 1

# ── PIVOT 1 sheet — SKIP (Singapore data) ──────────────────────────────────

# ── Philiear sheet (Philippines, header at row 0) ───────────────────────────
ws = wb['Philiear']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i == 0: continue
    eq_name  = clean(row[0])
    sn       = clean(row[1])
    owner    = clean(row[2])
    cal_date = clean(row[3])
    contact  = clean(row[5]) if len(row) > 5 else None
    phone    = clean(row[6]) if len(row) > 6 else None
    address  = clean(row[7]) if len(row) > 7 else None
    if not eq_name or not owner: continue

    cname = get_or_create_customer(owner, 'Philippines', contact, phone, address)
    equipment_list.append({
        'owner': cname,
        'equipment_name': eq_name,
        'brand': 'Interacoustics',
        'serial_number': sn,
        'modules': None,
        'otoaccess_version': None,
        'software_version': None,
        'cal_code': None,
        'status': None,
        'last_calibration': cal_date,
        'cal_report_status': 'Completed',
        'import_key': f'PH-{i}',
    })

# ── Indonesia sheet (header at row 0) ───────────────────────────────────────
ws = wb['Indonesia']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i == 0: continue
    eq_name  = clean(row[0])
    sn       = clean(row[1])
    owner    = clean(row[2])
    cal_date = clean(row[3])
    contact  = clean(row[5]) if len(row) > 5 else None
    phone    = clean(row[6]) if len(row) > 6 else None
    address  = clean(row[7]) if len(row) > 7 else None
    if not eq_name or not owner: continue

    cname = get_or_create_customer(owner, 'Indonesia', contact, phone, address)
    equipment_list.append({
        'owner': cname,
        'equipment_name': eq_name,
        'brand': 'Interacoustics',
        'serial_number': sn,
        'modules': None,
        'otoaccess_version': None,
        'software_version': None,
        'cal_code': None,
        'status': None,
        'last_calibration': cal_date,
        'cal_report_status': 'Completed',
        'import_key': f'ID-{i}',
    })

# ── Vietnam sheet (header at row 0) ─────────────────────────────────────────
ws = wb['Vietnam']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i == 0: continue
    eq_name  = clean(row[0])
    sn       = clean(row[1])
    owner    = clean(row[2])
    cal_date = clean(row[3])
    contact  = clean(row[5]) if len(row) > 5 else None
    phone    = clean(row[6]) if len(row) > 6 else None
    address  = clean(row[7]) if len(row) > 7 else None
    if not eq_name or not owner: continue

    cname = get_or_create_customer(owner, 'Vietnam', contact, phone, address)
    equipment_list.append({
        'owner': cname,
        'equipment_name': eq_name,
        'brand': 'Interacoustics',
        'serial_number': sn,
        'modules': None,
        'otoaccess_version': None,
        'software_version': None,
        'cal_code': None,
        'status': None,
        'last_calibration': cal_date,
        'cal_report_status': 'Completed',
        'import_key': f'VN-{i}',
    })

# ── Others sheet (mixed countries, header at row 0) ─────────────────────────
ws = wb['Others']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i == 0: continue
    eq_name  = clean(row[0])
    sn       = clean(row[1])
    owner    = clean(row[2])
    cal_date = clean(row[3])
    contact  = clean(row[5]) if len(row) > 5 else None
    phone    = clean(row[6]) if len(row) > 6 else None
    address  = clean(row[7]) if len(row) > 7 else None
    if not eq_name or not owner: continue

    country = detect_country_from_name(owner)
    if country is None: continue  # skip Singapore

    cname = get_or_create_customer(owner, country, contact, phone, address)
    equipment_list.append({
        'owner': cname,
        'equipment_name': eq_name,
        'brand': 'Interacoustics',
        'serial_number': sn,
        'modules': None,
        'otoaccess_version': None,
        'software_version': None,
        'cal_code': None,
        'status': None,
        'last_calibration': cal_date,
        'cal_report_status': 'Completed',
        'import_key': f'OT-{i}',
    })

customers_list = list(customers_map.values())

# Country summary
from collections import Counter
cc = Counter(c['country'] for c in customers_list)
print("Customer count by country:", dict(cc))
print(f"Total customers: {len(customers_list)}, equipment: {len(equipment_list)}")

out = {'customers': customers_list, 'equipment': equipment_list}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
print(f"Written to {OUT}")
