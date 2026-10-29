export function encodeCsv(rows: readonly (readonly string[])[], separator = ','): string {
  return rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(separator)).join('\r\n');
}

export function encodeCsvRaw(rows: readonly (readonly string[])[], separator = ','): string {
  return rows.map((row) => row.join(separator)).join('\r\n');
}

export function downloadCsv(contents: string, fileName: string | undefined): void {
  const name = fileName && fileName.endsWith('.csv') ? fileName : `${fileName || 'export'}.csv`;
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
