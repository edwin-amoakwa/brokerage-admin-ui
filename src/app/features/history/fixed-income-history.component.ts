import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/api.service';
import { pageParams } from '../../core/api-response';
import { ReportData } from '../../core/report-data';
import { EntityPickerComponent } from '../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../shared/report-viewer/report-viewer.component';

/**
 * Fixed-income transactions by value date (JSF transactions/fi-transaction-history.xhtml).
 * Adds an optional account and authorised filter; the list is paged.
 * Days run and accrued interest are as at today (capped at maturity).
 */
@Component({
  selector: 'app-fixed-income-history',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputTextModule, SelectModule, TableModule, TagModule, EntityPickerComponent, PageHeaderComponent, ReportViewerComponent],
  templateUrl: './fixed-income-history.component.html',
  styleUrl: './fixed-income-history.component.scss',
})
export class FixedIncomeHistoryComponent {
  private api = inject(ApiService);

  account: any = null;
  fromDate: string | null = null;
  toDate: string | null = null;
  authorised = '';
  authOptions = [
    { id: '', itemName: 'All' },
    { id: 'true', itemName: 'Authorised' },
    { id: 'false', itemName: 'Unauthorised' },
  ];
  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  printing = false;
  reportData = new ReportData();
  private lastEvent: any = { first: 0, rows: 20 };

  private filters() {
    return { accountId: this.account?.id, fromDate: this.fromDate, toDate: this.toDate, authorised: this.authorised };
  }

  clear() {
    this.account = null;
    this.fromDate = null;
    this.toDate = null;
    this.authorised = '';
    this.reload();
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const response = await this.api.get('history/fixed-income-transactions', { ...this.filters(), ...pageParams(event) });
    this.loading = false;
    if (response.success) {
      this.rows = response.data || [];
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
  }

  async print() {
    this.printing = true;
    const response = await this.api.get('history/fixed-income-transactions/report', this.filters());
    this.printing = false;
    if (response.success) {
      this.reportData.showPdfReport('Fixed Income Transaction Report', response.data);
    }
  }
}
