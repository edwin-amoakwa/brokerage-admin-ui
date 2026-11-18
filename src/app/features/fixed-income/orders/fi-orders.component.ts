import { DatePipe, DecimalPipe } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { OrderTimelineComponent, TimelineEntry } from '../../../shared/order-timeline/order-timeline.component';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, today } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { ReportData } from '../../../core/report-data';
import { EntityPickerComponent } from '../../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../../shared/report-viewer/report-viewer.component';
import { FixedIncomeOptionsService, orderStatusSeverity } from '../fixed-income-options.service';

/**
 * Fixed-income trade orders (JSF fixed-income/fixed-income-trade-order.xhtml).
 * The JSF form had no buy/sell input and no confirm step, so it could never
 * save; this implements the intended ticket: enter -> review (projected
 * interest and maturity value) -> save.
 */
@Component({
  selector: 'app-fi-orders',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, DialogModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule,
    EntityPickerComponent, PageHeaderComponent, ReportViewerComponent, OrderTimelineComponent, TooltipModule],
  templateUrl: './fi-orders.component.html',
  styleUrl: './fi-orders.component.scss',
})
export class FiOrdersComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private options = inject(FixedIncomeOptionsService);
  private notify = inject(NotifyService);

  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  saving = false;
  printing = false;
  fromDate: string | null = null;
  toDate: string | null = null;
  keyword = '';
  record: any = null;
  account: any = null;
  security: any = null;
  quote: any = null;
  dialogVisible = false;
  buySellOptions: any[] = [];
  subClasses: any[] = [];
  reportData = new ReportData();
  severity = orderStatusSeverity;
  private lastEvent: any = { first: 0, rows: 20 };

  async ngOnInit() {
    this.buySellOptions = await this.lookups.enum('BuySell');
    this.subClasses = (await this.options.load()).subClasses;
  }

  private filters() {
    return { fromDate: this.fromDate, toDate: this.toDate, keyword: this.keyword };
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const response = await this.api.get('fixed-income-orders', { ...this.filters(), ...pageParams(event) });
    this.loading = false;
    if (response.success) {
      this.rows = response.data;
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
  }

  create() {
    this.record = { valueDate: today(), buySell: 'BUY' };
    this.account = null;
    this.security = null;
    this.quote = null;
    this.dialogVisible = true;
  }

  /** The order whose history is open (trading_activity_log). */
  historyOrder: any = null;
  history: TimelineEntry[] = [];
  historyVisible = false;
  historyLoading = false;

  async showHistory(row: any) {
    this.historyOrder = row;
    this.history = [];
    this.historyVisible = true;
    this.historyLoading = true;
    const response = await this.api.get(`fixed-income-orders/${row.id}/timeline`);
    this.historyLoading = false;
    if (response.success && this.historyOrder?.id === row.id) {
      this.history = response.data || [];
    }
  }

  edit(row: any) {
    this.record = { ...row };
    this.account = row.accountId ? { id: row.accountId, displayName: row.accountName } : null;
    this.security = row.fixedIncomeId ? { id: row.fixedIncomeId, displayName: row.fixedIncomeName } : null;
    this.quote = null;
    this.dialogVisible = true;
  }

  async selectSecurity(security: any) {
    this.security = security;
    if (!security) {
      return;
    }
    const response = await this.api.get(`fixed-income-orders/security-terms/${security.id}`);
    if (response.success) {
      const terms = response.data;
      this.record.maturityDate = terms.maturityDate;
      this.record.subClass = terms.subClass ?? this.record.subClass;
      if (!this.record.yield && terms.yield) {
        this.record.yield = terms.yield;
      }
    }
  }

  private payload() {
    return { ...this.record, accountId: this.account?.id ?? null, fixedIncomeId: this.security?.id ?? null };
  }

  async review() {
    if (!this.account) {
      this.notify.warn('Select an account first');
      return;
    }
    this.saving = true;
    const response = await this.api.post('fixed-income-orders/quote', this.payload());
    this.saving = false;
    if (response.success) {
      this.quote = response.data;
    }
  }

  async save() {
    this.saving = true;
    const response = await this.api.save('fixed-income-orders', this.payload());
    this.saving = false;
    if (response.success) {
      this.dialogVisible = false;
      this.load(this.lastEvent);
    }
  }

  async remove(row: any) {
    if (await this.notify.confirmDelete(`order ${row.orderNo}`)) {
      const response = await this.api.delete(`fixed-income-orders/${row.id}`);
      if (response.success) {
        this.load(this.lastEvent);
      }
    }
  }

  async print() {
    this.printing = true;
    const response = await this.api.get('fixed-income-orders/report', this.filters());
    this.printing = false;
    if (response.success) {
      this.reportData.showPdfReport('Fixed Income Trade Orders', response.data);
    }
  }
}
