import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ApiService, isoDate, today } from '../../core/api.service';
import { LookupService } from '../../core/lookup.service';
import { NotifyService } from '../../core/notify.service';
import { ReportData } from '../../core/report-data';
import { EntityPickerComponent } from '../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../shared/report-viewer/report-viewer.component';
import { StatTile, StatTilesComponent } from '../../shared/stat-tiles/stat-tiles.component';

/** First day of the month three months back (the JSF default window). */
function defaultFrom(): string {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth() - 3, 1))!;
}

export function statusSeverity(row: any): 'success' | 'danger' | 'warn' {
  if (row?.settled) {
    return 'success';
  }
  return row?.paymentStatus === 'FAILED' || row?.paymentStatus === 'CANCELLED' ? 'danger' : 'warn';
}

/**
 * Client cash ledger (JSF cash/cash-transaction.xhtml): pick an account, view
 * its per-portfolio ledger with server-computed balances, capture or edit a
 * deposit/withdrawal, mark pending rows paid, delete, transfer between
 * accounts (one server transaction) and print the cash transaction report.
 */
@Component({
  selector: 'app-cash-transactions',
  imports: [
    FormsModule, DatePipe, DecimalPipe, ButtonModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule,
    TextareaModule, EntityPickerComponent, PageHeaderComponent, ReportViewerComponent, StatTilesComponent,
  ],
  templateUrl: './cash-transactions.component.html',
  styleUrl: './cash-transactions.component.scss',
})
export class CashTransactionsComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);
  private route = inject(ActivatedRoute);

  account: any = null;
  ledger: any = null;
  loading = false;
  saving = false;
  printing = false;
  reportData = new ReportData();
  expanded: { [key: string]: boolean } = {};

  portfolio = 'TRADING_ACCOUNT';
  direction: string | null = null;
  status: string | null = null;
  fromDate: string | null = defaultFrom();
  toDate: string | null = today();
  text = '';

  portfolios: any[] = [];
  directions: any[] = [];
  statuses: any[] = [];
  channels: any[] = [];
  currencies: any[] = [];
  bankAccounts: any[] = [];

  record: any = null;
  transferMode = false;
  transfer: any = {};

  async ngOnInit() {
    this.openLinkedAccount();
    const [portfolios, statuses, channels, banks, options] = await Promise.all([
      this.lookups.enum('Portfolio'),
      this.lookups.enum('PaymentStatus'),
      this.lookups.enum('PaymentChannel'),
      this.lookups.list('bank-accounts'),
      this.api.get('cash-transactions/options'),
    ]);
    this.portfolios = portfolios;
    this.statuses = statuses;
    this.channels = channels;
    this.bankAccounts = banks;
    if (options.success) {
      this.directions = options.data.debitCredit || [];
      this.currencies = options.data.currencies || [];
    }
  }

  get rows(): any[] {
    return this.ledger?.rows || [];
  }

  get visibleRows(): any[] {
    const t = this.text.trim().toLowerCase();
    if (!t) {
      return this.rows;
    }
    return this.rows.filter((r) => `${r.description || ''} ${r.tranRefNo || ''}`.toLowerCase().includes(t));
  }

  get tiles(): StatTile[] {
    const l = this.ledger || {};
    return [
      { label: 'Ledger balance (settled)', value: l.ledgerBalance, tone: (l.ledgerBalance || 0) < 0 ? 'bad' : 'ok' },
      { label: 'Total credit', value: l.totalCredit, foot: `${l.creditCount || 0} credit(s)` },
      { label: 'Total debit', value: l.totalDebit, foot: `${l.debitCount || 0} debit(s)` },
      { label: 'Pending', value: l.pendingAmount, foot: `${l.pendingCount || 0} pending`, tone: l.pendingCount ? 'warn' : '' },
      { label: 'Net movement', value: l.netMovement },
    ];
  }

  get balanceAfterPosting(): number {
    const amount = Math.abs(this.record?.amount || 0);
    const base = this.ledger?.ledgerBalance || 0;
    return this.record?.debitCredit === 'DEBIT' ? base - amount : base + amount;
  }

  severity(row: any) {
    return statusSeverity(row);
  }

  portfolioName(id: string): string {
    return this.portfolios.find((p) => p.id === id)?.itemName || id;
  }

  /** Deep link from the Accounts Dashboard: ?accountId=&accountCode= selects that account. */
  private async openLinkedAccount() {
    const query = this.route.snapshot.queryParamMap;
    const accountId = query.get('accountId');
    if (!accountId) {
      return;
    }
    const response = await this.api.get('pickers/accounts', { keyword: query.get('accountCode') || '', pageNo: 1, pageSize: 20 });
    const match = (response.success ? response.data || [] : []).find((a: any) => a.id === accountId);
    if (match) {
      this.selectAccount(match);
    }
  }

  selectAccount(account: any) {
    this.account = account;
    this.ledger = null;
    this.transferMode = false;
    if (!account) {
      return;
    }
    this.portfolio = 'TRADING_ACCOUNT';
    this.direction = null;
    this.status = null;
    this.fromDate = defaultFrom();
    this.toDate = today();
    this.newRecord();
    this.load();
  }

  portfolioChanged() {
    // keep the form's portfolio in step with the ledger being viewed (JSF bug)
    if (this.record && !this.record.id) {
      this.record.portfolio = this.portfolio;
    }
    this.load();
  }

  private filters() {
    return {
      accountId: this.account?.id,
      portfolio: this.portfolio,
      debitCredit: this.direction,
      paymentStatus: this.status,
      fromDate: this.fromDate,
      toDate: this.toDate,
    };
  }

  async load() {
    if (!this.account) {
      return;
    }
    this.loading = true;
    const response = await this.api.get('cash-transactions/ledger', this.filters());
    this.loading = false;
    if (response.success) {
      this.ledger = response.data;
      this.expanded = {};
    }
  }

  newRecord() {
    this.record = { valueDate: today(), debitCredit: 'CREDIT', paymentStatus: 'PENDING', portfolio: this.portfolio, amount: 0 };
  }

  edit(row: any) {
    this.transferMode = false;
    this.record = { ...row };
  }

  async save() {
    const r = this.record;
    if (!r.portfolio || !r.valueDate || !r.bankAccountId || !(Math.abs(r.amount || 0) > 0) || !r.description?.trim()) {
      this.notify.warn('Portfolio, value date, bank account, amount and description are required');
      return;
    }
    this.saving = true;
    const response = await this.api.save('cash-transactions', { ...r, accountId: this.account.id });
    this.saving = false;
    if (response.success) {
      this.newRecord();
      this.load();
    }
  }

  async markPaid(row: any) {
    if (!(await this.notify.confirm(`Mark ${row.amount?.toFixed?.(2) ?? row.amount} (${row.description}) as paid?`))) {
      return;
    }
    const response = await this.api.put(`cash-transactions/${row.id}/mark-paid`);
    if (response.success) {
      this.load();
    }
  }

  async remove(row: any) {
    const what = row.transferLeg ? 'this transfer (both the debit and the credit leg)' : 'this cash transaction';
    if (!(await this.notify.confirmDelete(what))) {
      return;
    }
    const response = await this.api.delete(`cash-transactions/${row.id}`);
    if (response.success) {
      if (this.record?.id === row.id) {
        this.newRecord();
      }
      this.load();
    }
  }

  startTransfer() {
    this.transferMode = true;
    this.transfer = { valueDate: today(), destination: null, destinationPortfolio: this.portfolio, amount: 0, description: '' };
  }

  normalMode() {
    this.transferMode = false;
    this.transfer = {};
  }

  async doTransfer() {
    const t = this.transfer;
    if (!t.valueDate || !t.destination || !t.destinationPortfolio || !(t.amount > 0)) {
      this.notify.warn('Value date, destination account, destination portfolio and a positive amount are required');
      return;
    }
    const ok = await this.notify.confirm(
      `Transfer ${Number(t.amount).toFixed(2)} from ${this.account.displayName} to ${t.destination.displayName}?`,
      'Confirm transfer',
      'Transfer',
    );
    if (!ok) {
      return;
    }
    this.saving = true;
    const response = await this.api.post('cash-transactions/transfers', {
      sourceAccountId: this.account.id,
      sourcePortfolio: this.portfolio,
      destinationAccountId: t.destination.id,
      destinationPortfolio: t.destinationPortfolio,
      amount: t.amount,
      valueDate: t.valueDate,
      description: t.description,
    });
    this.saving = false;
    if (response.success) {
      this.normalMode();
      this.load();
    }
  }

  async print() {
    this.printing = true;
    const response = await this.api.get('cash-transactions/report', this.filters());
    this.printing = false;
    if (response.success) {
      this.reportData.showPdfReport('Cash Transaction Report', response.data);
    }
  }
}
