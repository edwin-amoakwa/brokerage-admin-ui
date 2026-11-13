/** Small helpers shared by the equities screens. */

/** Saves a {fileName, mimeType, base64} export from the API as a download. */
export function downloadBase64(file: any): void {
  if (!file?.base64) {
    return;
  }
  const bytes = atob(file.base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    buffer[i] = bytes.charCodeAt(i);
  }
  const url = URL.createObjectURL(new Blob([buffer], { type: file.mimeType || 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName || 'export';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** yyyy-MM-01 of the current month (the JSF blotters' default "from" date). */
export function firstOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-01`;
}

/** p-tag severity for an OrderStatus constant. */
export function orderSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
  switch (status) {
    case 'COMPLETELY_FILLED':
      return 'success';
    case 'SUBMITTED':
      return 'info';
    case 'PARTIALLY_FILLED':
      return 'warn';
    case 'PENDING':
      return 'secondary';
    default:
      return 'danger';
  }
}

/** p-tag severity for a buy/sell side. */
export function sideSeverity(side: string): 'success' | 'danger' | 'secondary' {
  return side === 'BUY' ? 'success' : side === 'SELL' ? 'danger' : 'secondary';
}
