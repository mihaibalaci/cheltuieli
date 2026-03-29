const XLSX = require('xlsx');
const path = require('path');

/**
 * Detect and parse ABN AMRO export formats
 * Supports: CSV (TAB-separated), Excel (.xlsx), MT940
 */

function parseABNAMROFile(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.mt940' || ext === '.txt' || (ext === '' && isMT940(buffer))) {
    return parseMT940(buffer.toString('utf8'));
  }

  if (ext === '.xlsx' || ext === '.xls') {
    return parseExcel(buffer);
  }

  if (ext === '.csv' || ext === '.tab') {
    return parseCSV(buffer.toString('utf8'));
  }

  // Try auto-detect
  const str = buffer.toString('utf8', 0, 200);
  if (str.startsWith(':20:') || str.startsWith('ABNA')) return parseMT940(buffer.toString('utf8'));
  if (str.includes('\t')) return parseCSV(buffer.toString('utf8'));

  return parseExcel(buffer);
}

function isMT940(buffer) {
  const start = buffer.toString('utf8', 0, 50);
  return start.includes(':20:') || start.includes(':940:');
}

/**
 * Parse ABN AMRO CSV (TAB-delimited)
 * Columns: Accountnumber, Currency, Date(YYYYMMDD), Balance before, Balance after,
 *           Interest date, Amount, Description
 */
function parseCSV(content) {
  const lines = content.trim().split('\n').filter(l => l.trim());
  const transactions = [];

  for (const line of lines) {
    const cols = line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 7) continue;

    const [account, currency, dateRaw, , , , amountRaw, ...descParts] = cols;
    const description = descParts.join(' ').trim();

    // Skip header rows
    if (dateRaw === 'Transactiedatum' || dateRaw === 'Date' || !/^\d{8}$/.test(dateRaw)) continue;

    const date = formatDate(dateRaw);
    const amount = parseAmount(amountRaw);

    if (isNaN(amount) || !date) continue;

    transactions.push({
      date,
      amount: Math.abs(amount),
      transaction_type: amount < 0 ? 'debit' : 'credit',
      description: cleanDescription(description),
      counterparty: extractCounterparty(description),
      account_number: account,
      currency: currency || 'EUR',
    });
  }

  return transactions;
}

/**
 * Parse ABN AMRO Excel export
 */
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const transactions = [];

  // Find header row
  let headerRow = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i].map(c => String(c).toLowerCase());
    if (row.some(c => c.includes('date') || c.includes('datum') || c.includes('amount') || c.includes('bedrag'))) {
      headerRow = i;
      break;
    }
  }

  const headers = rows[headerRow].map(h => String(h).toLowerCase().trim());
  const colMap = {
    date: findCol(headers, ['date', 'transactiedatum', 'boekingsdatum']),
    amount: findCol(headers, ['amount', 'bedrag', 'af/bij']),
    description: findCol(headers, ['description', 'omschrijving', 'naam/omschrijving']),
    counterparty: findCol(headers, ['counterparty', 'naam', 'tegenrekening naam']),
    account: findCol(headers, ['account', 'rekeningnummer', 'iban']),
    currency: findCol(headers, ['currency', 'valuta']),
    type: findCol(headers, ['af/bij', 'debet/credit', 'type']),
  };

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c)) continue;

    const rawDate = colMap.date >= 0 ? row[colMap.date] : null;
    const rawAmount = colMap.amount >= 0 ? row[colMap.amount] : null;
    const description = colMap.description >= 0 ? String(row[colMap.description] || '') : '';
    const counterparty = colMap.counterparty >= 0 ? String(row[colMap.counterparty] || '') : '';
    const account = colMap.account >= 0 ? String(row[colMap.account] || '') : '';
    const currency = colMap.currency >= 0 ? String(row[colMap.currency] || 'EUR') : 'EUR';
    const typeStr = colMap.type >= 0 ? String(row[colMap.type] || '').toLowerCase() : '';

    const date = formatDateValue(rawDate);
    const amount = parseAmount(String(rawAmount || 0));

    if (!date || isNaN(amount)) continue;

    const isDebit = typeStr.includes('af') || typeStr.includes('debet') || amount < 0;

    transactions.push({
      date,
      amount: Math.abs(amount),
      transaction_type: isDebit ? 'debit' : 'credit',
      description: cleanDescription(description),
      counterparty: counterparty || extractCounterparty(description),
      account_number: account,
      currency,
    });
  }

  return transactions;
}

