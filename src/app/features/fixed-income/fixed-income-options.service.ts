import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/api.service';

/**
 * Dropdown sources for the fixed-income screens that the generic lookups do
 * not cover (GET v1/admin/fixed-income-options), cached for the session:
 *   currencies  { id, itemName }
 *   subClasses  { id, itemName, code }        fixed-income asset subclasses
 *   tenors      { id, itemName, code, days }
 */
@Injectable({ providedIn: 'root' })
export class FixedIncomeOptionsService {
  private api = inject(ApiService);
  private cache: Promise<any> | null = null;

  load(): Promise<any> {
    if (!this.cache) {
      this.cache = this.api.get('fixed-income-options').then((response) => {
        if (!response.success) {
          this.cache = null;
          return { currencies: [], subClasses: [], tenors: [] };
        }
        return response.data;
      });
    }
    return this.cache;
  }
}

/** ISO yyyy-MM-dd plus a number of days (local time). */
export function addDays(iso: string | null | undefined, days: number): string | null {
  if (!iso) {
    return null;
  }
  const [y, m, d] = iso.substring(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Severity for an order status tag. */
export function orderStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'secondary' | 'danger' {
  switch (status) {
    case 'COMPLETELY_FILLED':
      return 'success';
    case 'PARTIALLY_FILLED':
      return 'info';
    case 'PENDING':
    case 'SUBMITTED':
      return 'warn';
    case 'CANCELLED':
    case 'EXPIRED':
    case 'PARTIALLY_FILLED_CANCELLED':
      return 'danger';
    default:
      return 'secondary';
  }
}
