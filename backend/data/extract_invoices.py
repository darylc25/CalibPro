"""
Extract new equipment invoice records from sales file into import_invoices.json.
Run: python3 backend/data/extract_invoices.py
"""
import json, openpyxl

XLSX = "/Users/darylchow/Documents/Calibration reports/Main Master IA Total Sales_Market Segment file.xlsx"
SHEET = "Y19,20,21,22,23,24,25 main file"
OUT = "/Users/darylchow/Documents/Claude/calibration-app/backend/data/import_invoices.json"

# Standalone instrument families that require periodic calibration
# (Excludes: disposables, services, spare parts, software modules, accessories,
#  and 'Others - nonWDH Instruments' which contains speech word lists, printers, furniture)
INSTRUMENT_FAMILIES = {
    # Interacoustics — ABR / OAE / screening
    'Titan Hardware', 'Eclipse Hardware', 'Lyra Hardware',
    'OtoRead Screening', 'OtoRead Standard', 'OtoRead Clinical', 'Sera',
    # Interacoustics — Audiometers
    'AD 226', 'AD 229/AD 629', 'AD 528', 'AC 40 / AC 33', 'AA 222/AA 220',
    'MT 10', 'PA 5',
    # Interacoustics — Hearing aid fitting / REM (also require calibration)
    'Affinity Compact', 'Affinity', 'Equinox', 'Equinox EVO', 'Callisto',
    'TBS 25M', 'TBS10',
    # Interacoustics — Tympanometers / impedance
    'IMP 440 Diagnostic', 'IMP 440 Clinical', 'IMP 440 Screening',
    'AT 235/AT 235h', 'WBT 440',
    # Interacoustics — Balance / vestibular
    'EyeSeeCam vHIT',
    # Interacoustics — Screening
    'VRA System', 'Vision Screeners',
    # Amplivox audiometers (sold by Diatec)
    '240', '270', '116', '170',
    'Other Diagnostic/Clinical AM',  # Amplivox Model 270+ and other Amplivox diagnostics
    # Other branded instruments
    'AS 608b/608e',
    'Otowave 102', 'Otowave 302/302+', 'Otowave',
    'Spirometers', 'VIOT Video Otoscope',
    'Verifit2', 'RadioEar',
}

MONTH_MAP = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4,
    'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8,
    'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12,
}

wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
ws = wb[SHEET]
rows = list(ws.iter_rows(values_only=True))

records = []
skipped = 0

for i, row in enumerate(rows[1:], start=1):
    year       = row[0]
    month_str  = str(row[1]).strip() if row[1] else ''
    doc_no     = str(row[2]).strip() if row[2] else ''
    sell_to    = str(row[3]).strip() if row[3] else ''
    family     = str(row[6]).strip() if row[6] else ''
    desc       = str(row[7]).strip() if row[7] else ''
    qty        = row[8]

    if not isinstance(year, (int, float)) or not family:
        skipped += 1
        continue
    if family not in INSTRUMENT_FAMILIES:
        continue

    month_num = MONTH_MAP.get(month_str)
    if not month_num:
        skipped += 1
        continue

    records.append({
        'sell_to_no': sell_to,
        'family_decrip': family,
        'item_description': desc,
        'invoice_year': int(year),
        'invoice_month': month_num,
        'quantity': int(qty) if isinstance(qty, (int, float)) else 1,
        'invoice_key': f'{doc_no}-{i}',
    })

from collections import Counter
by_year = Counter(r['invoice_year'] for r in records)
print(f"Total instrument records: {len(records)} (skipped {skipped})")
print("By year:", dict(sorted(by_year.items())))

out = {'_version': '2026-06-16-v3', 'invoices': records}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
print(f"Written to {OUT}")
