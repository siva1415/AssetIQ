/**
 * Utility for generating and downloading RFC 4180-compliant CSV files with UTF-8 BOM
 * for broad compatibility with Microsoft Excel, Apple Numbers, and spreadsheet software.
 */

export function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  // If string contains comma, double quote, newline, or carriage return, wrap in quotes and escape internal quotes
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const rowLines = rows.map(row => row.map(escapeCsvValue).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
