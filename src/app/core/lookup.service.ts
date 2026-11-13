import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

/**
 * Dropdown sources from GET v1/admin/data, cached per session. Items are
 * { id, itemName }: bind optionValue="id" optionLabel="itemName".
 *
 *  enum('OrderStatus')   -> any enum in entities.constants
 *  list('stocks')        -> reference entities (see AdminLookupEndpoint)
 */
@Injectable({ providedIn: 'root' })
export class LookupService {
  private api = inject(ApiService);
  private cache = new Map<string, Promise<any[]>>();

  enum(name: string): Promise<any[]> {
    return this.cached(`enum:${name}`, () => this.api.get(`data/enum/${name}`));
  }

  list(name: string, parentId?: string): Promise<any[]> {
    const key = parentId ? `list:${name}:${parentId}` : `list:${name}`;
    return this.cached(key, () => this.api.get(`data/${name}`, parentId ? { parentId } : undefined));
  }

  /** Forget a cached list after its records change (e.g. after saving a stock). */
  invalidate(name?: string): void {
    if (!name) {
      this.cache.clear();
      return;
    }
    for (const key of [...this.cache.keys()]) {
      if (key === `enum:${name}` || key === `list:${name}` || key.startsWith(`list:${name}:`)) {
        this.cache.delete(key);
      }
    }
  }

  private cached(key: string, load: () => Promise<any>): Promise<any[]> {
    if (!this.cache.has(key)) {
      const promise = load().then((response: any) => {
        if (!response?.success) {
          this.cache.delete(key);
          return [];
        }
        return response.data || [];
      });
      this.cache.set(key, promise);
    }
    return this.cache.get(key)!;
  }
}
