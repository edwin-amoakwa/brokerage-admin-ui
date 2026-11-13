import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ApiService, today } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { ReportData } from '../../../core/report-data';
import { EntityPickerComponent } from '../../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../../shared/report-viewer/report-viewer.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';
import { orderSeverity, sideSeverity } from '../equities-shared';

/**
 * Equity order blotter and order ticket (JSF equities/trade-order.xhtml).
 * The ticket runs left to right: pick an account, enter the order, confirm it
 * (the server prices it), then save.
 */
@Component({
  selector: 'app-equity-orders',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputNumberModule, InputTextModule, ProgressBarModule, SelectModule,
    TableModule, TagModule, TextareaModule, EntityPickerComponent, PageHeaderComponent, ReportViewerComponent, StatTilesComponent],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class EquityOrdersComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);
  private route = inject(ActivatedRoute);

  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  summary: any = {};
  tiles: StatTile[] = [];
  filter: any = { buySell: null, orderStatus: null, fromDate: '', toDate: '', keyword: '' };
  sides: any[] = [];
  statuses: any[] = [];
  stocks: any[] = [];
  timeInForces: any[] = [];
  orderTypes: any[] = [];
  reportData = new ReportData();

  ticket: any = null;
  account: any = null;
  priced: any = null;
  pricing = false;
  saving = false;
  private lastEvent: any = { first: 0, rows: 20 };

  severity = orderSeverity;
  side = sideSeverity;

  async ngOnInit() {
    [this.sides, this.statuses, this.stocks, this.timeInForces, this.orderTypes] = await Promise.all([
      this.lookups.enum('BuySell'), this.lookups.enum('OrderStatus'), this.lookups.list('stocks'),
      this.lookups.enum('TimeInForce'), this.lookups.enum('OrderType'),
    ]);
    const orderId = this.route.snapshot.queryParamMap.get('orderId');
    if (orderId) {
      const response = await this.api.get(`equity-orders/${orderId}`);
      if (response.success && response.data) {
        this.edit(response.data);
      }
    }
  }

  private params() {
    return { ...this.filter };
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const [response, summary] = await Promise.all([
      this.api.get('equity-orders', { ...this.params(), ...pageParams(event) }),
      this.api.get('equity-orders/summary', this.params()),
    ]);
    this.loading = false;
    if (response.success) {
      this.rows = response.data;
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
    if (summary.success) {
      this.summary = summary.data;
      this.tiles = [
        { label: 'Orders', value: this.summary.totalCount, format: 'number' },
        { label: 'Working', value: this.summary.workingCount, format: 'number', tone: 'warn' },
        { label: 'Filled', value: this.summary.filledCount, format: 'number', tone: 'ok' },
        { label: 'Working value', value: this.summary.workingValue },
      ];
    }
  }

  async print() {
    const response = await this.api.get('equity-orders/report', this.params());
    if (response.success) {
      this.reportData.showPdfReport('Trade Order Report', response.data);
    }
  }

  newOrder() {
    this.ticket = { orderStatus: 'PENDING', valueDate: today(), orderType: 'LIMIT_ORDER' };
    this.account = null;
    this.priced = null;
  }

  edit(row: any) {
    this.ticket = { ...row };
    this.account = row.accountId
      ? { id: row.accountId, accountName: row.accountName, accountCode: row.accountCode, displayName: `${row.accountCode} - ${row.accountName}` }
      : null;
    this.priced = null;
  }

  close() {
    // the blotter table reloads itself when it is shown again
    this.ticket = null;
    this.priced = null;
  }

  clearTicket() {
    this.newOrder();
  }

  selectAccount(account: any) {
    this.account = account;
    this.ticket.accountId = account?.id ?? null;
    this.unconfirm();
  }

  unconfirm() {
    this.priced = null;
  }

  saveLabel(): string {
    if (this.ticket?.buySell === 'BUY') {
      return 'Save Buy Order';
    }
    return this.ticket?.buySell === 'SELL' ? 'Save Sell Order' : 'Save Order';
  }

  async confirm() {
    if (!this.ticket.accountId) {
      this.notify.warn('Select an account first');
      return;
    }
    this.pricing = true;
    const response = await this.api.post('equity-orders/price', this.ticket);
    this.pricing = false;
    this.priced = response.success ? response.data : null;
  }

  async save() {
    if (!this.priced) {
      this.notify.warn('Confirm the order before saving it');
      return;
    }
    this.saving = true;
    const response = await this.api.save('equity-orders', this.ticket);
    this.saving = false;
    if (response.success) {
      this.close();
    }
  }

  async cancelOrder() {
    if (await this.notify.confirm('Cancel this order? Anything already executed stays executed.', 'Cancel order', 'Cancel order')) {
      const response = await this.api.put(`equity-orders/${this.ticket.id}/cancel`);
      if (response.success) {
        this.ticket = { ...response.data };
        this.priced = null;
      }
    }
  }

  async remove(row: any) {
    if (await this.notify.confirmDelete(`order ${row.orderNo ?? ''}`)) {
      const response = await this.api.delete(`equity-orders/${row.id}`);
      if (response.success) {
        this.load(this.lastEvent);
      }
    }
  }
}
