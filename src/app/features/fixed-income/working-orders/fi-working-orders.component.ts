import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { LiveOrdersService, OrderChange } from '../../../core/live-orders.service';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ApiService } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { ReportData } from '../../../core/report-data';
import { EntityPickerComponent } from '../../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../../shared/report-viewer/report-viewer.component';
import { FixedIncomeOptionsService, orderStatusSeverity } from '../fixed-income-options.service';

/**
 * Working fixed-income orders and the executions (fills) recorded against
 * them (JSF fixed-income/fixed-income-working-orders.xhtml). Saving an
 * execution now validates, sets the account and updates the order's amount
 * sold / left. ?orderId=... opens an order directly (used by Execution Processing).
 */
@Component({
  selector: 'app-fi-working-orders',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule, TextareaModule,
    EntityPickerComponent, PageHeaderComponent, ReportViewerComponent],
  templateUrl: './fi-working-orders.component.html',
  styleUrl: './fi-working-orders.component.scss',
})
export class FiWorkingOrdersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private options = inject(FixedIncomeOptionsService);
  private notify = inject(NotifyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  saving = false;
  printing = false;
  order: any = null;
  executions: any[] = [];
  tx: any = null;
  security: any = null;
  markets: any[] = [];
  execTypes: any[] = [];
  currencies: any[] = [];
  reportData = new ReportData();
  severity = orderStatusSeverity;
  private lastEvent: any = { first: 0, rows: 20 };

  get working(): boolean {
    return ['PENDING', 'SUBMITTED', 'PARTIALLY_FILLED'].includes(this.order?.orderStatus) || !!this.tx?.id;
  }

  readonly live = inject(LiveOrdersService);
  private liveSubs: Subscription[] = [];
  private liveReload: any = null;

  ngOnDestroy() {
    this.liveSubs.forEach((s) => s.unsubscribe());
    clearTimeout(this.liveReload);
    this.live.release();
  }

  /** A fixed income order changed: refresh the list (once per burst) and the open order, if it is that one. */
  private onLiveChange(change: OrderChange) {
    if (change.assetClass === 'FIXED_INCOME') {
      this.refreshFromLive(change.orderId);
    }
  }

  private refreshFromLive(orderId: string | null) {
    clearTimeout(this.liveReload);
    this.liveReload = setTimeout(async () => {
      this.load(this.lastEvent);
      if (this.order?.id && (orderId === null || orderId === this.order.id)) {
        // Refresh the open order and its executions without clearing the execution form.
        await this.refreshOrder();
        await this.loadExecutions();
      }
    }, 300);
  }

  async ngOnInit() {
    this.live.acquire();
    this.liveSubs = [
      this.live.changes$.subscribe((c) => this.onLiveChange(c)),
      this.live.resync$.subscribe(() => this.refreshFromLive(null)),
    ];
    const [markets, execTypes, options] = await Promise.all([this.lookups.enum('FIMarketType'), this.lookups.enum('ExecType'), this.options.load()]);
    this.markets = markets;
    this.execTypes = execTypes;
    this.currencies = options.currencies;
    const orderId = this.route.snapshot.queryParamMap.get('orderId');
    if (orderId) {
      this.manage(orderId);
    }
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const response = await this.api.get('fixed-income-working-orders', pageParams(event));
    this.loading = false;
    if (response.success) {
      this.rows = response.data;
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
  }

  async manage(orderId: string) {
    const response = await this.api.get(`fixed-income-working-orders/${orderId}`);
    if (!response.success || !response.data) {
      return;
    }
    this.order = response.data;
    this.newExecution();
    await this.loadExecutions();
  }

  private async refreshOrder() {
    const response = await this.api.get(`fixed-income-working-orders/${this.order.id}`);
    if (response.success && response.data) {
      this.order = response.data;
    }
  }

  async loadExecutions() {
    const response = await this.api.get(`fixed-income-working-orders/${this.order.id}/executions`);
    this.executions = response.success ? response.data : [];
  }

  newExecution() {
    this.tx = { valueDate: this.order.valueDate, market: 'PRIMARY', currency: 'GHS', executionType: 'FILL' };
    this.security = this.order.fixedIncomeId ? { id: this.order.fixedIncomeId, displayName: this.order.fixedIncomeName } : null;
  }

  editExecution(row: any) {
    this.tx = { ...row };
    this.security = row.fixedIncomeId ? { id: row.fixedIncomeId, displayName: row.fixedIncomeName, issueDate: row.issueDate } : null;
  }

  async save() {
    if (!this.security) {
      this.notify.warn('Select the fixed income security');
      return;
    }
    this.saving = true;
    const body = { ...this.tx, fixedIncomeId: this.security.id };
    const path = `fixed-income-working-orders/${this.order.id}/executions`;
    const response = this.tx.id ? await this.api.put(path, body) : await this.api.post(path, body);
    this.saving = false;
    if (response.success) {
      await this.refreshOrder();
      this.newExecution();
      await this.loadExecutions();
    }
  }

  async removeExecution(row: any) {
    if (await this.notify.confirmDelete(`execution ${row.executionId || ''}`)) {
      const response = await this.api.delete(`fixed-income-working-orders/${this.order.id}/executions/${row.id}`);
      if (response.success) {
        await this.refreshOrder();
        await this.loadExecutions();
      }
    }
  }

  async print() {
    this.printing = true;
    const response = await this.api.get(`fixed-income-working-orders/${this.order.id}/executions/report`);
    this.printing = false;
    if (response.success) {
      this.reportData.showPdfReport(`Order ${this.order.orderNo} transactions`, response.data);
    }
  }

  close() {
    this.order = null;
    this.tx = null;
    this.executions = [];
    if (this.route.snapshot.queryParamMap.get('orderId')) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    }
    // The list table is re-created and lazy-loads itself.
    this.first = 0;
  }
}