/**
 * Parse MT940 format (ABN AMRO standard bank export)
 */
function parseMT940(content) {
  const transactions = [];
  const stmtBlocks = content.split(/(?=:20:)/g).filter(b => b.trim());

  for (const block of stmtBlocks) {
    const lines = block.split('\n');
    let currentTx = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Transaction line :61:
      const txMatch = line.match(/^:61:(\d{6})(\d{4})?(C|D|RC|RD)(\d+,\d+)N(.{3})(.+)?$/);
      if (txMatch) {
        if (currentTx) transactions.push(currentTx);
        const [, dateStr, , cd, amtStr, , ref] = txMatch;
        const year = '20' + dateStr.substring(0, 2);
        const month = dateStr.substring(2, 4);
        const day = dateStr.substring(4, 6);
        const amount = parseFloat(amtStr.replace(',', '.'));

        currentTx = {
          date: `${year}-${month}-${day}`,
          amount,
          transaction_type: (cd === 'D' || cd === 'RD') ? 'debit' : 'credit',
          description: ref || '',
          counterparty: '',
          account_number: '',
          currency: 'EUR',
        };
      }

      // Description line :86:
      if (line.startsWith(':86:') && currentTx) {
        let desc = line.replace(':86:', '');
        // Continue multiline descriptions
        while (i + 1 < lines.length && !lines[i + 1].startsWith(':')) {
          i++;
          desc += ' ' + lines[i].trim();
        }
        currentTx.description = cleanDescription(desc);
        currentTx.counterparty = extractCounterparty(desc);
      }
    }

    if (currentTx) transactions.push(currentTx);
  }

  return transactions;
}

// ---- Helpers ----

function findCol(headers, candidates) {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.includes(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).replace(/-/g, '');
  if (s.length === 8) {
    return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
  }
  return null;
}

function formatDateValue(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const s = String(val).replace(/\//g, '-').replace(/\./g, '-');
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try YYYYMMDD
  if (/^\d{8}$/.test(s)) return formatDate(s);
  // Try DD-MM-YYYY
  const parts = s.split('-');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  return null;
}

function parseAmount(str) {
  if (!str) return NaN;
  const s = String(str).trim().replace(/\s/g, '');
  // Handle European format: 1.234,56
  if (s.includes(',') && s.includes('.')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  // Handle comma as decimal: 1234,56
  if (s.includes(',')) {
    return parseFloat(s.replace(',', '.'));
  }
  return parseFloat(s.replace(/[^\d.-]/g, ''));
}

function cleanDescription(desc) {
  return desc
    .replace(/\s+/g, ' ')
    .replace(/\/TRCD\/\d+/g, '')
    .replace(/\/EREF\/[^\s]*/g, '')
    .replace(/\/MARF\/[^\s]*/g, '')
    .trim()
    .substring(0, 255);
}

function extractCounterparty(desc) {
  // ABN AMRO MT940 patterns
  const patterns = [
    /\/NAME\/([^/]+)/i,
    /Naam:\s*([^\n,]+)/i,
    /^([A-Z][A-Z\s]{2,30})\s+(?:NL|BE|DE)/,
  ];
  for (const p of patterns) {
    const m = desc.match(p);
    if (m) return m[1].trim().substring(0, 100);
  }
  // Take first capitalized word sequence
  const words = desc.split(/\s+/);
  const name = words.slice(0, 3).join(' ');
  return name.length > 3 ? name.substring(0, 60) : '';
}

module.exports = { parseABNAMROFile };
