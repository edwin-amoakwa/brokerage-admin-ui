import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/api.service';
import { SessionService } from '../../core/session.service';

/** Brand-led categorical palette: green, gold, teal, slate blue, clay, sage, plum, grey. */
const PALETTE = ['#0b3c2b', '#c5a059', '#2a8c7a', '#4a6fa5', '#c0734a', '#8aa79a', '#8e5572', '#9aa3a0'];

/**
 * Operations dashboard (JSF secured/index.xhtml). Each section is loaded from
 * its own endpoint and shown only when the user may open the screen its
 * figures belong to. Refresh re-reads everything into fresh objects.
 */
@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, DecimalPipe, RouterLink, ButtonModule, TagModule, TooltipModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  private session = inject(SessionService);

  loading = false;
  readonly today = new Date();
  summary: any = null;
  onboarding: any = null;
  queue: any = null;
  orders: any = null;
  clients: any = null;
  book: any = null;
  fixedIncome: any = null;
  payments: any = null;
  care: any = null;

  ngOnInit() {
    this.load();
  }

  get firstName(): string {
    return (this.session.user()?.accountName || '').split(' ')[0] || 'there';
  }

  get greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  get eodTone(): string {
    if (!this.summary?.eodPresent) {
      return 'bad';
    }
    return this.summary.eodAuthorised ? 'ok' : 'warn';
  }

  abs(v: number) {
    return Math.abs(v || 0);
  }

  max(a: number, b: number) {
    return Math.max(a || 0, b);
  }

  /** 248760430 -> "248.8M", 612480 -> "612.5K". The full figure is in a tooltip. */
  compact(v: number): string {
    const n = Math.abs(v || 0);
    const sign = v < 0 ? '-' : '';
    if (n >= 1e9) return sign + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return sign + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return sign + (n / 1e3).toFixed(1) + 'K';
    return sign + n.toFixed(0);
  }

  /** Dot colour for a queue row: red for breaches, gold for money waiting, green otherwise. */
  queueTone(q: any): string {
    if (!q.count) return 'none';
    if (q.key === 'casesBreached' || q.key === 'casesUnassigned') return 'bad';
    if (q.value) return 'warn';
    return 'ok';
  }

  activityIcon(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('order') || t.includes('trade')) return 'pi-chart-line';
    if (t.includes('deposit')) return 'pi-arrow-down-left';
    if (t.includes('withdraw')) return 'pi-arrow-up-right';
    if (t.includes('login') || t.includes('sign')) return 'pi-sign-in';
    if (t.includes('profile') || t.includes('update')) return 'pi-user-edit';
    return 'pi-circle-fill';
  }

  activityTone(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('deposit')) return 'green';
    if (t.includes('withdraw')) return 'gold';
    if (t.includes('order') || t.includes('trade')) return 'brand';
    return 'grey';
  }

  queryOf(q: any) {
    return q.queryParam ? { [q.queryParam]: q.queryValue } : {};
  }

  color(i: number) {
    return PALETTE[i % PALETTE.length];
  }

  /** Re-reads every visible section; each response replaces its section, so nothing accumulates. */
  async load() {
    this.loading = true;
    const can = (k: string | string[]) => this.session.can(k);
    const fetch = (path: string, allowed: boolean) => (allowed ? this.api.get(`dashboard/${path}`).then((r) => (r.success ? r.data : null)) : Promise.resolve(null));
    [this.summary, this.onboarding, this.queue, this.orders, this.clients, this.book, this.fixedIncome, this.payments, this.care] = await Promise.all([
      fetch('summary', true),
      fetch('onboarding', can(['accounts.incomplete-registrations', 'accounts.verifications', 'accounts.account-creation'])),
      fetch('queue', true),
      fetch('orders', can('equities.orders')),
      fetch('clients', can(['accounts.investors', 'accounts.verifications'])),
      fetch('client-book', can('accounts.accounts')),
      fetch('fixed-income', can(['admin.fixed-income-securities', 'fixed-income.orders'])),
      fetch('payments', can('cash.transactions')),
      fetch('client-care', can('support.cases')),
    ]);
    this.loading = false;
  }
}
