import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, today } from '../../../core/api.service';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { EntityPickerComponent } from '../../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { FixedIncomeOptionsService } from '../fixed-income-options.service';

/**
 * Direct capture of fixed-income security trades (JSF
 * fixed-income/fixed-income-transactions.xhtml) in three stages: pick the
 * transaction date, see that date's trades, capture one (fields depend on the
 * market). Saving now goes through the service rules, the security is
 * required, and authorised trades are read-only.
 */
@Component({
  selector: 'app-fi-trades',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule,
    EntityPickerComponent, PageHeaderComponent],
  templateUrl: './fi-trades.component.html',
  styleUrl: './fi-trades.component.scss',
})
export class FiTradesComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private options = inject(FixedIncomeOptionsService);
  private notify = inject(NotifyService);

  pickDate = today();
  selectedDate: string | null = null;
  rows: any[] = [];
  tx: any = null;
  account: any = null;
  security: any = null;
  saving = false;
  markets: any[] = [];
  currencies: any[] = [];

  /** In form mode with an account picked, the account's trades for the date (selectedAccountTransactionsList). */
  get visibleRows(): any[] {
    if (this.tx && this.account) {
      return this.rows.filter((r) => r.accountId === this.account.id);
    }
    return this.rows;
  }

  async ngOnInit() {
    const [markets, options] = await Promise.all([this.lookups.enum('FIMarketType'), this.options.load()]);
    this.markets = markets;
    this.currencies = options.currencies;
  }

  start() {
    if (!this.pickDate) {
      this.notify.warn('Select the transaction date');
      return;
    }
    this.selectedDate = this.pickDate;
    this.tx = null;
    this.load();
  }

  async load() {
    const response = await this.api.get('fixed-income-trades', { transDate: this.selectedDate, paginated: false });
    this.rows = response.success ? response.data : [];
  }

  resetPage() {
    this.selectedDate = null;
    this.rows = [];
    this.tx = null;
    this.account = null;
    this.security = null;
  }

  newTransaction(account: any = null) {
    this.tx = { market: 'PRIMARY', currency: 'GHS' };
    this.account = account;
    this.security = null;
  }

  selectAccount(account: any) {
    this.account = account;
  }

  edit(row: any) {
    this.tx = { ...row };
    this.account = row.accountId ? { id: row.accountId, displayName: row.accountName } : null;
    this.security = row.fixedIncomeId ? { id: row.fixedIncomeId, displayName: row.fixedIncomeName, issueDate: row.issueDate } : null;
  }

  closeForm() {
    this.tx = null;
    this.account = null;
    this.security = null;
  }

  async save() {
    if (!this.account) {
      this.notify.warn('Select Account');
      return;
    }
    if (!this.security) {
      this.notify.warn('Select the fixed income security');
      return;
    }
    this.saving = true;
    const body = { ...this.tx, transDate: this.selectedDate, accountId: this.account.id, fixedIncomeId: this.security.id };
    const response = await this.api.save('fixed-income-trades', body);
    this.saving = false;
    if (response.success) {
      await this.load();
      this.newTransaction(this.account);
    }
  }

  async remove(row: any) {
    if (await this.notify.confirmDelete(`the ${row.fixedIncomeName || ''} transaction of ${row.accountName}`)) {
      const response = await this.api.delete(`fixed-income-trades/${row.id}`);
      if (response.success) {
        await this.load();
      }
    }
  }
}
