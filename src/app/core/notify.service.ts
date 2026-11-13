import { Injectable, inject } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';

/** One place for toasts and confirmations (PrimeNG Toast and ConfirmDialog). */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private messages = inject(MessageService);
  private confirmation = inject(ConfirmationService);

  success(detail: string, summary = 'Done'): void {
    this.messages.add({ severity: 'success', summary, detail, life: 3500 });
  }

  info(detail: string, summary = 'Note'): void {
    this.messages.add({ severity: 'info', summary, detail, life: 4000 });
  }

  warn(detail: string, summary = 'Check'): void {
    this.messages.add({ severity: 'warn', summary, detail, life: 5000 });
  }

  error(detail: string, summary = 'Error'): void {
    this.messages.add({ severity: 'error', summary, detail, life: 6000 });
  }

  /** Resolves true when the user accepts. */
  confirm(message: string, header = 'Please confirm', acceptLabel = 'Yes'): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmation.confirm({
        message,
        header,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel,
        rejectLabel: 'Cancel',
        rejectButtonProps: { severity: 'secondary', outlined: true },
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
  }

  /** The standard delete confirmation. */
  confirmDelete(what = 'this record'): Promise<boolean> {
    return this.confirm(`Delete ${what}? This cannot be undone.`, 'Delete', 'Delete');
  }
}
