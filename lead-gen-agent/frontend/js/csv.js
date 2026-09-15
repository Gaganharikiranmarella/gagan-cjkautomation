// Minimal CSV parser: handles quoted fields (with escaped "" inside quotes)
// and commas inside quotes, which a plain split(',') would break on.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') { inQuotes = false; }
      else { field += char; }
      continue;
    }

    if (char === '"') { inQuotes = true; }
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// Converts raw CSV text into an array of lead-shaped objects using the
// header row to map columns, tolerant of extra/missing/reordered columns.
function csvToLeadRows(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((cells) => {
    const record = {};
    header.forEach((key, idx) => {
      record[key] = (cells[idx] || '').trim();
    });
    return {
      name: record.name || record['full name'] || '',
      email: record.email || '',
      phone: record.phone || record['phone number'] || '',
      company: record.company || '',
      tags: record.tags || '',
      consentGiven: /^(true|yes|1)$/i.test(record.consentgiven || record.consent || ''),
    };
  }).filter((r) => r.name);
}
