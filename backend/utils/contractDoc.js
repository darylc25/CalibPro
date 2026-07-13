'use strict';
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  LevelFormat, Header, Footer, PageNumber,
} = require('docx');

// A4 dimensions in DXA (1 inch = 1440 DXA)
const PAGE_W   = 11906;
const MARGIN   = 1134; // ~0.79 in (2 cm)
const CONTENT  = PAGE_W - 2 * MARGIN; // 9638 DXA
const NAVY     = '1A4B8C';
const LIGHT_BG = 'EBF3FF';
const GRAY_BG  = 'F5F5F5';
const FONT     = 'Calibri';
const SM       = 20; // 10pt
const BODY     = 22; // 11pt
const BOLD_SZ  = 22;

function fmtMYR(amount) {
  const n = Number(amount);
  return 'RM ' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ordinalLabel(n) {
  const labels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
  return (labels[n - 1] || `${n}th`) + ' Year';
}

function formatContractDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const suffix = [, 'st', 'nd', 'rd'][day % 10 <= 3 && Math.floor(day / 10) !== 1 ? day % 10 : 0] || 'th';
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${day}${suffix} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const CELL_MARGIN = { top: 80, bottom: 80, left: 120, right: 120 };

function border(color = 'D0D7E3', size = 4) {
  const b = { style: BorderStyle.SINGLE, size, color };
  return { top: b, bottom: b, left: b, right: b };
}

function noBorder() {
  const b = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: b, bottom: b, left: b, right: b };
}

function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: opts.size || BODY, bold: opts.bold, color: opts.color, ...opts });
}

function para(children, opts = {}) {
  if (typeof children === 'string') children = [run(children)];
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: opts.before ?? 80, after: opts.after ?? 80, line: opts.line ?? 276 },
    indent: opts.indent ? { left: opts.indent } : undefined,
    children,
  });
}

function spacer(pt = 6) {
  return para([run('')], { before: 0, after: 0, line: pt * 20 });
}

function clauseHead(number, title) {
  return para([run(`${number}. ${title}`, { bold: true, size: BOLD_SZ })], { before: 200, after: 80 });
}

function subPara(label, text) {
  return para([run(`(${label}) `, { bold: true }), run(text)], { indent: 480, before: 60, after: 60 });
}

function subParaMulti(label, runs) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 276 },
    indent: { left: 480 },
    children: [run(`(${label}) `, { bold: true }), ...runs],
  });
}

function note(text) {
  return para([run('* ', { bold: true }), run(text)], { before: 40, after: 40 });
}

function bold(text, size) { return run(text, { bold: true, size: size || BOLD_SZ }); }

// ── Contract Value Table ─────────────────────────────────────────────────────

