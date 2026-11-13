import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api.service';
import { pageParams } from '../../core/api-response';
import { ReportData } from '../../core/report-data';
import { EntityPickerComponent } from '../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../shared/report-viewer/report-viewer.component';
import { statusSeverity } from '../cash/cash-transactions.component';

/**
 * Read-only cash transaction history (JSF transactions/cash-transaction-records.xhtml).
 * Account is optional; the list is paged and newest first. Editing lives on
 * Cash Transactions (the JSF edit column was permanently hidden).
 */
@Component({
  selector: 'app-cash-transaction-history',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputTextModule, TableModule, TagModule, EntityPickerComponent, PageHeaderComponent, ReportViewerComponent],
  templateUrl: './cash-transaction-history.component.html',
  styleUrl: './cash-transaction-history.component.scss',
})
export class CashTransactionHistoryComponent {
  private api = inject(ApiService);

  account: any = null;
  fromDate: string | null = null;
  toDate: string | null = null;
  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  printing = false;
  reportData = new ReportData();
  private lastEvent: any = { first: 0, rows: 20 };

  severity(row: any) {
    return statusSeverity(row);
  }

  private filters() {
    return { accountId: this.account?.id, fromDate: this.fromDate, toDate: this.toDate };
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const response = await this.api.get('history/cash-transactions', { ...this.filters(), ...pageParams(event) });
    this.loading = false;
    if (response.success) {
      this.rows = response.data || [];
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
  }

  async print() {
    this.printing = true;
    const response = await this.api.get('history/cash-transactions/report', this.filters());
    this.printing = false;
    if (response.success) {
      this.reportData.showPdfReport('Cash Transaction Report', response.data);
    }
  }
}
