import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { SessionService } from '../../../core/session.service';

/** Where each work-queue stage is processed, and the page key needed to open it. */
const STAGE_ACTIONS: Record<string, { label: string; route: string; permission: string; tone: string }> = {
  INCOMPLETE: { label: 'Open record', route: '/accounts/investors', permission: 'accounts.investors', tone: 'bad' },
  PENDING: { label: 'Process', route: '/accounts/verifications', permission: 'accounts.verifications', tone: 'warn' },
  AWAITING_ACCOUNT: { label: 'Create account', route: '/accounts/account-creation', permission: 'accounts.account-creation', tone: 'ok' },
};

/**
 * Accounts Dashboard (Accounts menu): the
 * onboarding pipeline, a named work queue, the account book, accounts opened
 * per month, record-health and KYC checks with drill-down lists, pending
 * withdrawals and recent account activity. One call loads the page
 * (v1/admin/account-dashboard); each check's records load on demand.
 */
@Component({
  selector: 'app-account-dashboard',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, ButtonModule, DialogModule, InputTextModule, TableModule, TooltipModule],
  templateUrl: './account-dashboard.component.html',
  styleUrl: './account-dashboard.component.scss',
})
export class AccountDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotifyService);
  private session = inject(SessionService);
  private router = inject(Router);

  loading = false;
  data: any = null;
  search = '';
  payingId: string | null = null;

  /** The open drill-down: { label, kind, total, limit, rows } or null. */
  drill: any = null;
  drillVisible = false;
  drillLoading = false;

  readonly canInvestors = this.session.can('accounts.investors');
  readonly canAccounts = this.session.can('accounts.accounts');
  readonly canCash = this.session.can('cash.transactions');

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading = true;
    const response = await this.api.get('account-dashboard');
    this.loading = false;
    if (response.success) {
      this.data = response.data;
    }
  }

  get pipeline(): any {
    return this.data?.pipeline || {};
  }

  get figures(): any {
    return this.data?.figures || {};
  }

  /** Bar height in px for the monthly chart (tallest month = 140px). */
  barHeight(count: number): number {
    const max = Math.max(1, ...(this.data?.openedByMonth || []).map((m: any) => m.count || 0));
    return Math.round(((count || 0) / max) * 140);
  }

  get openedTotal(): number {
    return (this.data?.openedByMonth || []).reduce((t: number, m: any) => t + (m.count || 0), 0);
  }

  get chartLabel(): string {
    const months = this.data?.openedByMonth || [];
    return 'Accounts opened per month: ' + months.map((m: any) => `${m.label} ${m.year} ${m.count}`).join(', ');
  }

  waiting(days: number | null | undefined): string {
    if (days === null || days === undefined) return '-';
    if (days === 0) return 'Today';
    return days === 1 ? '1 day' : `${days} days`;
  }

  stageTone(row: any): string {
    return STAGE_ACTIONS[row.stage]?.tone || 'grey';
  }

  /** The page that processes a queue row, or null when the user may not open it. */
  stageAction(row: any): { label: string; route: any[]; query: any } | null {
    const a = STAGE_ACTIONS[row.stage];
    if (!a || !this.session.can(a.permission)) {
      return null;
    }
    if (row.stage === 'INCOMPLETE') {
      return { label: a.label, route: ['/accounts/investors', row.investorId], query: {} };
    }
    return { label: a.label, route: [a.route], query: { investorId: row.investorId } };
  }

  activityIcon(type: string): string {
    switch (type) {
      case 'FUND_ACCOUNT': return 'pi-id-card';
      case 'INVESTOR': return 'pi-user';
      case 'PAYMENT_WALLET': return 'pi-wallet';
      case 'CASH_TRANSACTION': return 'pi-money-bill';
      default: return 'pi-circle-fill';
    }
  }

  /** Header search: accounts register when the user can open it, else the investor register. */
  find() {
    const keyword = this.search.trim();
    if (!keyword) return;
    const route = this.canAccounts ? '/accounts/accounts' : '/accounts/investors';
    this.router.navigate([route], { queryParams: { keyword } });
  }

  async openCheck(check: any) {
    this.drill = { label: check.label, total: check.count, rows: [] };
    this.drillVisible = true;
    this.drillLoading = true;
    const response = await this.api.get(`account-dashboard/records/${check.key}`);
    this.drillLoading = false;
    if (response.success) {
      this.drill = response.data;
    }
  }

  /** Where a drill-down row opens: the account or investor register, searched for that record. */
  recordRoute(): string | null {
    if (!this.drill?.kind) return null;
    if (this.drill.kind === 'account') return this.canAccounts ? '/accounts/accounts' : null;
    return this.canInvestors ? '/accounts/investors' : null;
  }

  openRecord(row: any) {
    const route = this.recordRoute();
    if (!route) return;
    this.drillVisible = false;
    if (this.drill.kind === 'investor') {
      this.router.navigate(['/accounts/investors', row.id]);
      return;
    }
    this.router.navigate([route], { queryParams: { keyword: row.code || row.name } });
  }

  async markPaid(row: any) {
    const ok = await this.notify.confirm(
      `Mark the withdrawal of GHS ${(row.amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })} from ${row.accountName} as paid? It will then count against the account's balance.`,
      'Mark as paid',
      'Mark as paid',
    );
    if (!ok) return;
    this.payingId = row.id;
    const response = await this.api.put(`cash-transactions/${row.id}/mark-paid`);
    this.payingId = null;
    if (response.success) {
      this.load();
    }
  }
}
