import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ApiService } from '../../core/api.service';
import { ReportData } from '../../core/report-data';
import { EntityPickerComponent } from '../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../shared/report-viewer/report-viewer.component';
import { StatTile, StatTilesComponent } from '../../shared/stat-tiles/stat-tiles.component';

/**
 * Account statement (JSF transactions/account-transaction.xhtml): every
 * account_transactions row for an account, oldest first, with opening,
 * running and closing balances computed on the server, and the PDF.
 * The text filter only narrows the table; tiles, totals and the PDF always
 * cover the whole period. Rows stay in date order so the balance reads down.
 */
@Component({
  selector: 'app-account-transactions',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputTextModule, TableModule, EntityPickerComponent, PageHeaderComponent, ReportViewerComponent, StatTilesComponent],
  templateUrl: './account-transactions.component.html',
  styleUrl: './account-transactions.component.scss',
})
export class AccountTransactionsComponent {
  private api = inject(ApiService);

  account: any = null;
  statement: any = null;
  fromDate: string | null = null;
  toDate: string | null = null;
  text = '';
  loading = false;
  printing = false;
  reportData = new ReportData();

  get visibleRows(): any[] {
    const rows = this.statement?.rows || [];
    const t = this.text.trim().toLowerCase();
    return t ? rows.filter((r: any) => `${r.description || ''} ${r.transaction || ''}`.toLowerCase().includes(t)) : rows;
  }

  get tiles(): StatTile[] {
    const s = this.statement || {};
    return [
      { label: 'Transactions', value: s.transactionCount, format: 'number' },
      { label: 'Opening balance', value: s.openingBalance },
      { label: 'Total credit', value: s.totalCredit, foot: `${s.creditCount || 0} credit(s)` },
      { label: 'Total debit', value: s.totalDebit, foot: `${s.debitCount || 0} debit(s)` },
      { label: 'Closing balance', value: s.closingBalance, tone: (s.closingBalance || 0) < 0 ? 'bad' : 'ok' },
    ];
  }

  get periodLabel(): string {
    if (!this.statement?.periodApplied) {
      return 'Whole history';
    }
    const f = this.statement.fromDate || '…';
    const t = this.statement.toDate || '…';
    return `Period ${f} to ${t}`;
  }

  selectAccount(account: any) {
    this.account = account;
    this.statement = null;
    if (account) {
      this.load();
    }
  }

  clearPeriod() {
    this.fromDate = null;
    this.toDate = null;
    this.load();
  }

  private params() {
    return { accountId: this.account?.id, fromDate: this.fromDate, toDate: this.toDate };
  }

  async load() {
    if (!this.account) {
      return;
    }
    this.loading = true;
    const response = await this.api.get('history/account-transactions', this.params());
    this.loading = false;
    if (response.success) {
      this.statement = response.data;
    }
  }

  async print() {
    this.printing = true;
    const response = await this.api.get('history/account-transactions/report', this.params());
    this.printing = false;
    if (response.success) {
      this.reportData.showPdfReport('Account Statement', response.data);
    }
  }
}
