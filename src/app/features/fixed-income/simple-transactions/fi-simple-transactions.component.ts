import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, today } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { ReportData } from '../../../core/report-data';
import { EntityPickerComponent } from '../../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../../shared/report-viewer/report-viewer.component';
import { FixedIncomeOptionsService, addDays } from '../fixed-income-options.service';

/**
 * Simple fixed-income placements with no security record (JSF
 * fixed-income/simple-transaction.xhtml): account, asset type, amount, rate,
 * start date and tenor -> maturity date. List, edit, delete and print per account.
 */
@Component({
  selector: 'app-fi-simple-transactions',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, CheckboxModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule,
    EntityPickerComponent, PageHeaderComponent, ReportViewerComponent],
  templateUrl: './fi-simple-transactions.component.html',
  styleUrl: './fi-simple-transactions.component.scss',
})
export class FiSimpleTransactionsComponent implements OnInit {
  private api = inject(ApiService);
  private options = inject(FixedIncomeOptionsService);
  private notify = inject(NotifyService);

  account: any = null;
  fromDate: string | null = null;
  toDate: string | null = null;
  rows: any[] = [];
  trade: any = {};
  saving = false;
  printing = false;
  subClasses: any[] = [];
  tenors: any[] = [];
  reportData = new ReportData();

  async ngOnInit() {
    const options = await this.options.load();
    this.subClasses = options.subClasses;
    this.tenors = options.tenors;
    this.clearTrade();
  }

  selectAccount(account: any) {
    this.account = account;
    this.rows = [];
    this.clearTrade();
    if (account) {
      this.load();
    }
  }

  private filters() {
    return { accountId: this.account?.id, fromDate: this.fromDate, toDate: this.toDate, paginated: false };
  }

  async load() {
    const response = await this.api.get('fixed-income-simple-transactions', this.filters());
    this.rows = response.success ? response.data : [];
  }

  clearTrade() {
    this.trade = { valueDate: today(), authorised: false };
  }

  edit(row: any) {
    this.trade = { ...row };
  }

  /** updateMaturityDate: start date + tenor days. */
  updateMaturity() {
    const tenor = this.tenors.find((t) => t.id === this.trade.tenor);
    if (tenor && this.trade.valueDate) {
      this.trade.maturityDate = addDays(this.trade.valueDate, tenor.days);
    }
  }

  async save() {
    this.saving = true;
    const response = await this.api.save('fixed-income-simple-transactions', { ...this.trade, accountId: this.account.id });
    this.saving = false;
    if (response.success) {
      this.clearTrade();
      await this.load();
    }
  }

  async remove(row: any) {
    if (await this.notify.confirmDelete('this transaction')) {
      const response = await this.api.delete(`fixed-income-simple-transactions/${row.id}`);
      if (response.success) {
        await this.load();
      }
    }
  }

  async print() {
    this.printing = true;
    const response = await this.api.get('fixed-income-simple-transactions/report', this.filters());
    this.printing = false;
    if (response.success) {
      this.reportData.showPdfReport(`Fixed income transactions - ${this.account.displayName}`, response.data);
    }
  }
}
