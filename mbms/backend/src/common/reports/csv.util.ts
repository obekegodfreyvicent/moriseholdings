// RPT-06: "Reports shall be exportable to at least PDF and Excel/CSV." A
// plain comma-joined string, RFC-4180-style quoting only where a value
// actually contains a comma/quote/newline — Excel opens this format
// natively, satisfying the "Excel/CSV" half without a spreadsheet library.
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined): string => {
    const s = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map(escape).join(','));
  }
  return lines.join('\r\n');
}
