import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { LiveOrdersService, OrderChange } from '../../../core/live-orders.service';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, today } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { NotifyService } from '../../../core/notify.service';
import { ReportData } from '../../../core/report-data';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../../shared/report-viewer/report-viewer.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';
import { orderSeverity, sideSeverity } from '../equities-shared';

/**
 * Working orders (JSF equities/equity-working-orders.xhtml): the blotter of
 * PENDING / SUBMITTED / PARTIALLY_FILLED orders, booking fills against one and
 * processing them into a trade.
 */
@Component({
  selector: 'app-working-orders',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputNumberModule, InputTextModule, ProgressBarModule, TableModule, TagModule,
    PageHeaderComponent, ReportViewerComponent, StatTilesComponent],
  templateUrl: './working-orders.component.html',
  styleUrl: './working-orders.component.scss',
})
export class WorkingOrdersComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private notify = inject(NotifyService);
  readonly live = inject(LiveOrdersService);
  private liveSubs: Subscription[] = [];
  private liveReload: any = null;

  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  keyword = '';
  summary: any = {};
  tiles: StatTile[] = [];
  reportData = new ReportData();
  detail: any = null;
  order: any = null;
  fill: any = {};
  busy = false;
  private lastEvent: any = { first: 0, rows: 15 };

  severity = orderSeverity;
  side = sideSeverity;

  ngOnInit() {
    this.live.acquire();
    this.liveSubs = [
      this.live.changes$.subscribe((c) => this.onLiveChange(c)),
      this.live.resync$.subscribe(() => this.refreshFromLive(null)),
    ];
  }

  ngOnDestroy() {
    this.liveSubs.forEach((s) => s.unsubscribe());
    clearTimeout(this.liveReload);
    this.live.release();
  }

  /** An equity order changed: refresh the blotter (once per burst) and the open order, if it is that one. */
  private onLiveChange(change: OrderChange) {
    if (change.assetClass !== 'EQUITY') {
      return;
    }
    if (change.actor === 'Exchange' || change.actor === 'FIX gateway') {
      this.notify.info(change.text || change.label, `Order ${change.orderNo ?? ''}: ${change.label}`);
    }
    this.refreshFromLive(change.orderId);
  }

  private refreshFromLive(orderId: string | null) {
    clearTimeout(this.liveReload);
    this.liveReload = setTimeout(async () => {
      this.load(this.lastEvent);
      if (this.order && (orderId === null || orderId === this.order.id)) {
        // Refresh the open order's figures without clearing a fill the desk may be typing.
        const response = await this.api.get(`working-orders/${this.order.id}`);
        if (response.success && this.order) {
          this.detail = response.data;
          this.order = response.data.order;
        }
      }
    }, 300);
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const [response, summary] = await Promise.all([
      this.api.get('working-orders', { keyword: this.keyword, ...pageParams(event, 15) }),
      this.api.get('working-orders/summary', { keyword: this.keyword }),
    ]);
    this.loading = false;
    if (response.success) {
      this.rows = response.data;
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
    if (summary.success) {
      this.summary = summary.data;
      this.tiles = [
        { label: 'Working orders', value: this.summary.workingCount, format: 'number' },
        { label: 'Quantity remaining', value: this.summary.quantityRemaining, format: 'number' },
        { label: 'Value at risk', value: this.summary.valueAtRisk },
        { label: 'Expiring today', value: this.summary.expiringTodayCount, format: 'number', tone: this.summary.expiringTodayCount ? 'warn' : '' },
      ];
    }
  }

  async print() {
    const response = await this.api.get('working-orders/report', { keyword: this.keyword });
    if (response.success) {
      this.reportData.showPdfReport('Working Orders', response.data);
    }
  }

  async open(row: any) {
    const response = await this.api.get(`working-orders/${row.id}`);
    if (response.success) {
      this.setDetail(response.data);
    }
  }

  private setDetail(data: any) {
    this.detail = data;
    this.order = data.order;
    this.resetFill();
  }

  close() {
    this.detail = null;
    this.order = null;
  }

  resetFill() {
    this.fill = { valueDate: today(), quantity: this.detail?.remainingToBook ?? 0, executionPrice: this.order?.orderPrice ?? 0 };
  }

  fillRemainder() {
    this.fill.quantity = this.detail.remainingToBook;
  }

  percent(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
  }

  previewType(): string {
    const q = this.fill.quantity || 0;
    if (q <= 0) {
      return 'New';
    }
    return q >= this.order.remaining ? 'Fill' : 'Partial fill';
  }

  previewConsideration(): number {
    return (this.fill.quantity || 0) * (this.fill.executionPrice || 0);
  }

  previewFilled(): number {
    return this.order.qtyExecuted + this.detail.bookedQuantity + Math.max(0, this.fill.quantity || 0);
  }

  previewRemaining(): number {
    return Math.max(0, this.order.orderQuantity - this.previewFilled());
  }

  previewStatus(): string {
    const filled = this.previewFilled();
    if (filled >= this.order.orderQuantity) {
      return 'Completely filled';
    }
    return filled > 0 ? 'Partially filled' : 'Pending';
  }

  async bookFill() {
    this.busy = true;
    const response = await this.api.post(`working-orders/${this.order.id}/fills`, this.fill);
    this.busy = false;
    if (response.success) {
      this.setDetail(response.data);
    }
  }

  async removeFill(execution: any) {
    if (await this.notify.confirmDelete(`execution ${execution.executionId ?? ''}`)) {
      const response = await this.api.delete(`working-orders/fills/${execution.id}`);
      if (response.success) {
        this.open(this.order);
      }
    }
  }

  async process() {
    if (!(await this.notify.confirm('Process the booked executions into a trade? Fees are applied and the order is updated.', 'Process trade', 'Process'))) {
      return;
    }
    this.busy = true;
    const response = await this.api.post(`working-orders/${this.order.id}/process`);
    this.busy = false;
    if (response.success) {
      this.setDetail(response.data);
    }
  }
}