function buildContractValueTable(contract) {
  const { equipment_model, serial_number, annual_fee, total_value, duration_years, contract_start_year } = contract;

  // Build equipment list — prefer equipment_list JSON, fall back to legacy single fields
  let equipList = [];
  if (contract.equipment_list && Array.isArray(contract.equipment_list) && contract.equipment_list.length > 0) {
    equipList = contract.equipment_list;
  } else if (equipment_model) {
    equipList = [{ equipment_model, serial_number }];
  }

  const N = Number(duration_years);
  const MODEL_W = 2400;
  const YEAR_W  = Math.floor((CONTENT - MODEL_W) / N);
  const LAST_W  = CONTENT - MODEL_W - (N - 1) * YEAR_W;
  const colWidths = [MODEL_W, ...Array(N - 1).fill(YEAR_W), LAST_W];
  const years = Array.from({ length: N }, (_, i) => Number(contract_start_year) + i);
  const feeFmt   = fmtMYR(annual_fee);
  const totalFmt = fmtMYR(total_value);

  function hdrCell(text, lines, width) {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: { fill: NAVY, type: ShadingType.CLEAR },
      borders: border('FFFFFF'),
      margins: CELL_MARGIN,
      verticalAlign: VerticalAlign.CENTER,
      children: lines.map(l => new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20, after: 20 },
        children: [run(l, { bold: true, color: 'FFFFFF', size: SM })],
      })),
    });
  }

  function feeCell(text, width, bg) {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: { fill: bg || 'FFFFFF', type: ShadingType.CLEAR },
      borders: border(),
      margins: CELL_MARGIN,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20, after: 20 },
        children: [run(text, { size: BODY })],
      })],
    });
  }

  const headerRow = new TableRow({ children: [
    hdrCell('Model', ['Model'], MODEL_W),
    ...years.map((yr, i) => hdrCell(ordinalLabel(i + 1), [ordinalLabel(i + 1), String(yr)], colWidths[i + 1])),
  ]});

  // Build model cell children — one entry per equipment
  const modelCellChildren = [];
  equipList.forEach((eq, idx) => {
    modelCellChildren.push(
      para([run(eq.equipment_model || '', { bold: true })], { before: idx === 0 ? 20 : 10, after: 4 })
    );
    if (eq.serial_number) {
      modelCellChildren.push(
        para([run(`S/N: ${eq.serial_number}`, { size: SM, color: '666666' })], { before: 0, after: idx === equipList.length - 1 ? 20 : 8 })
      );
    }
  });
  if (modelCellChildren.length === 0) {
    modelCellChildren.push(para([run('')], { before: 20, after: 20 }));
  }

  const dataRow = new TableRow({ children: [
    new TableCell({
      width: { size: MODEL_W, type: WidthType.DXA },
      shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
      borders: border(),
      margins: CELL_MARGIN,
      verticalAlign: VerticalAlign.CENTER,
      children: modelCellChildren,
    }),
    ...years.map((_, i) => feeCell(feeFmt, colWidths[i + 1], i % 2 === 0 ? 'FFFFFF' : 'F7F9FF')),
  ]});

  const totalLabelWidth = MODEL_W + (N - 1) * YEAR_W;
  const totalRow = new TableRow({ children: [
    new TableCell({
      columnSpan: N,
      width: { size: totalLabelWidth, type: WidthType.DXA },
      shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
      borders: border(),
      margins: CELL_MARGIN,
      verticalAlign: VerticalAlign.CENTER,
      children: [para([bold(`Total Value of ${N} Year${N > 1 ? 's' : ''}’ Service Contract`)], { before: 20, after: 20 })],
    }),
    new TableCell({
      width: { size: LAST_W, type: WidthType.DXA },
      shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
      borders: border(),
      margins: CELL_MARGIN,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20, after: 20 },
        children: [bold(totalFmt)],
      })],
    }),
  ]});

  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, dataRow, totalRow],
  });
}

// ── Travelling Cost Table ────────────────────────────────────────────────────

function buildTravelTable() {
  const REG_W  = 6200;
  const COST_W = CONTENT - REG_W;
  const rows = [
    ['REGION', 'TRAVELLING COST PER TRIP', true],
    ['KL & Selangor', 'RM 500.00', false],
    ['Negeri Sembilan, Melaka & Ipoh', 'RM 800.00', false],
    ['Pahang, Terengganu, Kelantan, Penang & Johor', 'RM 1,300.00', false],
    ['Perlis, Sabah & Sarawak', 'RM 1,800.00', false],
    ['Brunei', 'RM 3,600.00', false],
  ];

  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [REG_W, COST_W],
    rows: rows.map(([region, cost, isHdr]) => new TableRow({ children: [
      new TableCell({
        width: { size: REG_W, type: WidthType.DXA },
        shading: { fill: isHdr ? NAVY : 'FFFFFF', type: ShadingType.CLEAR },
        borders: border(),
        margins: CELL_MARGIN,
        children: [para([run(region, { bold: isHdr, color: isHdr ? 'FFFFFF' : '000000', size: BODY })], { before: 40, after: 40 })],
      }),
      new TableCell({
        width: { size: COST_W, type: WidthType.DXA },
        shading: { fill: isHdr ? NAVY : LIGHT_BG, type: ShadingType.CLEAR },
        borders: border(),
        margins: CELL_MARGIN,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 40 },
          children: [run(cost, { bold: isHdr, color: isHdr ? 'FFFFFF' : '000000', size: BODY })],
        })],
      }),
    ]})),
  });
}

// ── Signature Table ──────────────────────────────────────────────────────────

