import { Injectable, computed, signal } from '@angular/core';

const KEY = 'brokerage-admin.session';

/** The signed-in back-office user and tokens, kept in localStorage. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly user = signal<any>(null);
  readonly loggedIn = computed(() => !!this.user());

  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved?.accessToken) {
        this.accessToken = saved.accessToken;
        this.refreshToken = saved.refreshToken;
        this.user.set(saved.user);
      }
    } catch {
      localStorage.removeItem(KEY);
    }
  }

  start(data: any): void {
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.user.set(data.user ?? this.user());
    this.persist();
  }

  updateUser(user: any): void {
    this.user.set(user);
    this.persist();
  }

  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.user.set(null);
    localStorage.removeItem(KEY);
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /** True when the user may open a page (a permission key from layout/menu.ts). */
  can(permission?: string | string[]): boolean {
    const user = this.user();
    if (!user) {
      return false;
    }
    if (!permission || user.superUser) {
      return true;
    }
    const keys = Array.isArray(permission) ? permission : [permission];
    const granted: string[] = user.permissions || [];
    return keys.some((k) => granted.includes(k));
  }

  private persist(): void {
    localStorage.setItem(KEY, JSON.stringify({ accessToken: this.accessToken, refreshToken: this.refreshToken, user: this.user() }));
  }
}
