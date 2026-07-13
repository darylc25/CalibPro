"""
Extract CAL_A / CAL_B / SERV_A / SERV_B job records from sales Excel.
Run: python3 backend/data/extract_sales.py
"""
import json, openpyxl
from datetime import datetime

XLSX = "/Users/darylchow/Documents/Calibration reports/Calibration sales 2018 2025 .xlsx"
OUT  = "/Users/darylchow/Documents/Claude/calibration-app/backend/data/import_sales.json"

SERVICE_TYPE_MAP = {
    'CAL_A': ('Calibration', 'Customer calibration'),
    'CAL_B': ('Calibration', 'Internal/intercompany calibration'),
    'SERV_A': ('Repair', 'Customer service & repair'),
    'SERV_B': ('Repair', 'Internal service & repair'),
}

VALID_CODES = set(SERVICE_TYPE_MAP.keys())

def clean(v):
    if v is None: return None
    if isinstance(v, datetime): return v.strftime('%Y-%m-%d')
    s = str(v).strip()
    return s if s and s not in ('None', '-', 'nan') else None

wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
ws = wb['18-25']
rows = list(ws.iter_rows(values_only=True))
headers = list(rows[0])

cust_col  = headers.index('Customer Name')
date_col  = headers.index('Posting Date')
doc_col   = headers.index('Document No.')
order_col = headers.index('Order No.')
item_col  = headers.index('Item No.')
desc_col  = headers.index('Item Description')
qty_col   = headers.index('Quantity')
amt_col   = headers.index('Total Amount')

customers_map = {}  # name -> customer dict
jobs = []

for i, row in enumerate(rows[1:], 1):
    code = clean(row[item_col])
    if not code or code not in VALID_CODES:
        continue

    cust_name = clean(row[cust_col])
    if not cust_name:
        continue

    # Normalise name to title case for display
    display_name = cust_name.title()

    if display_name not in customers_map:
        customers_map[display_name] = {
            'name': display_name,
            'country': 'Malaysia',  # all sales data is MY-based
            'contact_person': None,
            'phone': None,
            'address': None,
            'email': None,
            'state': None,
            'location': None,
        }

    service_type, type_note = SERVICE_TYPE_MAP[code]
    item_desc = clean(row[desc_col]) or ''
    doc_no    = clean(row[doc_col])
    order_no  = clean(row[order_col])
    cal_date  = clean(row[date_col])
    amount    = clean(row[amt_col])

    # Build note: type context + item description
    note_parts = [type_note]
    if item_desc and item_desc.lower() != type_note.lower():
        note_parts.append(item_desc)
    note = ' | '.join(note_parts)

    jobs.append({
        'customer_name': display_name,
        'service_type': service_type,
        'calibration_date': cal_date,
        'job_sheet_number': doc_no,
        'order_number': order_no,
        'item_code': code,
        'notes': note,
        'fee': float(amount) if amount else None,
        'currency': 'MYR',
        'cal_report_status': 'Completed',
    })

customers_list = list(customers_map.values())

from collections import Counter
print(f"Unique customers in sales: {len(customers_list)}")
print(f"Total job records: {len(jobs)}")
print("By code:", dict(Counter(j['item_code'] for j in jobs)))
print("Date range:", min(j['calibration_date'] for j in jobs if j['calibration_date']),
      "→", max(j['calibration_date'] for j in jobs if j['calibration_date']))

out = {'customers': customers_list, 'jobs': jobs}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
print(f"Written to {OUT}")