function buildSigTable(customerName) {
  const COL = Math.floor(CONTENT / 2);
  function sigCell(lines, width) {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      borders: noBorder(),
      margins: CELL_MARGIN,
      children: lines.map(l => para([run(l, { size: BODY })], { before: 60, after: 60 })),
    });
  }
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [COL, CONTENT - COL],
    rows: [new TableRow({ children: [
      sigCell([
        '……………………………',
        `For and on behalf of ${customerName}`,
        '……………………………',
        'Witness by',
        'Name:',
        'Date:',
      ], COL),
      sigCell([
        '……………………………',
        'For and on behalf of Demant Malaysia Sdn. Bhd.',
        '……………………………',
        'Witness by',
        'Name:',
        'Date:',
      ], CONTENT - COL),
    ]})],
  });
}

// ── Main generator ───────────────────────────────────────────────────────────

async function generateContractDoc(contract) {
  const {
    contract_number, customer_name, customer_address_1, customer_address_2,
    customer_city_postcode, customer_state, customer_tel, contract_date,
    duration_years, contract_start_year, contract_end_year, annual_fee,
  } = contract;

  const N        = Number(duration_years);
  const feeFmt   = fmtMYR(annual_fee);
  const cnFmt    = contract_number;
  const startYr  = Number(contract_start_year);
  const endYr    = Number(contract_end_year);

  const children = [

    // ── Contract number (right-aligned) ──────────────────────────────────────
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 120 },
      children: [run('Contract No: ', { bold: true }), run(cnFmt, { bold: true, color: NAVY })],
    }),

    // ── Customer address block ────────────────────────────────────────────────
    para([bold(customer_name)], { before: 0, after: 40 }),
    ...(customer_address_1 ? [para([run(customer_address_1)], { before: 0, after: 40 })] : []),
    ...(customer_address_2 ? [para([run(customer_address_2)], { before: 0, after: 40 })] : []),
    ...(customer_city_postcode ? [para([run(customer_city_postcode)], { before: 0, after: 40 })] : []),
    ...(customer_state ? [para([run(customer_state)], { before: 0, after: 40 })] : []),
    ...(customer_tel ? [para([run(`Tel: ${customer_tel}`)], { before: 0, after: 40 })] : []),
    spacer(8),
    para([run(formatContractDate(contract_date))], { before: 0, after: 80 }),
    spacer(8),

    // ── Salutation ────────────────────────────────────────────────────────────
    para([run('Dear Sir/Madam,')], { before: 0, after: 120 }),

    // ── Subject ───────────────────────────────────────────────────────────────
    new Paragraph({
      spacing: { before: 0, after: 120, line: 276 },
      children: [bold(`PROPOSAL OF NON-COMPREHENSIVE MAINTENANCE SERVICE CONTRACT FOR ${customer_name.toUpperCase()}`)],
    }),

    // ── Intro ─────────────────────────────────────────────────────────────────
    para([run('Thank you for supporting Interacoustics products all these years. We are pleased to propose a service contract covering the following machine for your kind consideration:')], { before: 0, after: 160 }),

    // ── Contract Value Table ──────────────────────────────────────────────────
    buildContractValueTable(contract),
    spacer(6),

    // ── Table footnotes ───────────────────────────────────────────────────────
    note('The above charges do not include any spare parts replacement.'),
    note(`This Service Contract period starting from ${startYr} until ${endYr}.`),
    note('The Service Contract does not include Electrical Safety Test (EST).'),
    note('The above mentioned charges will be automatically billed yearly upon completing the Preventive Maintenance Service (calibration).'),
    note('The price mentioned does not include SST at the prevailing rate (currently 8%). SST will be applied on the above charges and any repair services.'),
    spacer(10),

    // ── Terms & Conditions ────────────────────────────────────────────────────
    para([bold('Terms & Conditions', 24)], { before: 160, after: 80 }),
    para([run(`The standard terms and conditions are as per the Service Contract attached and the following will also apply:`)], { before: 0, after: 80 }),

    // ── Clause 1 ─────────────────────────────────────────────────────────────
    clauseHead('1', 'MAINTENANCE AND SERVICE'),

    subPara('a', `ONE (1) Preventive Maintenance Service (calibration) per machine shall be performed yearly as scheduled for ${customer_name} (“the Company”) by Demant Malaysia Sdn. Bhd. (“the Vendor”).`),

    subPara('b', `Subject to the terms and conditions set forth, the Company shall be entitled to unlimited telephone, email, and remote access assistance, and ONE (1) onsite remedial service (labour only) per year upon request by the Company. Travelling costs for the onsite remedial service shall be charged separately in accordance with the Travelling Cost Schedule set out below.`),

    subPara('c', `In the event of any breakdown, the Vendor’s first response shall be via telephone, email, or remote access within Twenty Four (24) working hours of receiving the Company’s request. An onsite visit within this timeframe will be arranged if a technical personnel is available. For locations outside Klang Valley, the Vendor shall endeavour to arrange an onsite visit within Forty Eight (48) working hours, subject to technical personnel availability and scheduling. The Vendor shall schedule the onsite visit at the earliest available time where immediate attendance is not possible. Should the issue be resolved remotely, the Vendor will not proceed to an onsite remedial service visit. Unused onsite remedial service visits shall not carry forward to the remaining years of the contract. Any additional onsite repair visits beyond the ONE (1) included per year shall be chargeable at a labour fee of RM 800.00 per visit. Travelling costs for additional visits shall be charged separately per the Travelling Cost Schedule below, but only where the visit is a dedicated trip made solely for the Company’s request. Where the Vendor’s technical personnel are already scheduled to visit the same location for another assignment, travelling costs shall be waived for that visit. The Vendor shall provide continuous service until the problem is resolved.`),

    spacer(6),
    para([bold('Travelling Cost & On-Site Service Charges Per Trip')], { before: 80, after: 60 }),
    buildTravelTable(),
    spacer(6),

    note('Travelling costs are charged per trip and are applicable to all onsite visits including the ONE (1) included remedial service per year.'),
    note('The above travelling costs are subject to change and will be based on the prevailing rate at the time of service.'),
    spacer(4),

    subPara('d', `Replacement parts needed to effect repairs will be recommended by the Vendor’s technical personnel. Any parts required shall be borne by the Company at a 10% discount off the Vendor’s prevailing standard price at the time of purchase. The estimated lead time for parts is 4 to 8 weeks, subject to in-house availability and supply from the principal, Interacoustics. This timeline serves as a guide for the Company’s planning purposes and is not a guaranteed delivery commitment.`),

    subPara('e', `In the event that the Vendor is unable to effect repairs within Seven (7) business days solely due to reasons attributable to the Vendor, the Vendor shall endeavour to provide the Company with a loan unit, subject to availability and at the Vendor’s discretion. For the avoidance of doubt, the Seven (7) business day period shall only commence upon the Company’s written confirmation to proceed with the repair and, where applicable, written confirmation of the purchase order for any required spare parts. Any delay caused by the Company’s failure to provide timely confirmation of repair authorisation or parts purchase approval shall not be counted towards the Seven (7) business day period, and the Vendor shall have no obligation to provide a loan unit during such delay. The loan unit provided, where available, shall be the same model as the Equipment or, if the same model is not available, an equivalent model with the same clinical functionality. Should any damage to the loan unit occur due to misuse by the Company, the cost of repair and shipping shall be borne by the Company.`),

    subPara('f', `All services will be performed on working days of the Vendor, i.e. Monday through Friday between 9.00am to 6.00pm, except on public and gazetted government holidays.`),

    // ── Clause 2 ─────────────────────────────────────────────────────────────
    clauseHead('2', 'SERVICE LIMITATIONS'),

    subPara('a', `The Vendor’s obligation to provide Maintenance Service is contingent upon proper use of all Equipment and does not cover Equipment that has been modified without the Vendor’s prior written approval, or which has been subjected to unusual physical or electrical stress. The Vendor shall not be obligated to furnish Maintenance Service under this Agreement:`),

    ...[
      ['i', 'If adjustment, repair, or parts replacement is required because of accident, misuse, fault, negligence, or causes other than normal use.'],
      ['ii', 'If the Equipment is maintained, repaired, or serviced by persons other than Vendor personnel, without the prior written approval of the Vendor.'],
      ['iii', 'If Maintenance Service is required as a result of the causes stated above, such repairs shall be charged at the then-prevailing hourly labour rates, and any parts required shall be chargeable to the Company.'],
    ].map(([l, t]) => para([run(`${l}) `, { bold: true }), run(t)], { indent: 960, before: 40, after: 40 })),

    subPara('b', `Service provided under this Agreement does not include operating supplies or accessories (spare parts), which shall be the responsibility of the Company.`),

    subParaMulti('c', [
      run(`Either party may terminate this Agreement by providing not less than Six (6) calendar months’ written notice to the other party. In the event that notice of termination is given with less than Six (6) calendar months remaining, the terminating party shall be liable to pay a cancellation fee equivalent to the annual contract value for the year in which termination occurs (`),
      bold(feeFmt),
      run(`), as compensation for scheduling loss and administrative costs incurred by the Vendor.`),
    ]),

    // ── Clause 3 ─────────────────────────────────────────────────────────────
    clauseHead('3', 'RESPONSIBILITY OF COMPANY'),

    subPara('a', `The Company shall notify the Vendor immediately upon Equipment failure and shall allow the Vendor full and free access to the Equipment. The Company shall also permit the Vendor to use necessary on-site facilities, communications infrastructure, and equipment to facilitate repairs at no charge to the Vendor.`),

    subPara('b', `A Company representative shall be present on the premises during the Vendor’s performance of maintenance services.`),

    // ── Clause 4 ─────────────────────────────────────────────────────────────
    clauseHead('4', 'CHARGES AND PAYMENT'),

    subPara('a', `The charges set forth in this Agreement shall commence on the Effective Date as specified in the Schedule(s) of Equipment.`),

    subPara('b', `Charges provided in this Agreement shall be invoiced once the Preventive Maintenance Service (calibration) has been completed for that year. Payment shall be made within thirty (30) days from the date of invoice, or in accordance with the credit terms separately agreed between the parties in writing, whichever applies.`),

    subPara('c', `In the event that payment is not received within the stipulated payment period, the Vendor reserves the right to charge late payment interest at the rate of one and a half percent (1.5%) per month on the outstanding amount, calculated from the due date until the date of full payment. The Vendor also reserves the right to suspend service delivery until all outstanding amounts are settled.`),

    subPara('d', `Annual charges invoiced in this Agreement are inclusive of: (i) labour costs for unlimited breakdown support via telephone, email, and remote access; (ii) labour for ONE (1) onsite remedial service per year for breakdown and repair purposes only, which is separate and distinct from the scheduled calibration visit; and (iii) ONE (1) Preventive Maintenance Service (calibration) per machine, being the scheduled yearly calibration visit. Travelling costs for all onsite visits, including both the remedial service and the calibration visit, are not included in the annual charges and will be invoiced separately per the Travelling Cost Schedule under Clause 1(c).`),

    // ── Clause 5 ─────────────────────────────────────────────────────────────
    clauseHead('5', 'CURRENCY OF PAYMENT'),
    para([run('All charges due under this Agreement shall be paid in Malaysian Ringgit (MYR).')], { before: 60, after: 60 }),

    // ── Clause 6 ─────────────────────────────────────────────────────────────
    clauseHead('6', 'GOVERNING LAW AND DISPUTE RESOLUTION'),

    subPara('a', `This Agreement shall be governed by and construed in accordance with the laws of Malaysia.`),
    subPara('b', `In the event of any dispute arising out of or in connection with this Agreement, both parties shall first attempt to resolve the matter through good faith negotiation within thirty (30) days of written notice of the dispute.`),
    subPara('c', `If the dispute cannot be resolved through negotiation, both parties agree to refer the matter to mediation under the Asian International Arbitration Centre (AIAC) Mediation Rules before commencing any legal proceedings.`),
    subPara('d', `If mediation fails, either party may pursue the matter through the courts of Malaysia, which shall have exclusive jurisdiction.`),

    // ── Clause 7 ─────────────────────────────────────────────────────────────
    clauseHead('7', 'FORCE MAJEURE'),

    subPara('a', `Neither party shall be liable for any delay or failure to perform its obligations under this Agreement where such delay or failure results from causes beyond the reasonable control of that party, including but not limited to acts of God, natural disasters, pandemics, epidemic outbreaks, floods, fires, civil unrest, government actions, supply chain disruptions from the principal manufacturer, or any other event beyond the party’s reasonable control (“Force Majeure Event”).`),
    subPara('b', `The Vendor’s first response target of Twenty Four (24) working hours via telephone, email, or remote access, and onsite visit target of Forty Eight (48) working hours (outside Klang Valley), apply under normal operating conditions and are subject to technical personnel availability. These response targets shall be suspended for the duration of any Force Majeure Event. Requests by the Company for faster response times than those stated herein shall not create any additional obligation on the Vendor.`),
    subPara('c', `The party affected by a Force Majeure Event shall notify the other party in writing as soon as practicable and shall use reasonable endeavours to resume performance as soon as possible.`),

    // ── Clause 8 ─────────────────────────────────────────────────────────────
    clauseHead('8', 'LIMITATION OF LIABILITY'),

    subParaMulti('a', [
      run(`To the maximum extent permitted by applicable law, the Vendor’s total aggregate liability to the Company under or in connection with this Agreement, whether arising in contract, tort (including negligence), breach of statutory duty, or otherwise, shall not exceed the annual contract value payable by the Company for the year in which the liability arises (i.e., `),
      bold(feeFmt),
      run(` per year for the Equipment referenced in this Agreement).`),
    ]),
    subPara('b', `In no event shall either party be liable to the other for any indirect, consequential, incidental, special, or punitive damages, including but not limited to loss of revenue, loss of profit, loss of data, or loss of business opportunity, arising out of or in connection with this Agreement, even if advised of the possibility of such damages.`),
    subPara('c', `Nothing in this clause shall limit liability for fraud, wilful misconduct, or any matter which cannot be limited by law.`),

    // ── Clause 9 ─────────────────────────────────────────────────────────────
    clauseHead('9', 'ASSIGNMENT'),
    para([run(`Neither party may assign, transfer, or otherwise dispose of any of its rights or obligations under this Agreement to any third party without the prior written consent of the other party, which shall not be unreasonably withheld. Any purported assignment in breach of this clause shall be null and void.`)], { before: 60, after: 60 }),

    // ── Clause 10 ────────────────────────────────────────────────────────────
    clauseHead('10', 'CONTRACT CUSTOMER BENEFIT — CONSUMABLES DISCOUNT'),

    subParaMulti('a', [
      run(`As a benefit of holding an active service contract, the Company shall be entitled to a fifteen percent (15%) discount off the Vendor’s prevailing standard price on all eligible consumables purchases made during the active contract period. This benefit is valid for the duration of Contract No. `),
      bold(cnFmt),
      run(` only and shall cease upon expiry or termination of this Agreement.`),
    ]),
    subPara('b', `To enjoy this discount, the Company must quote the contract number stated above when placing a consumables purchase order. The Vendor reserves the right to verify the contract status before applying the discount.`),
    subPara('c', `Eligible consumables include items such as probe tips, ear tips, and other disposable accessories compatible with the Equipment covered under this Agreement. The discount does not apply to spare parts required for repairs, capital equipment, or any item not classified as a consumable by the Vendor.`),
    subPara('d', `The consumables discount cannot be combined with any other promotional discount or offer running concurrently unless expressly approved in writing by the Vendor.`),

    // ── Clause 11 ────────────────────────────────────────────────────────────
    clauseHead('11', 'ENTIRE AGREEMENT AND AMENDMENTS'),
    para([run(`This Agreement, together with any schedules attached hereto, constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior discussions, representations, and agreements. Any amendment to this Agreement must be made in writing and signed by authorised representatives of both parties. The parties confirm that this Agreement is entered into on a commercial basis between two commercial entities, and the Consumer Protection Act 1999 shall not apply to this Agreement.`)], { before: 60, after: 60 }),

    // ── Closing ───────────────────────────────────────────────────────────────
    spacer(8),
    para([run(`We trust this proposal meets your favourable consideration. Kindly be informed that this Service Contract will be effective upon expiry of the Warranty Period. Please feel free to contact us if you require further clarification or assistance. Upon your confirmation of this proposal, we will proceed to formalise the agreement. We look forward to your positive response. Thank you.`)], { before: 80, after: 160 }),

    // ── Signature block ───────────────────────────────────────────────────────
    spacer(16),
    buildSigTable(customer_name),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: BODY, color: '000000' } },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: 16838 },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateContractDoc };
