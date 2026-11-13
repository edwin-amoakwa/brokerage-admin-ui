import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/api.service';

/** p-tag severity for Investor.getStatusStyle() (is-ok / is-warn / is-bad). */
export function statusSeverity(style: string | null | undefined): 'success' | 'warn' | 'danger' | 'secondary' {
  switch (style) {
    case 'is-ok':
      return 'success';
    case 'is-warn':
      return 'warn';
    case 'is-bad':
      return 'danger';
    default:
      return 'secondary';
  }
}

/** p-tag severity for an account type (replaces Account.getTypeStyle()). */
export function accountTypeSeverity(type: string | null | undefined): 'info' | 'contrast' | 'success' | 'warn' | 'secondary' {
  switch (type) {
    case 'INDIVIDUAL':
      return 'info';
    case 'CORPORATE':
      return 'contrast';
    case 'JOINT':
      return 'success';
    case 'ITF':
      return 'warn';
    default:
      return 'secondary';
  }
}

/**
 * Dropdowns for the enums that live in stately-common (Gender, MaritalStatus,
 * IdType, Title, Relationship), served by GET investors/options.
 */
@Injectable({ providedIn: 'root' })
export class InvestorOptionsService {
  private api = inject(ApiService);
  private cache: Promise<Record<string, any[]>> | null = null;

  all(): Promise<Record<string, any[]>> {
    if (!this.cache) {
      this.cache = this.api.get('investors/options').then((r) => {
        if (!r.success) {
          this.cache = null;
          return {};
        }
        return r.data || {};
      });
    }
    return this.cache;
  }
}
