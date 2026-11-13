/** Small display helpers shared by the client care screens. */

export type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' | undefined;

export function prioritySeverity(priority: string): Severity {
  switch (priority) {
    case 'CRITICAL':
      return 'danger';
    case 'HIGH':
      return 'warn';
    case 'MEDIUM':
      return 'info';
    default:
      return 'secondary';
  }
}

export function statusSeverity(status: string): Severity {
  switch (status) {
    case 'NEW':
    case 'ACKNOWLEDGED':
      return 'info';
    case 'IN_PROGRESS':
      return 'warn';
    case 'AWAITING_CLIENT':
      return 'contrast';
    case 'RESOLVED':
      return 'success';
    default:
      return 'secondary';
  }
}

/** slaStyle from the API is 'ok' | 'warn' | 'bad' | ''. */
export function slaColor(style: string): string {
  switch (style) {
    case 'bad':
      return 'var(--app-bad)';
    case 'warn':
      return 'var(--app-warn)';
    default:
      return 'var(--app-ok)';
  }
}

/** yyyy-MM-ddTHH:mm in local time, for <input type="datetime-local">. */
export function nowLocal(): string {
  const d = new Date();
  const p = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Saves a base64 file returned by the API. */
export function downloadBase64(file: { fileName: string; contentType?: string; data: string }): void {
  const bytes = atob(file.data);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    buffer[i] = bytes.charCodeAt(i);
  }
  const url = URL.createObjectURL(new Blob([buffer], { type: file.contentType || 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName || 'attachment';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
