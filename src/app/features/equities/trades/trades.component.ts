import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, today } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { LookupService } from '../../../core/lookup.service';
import { ReportData } from '../../../core/report-data';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../../shared/report-viewer/report-viewer.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';
import { downloadBase64, firstOfMonth, sideSeverity } from '../equities-shared';

/**
 * Trade records (JSF equities/trade-records.xhtml): booked trades, a detail
 * view with fees, settlement summary and executions, and the contract note
 * and trade & settlement reports.
 */
@Component({
  selector: 'app-trades',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputTextModule, SelectModule, TableModule, TagModule,
    PageHeaderComponent, ReportViewerComponent, StatTilesComponent],
  templateUrl: './trades.component.html',
  styleUrl: './trades.component.scss',
})
export class TradesComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);

  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  summary: any = {};
  tiles: StatTile[] = [];
  filter: any = { buySell: null, stockId: null, fromDate: firstOfMonth(), toDate: today(), keyword: '' };
  sides: any[] = [];
  stocks: any[] = [];
  detail: any = null;
  trade: any = null;
  detailTiles: StatTile[] = [];
  reportData = new ReportData();
  private lastEvent: any = { first: 0, rows: 25 };

  side = sideSeverity;

  async ngOnInit() {
    [this.sides, this.stocks] = await Promise.all([this.lookups.enum('BuySell'), this.lookups.list('stocks')]);
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const [response, summary] = await Promise.all([
      this.api.get('equity-trades', { ...this.filter, ...pageParams(event, 25) }),
      this.api.get('equity-trades/summary', this.filter),
    ]);
    this.loading = false;
    if (response.success) {
      this.rows = response.data;
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
    if (summary.success) {
      const s = (this.summary = summary.data);
      this.tiles = [
        { label: 'Trades', value: s.totalCount, format: 'number' },
        { label: 'Buy consideration', value: s.buyConsideration, foot: `${s.buyCount} buy(s)` },
        { label: 'Sell consideration', value: s.sellConsideration, foot: `${s.sellCount} sell(s)` },
        { label: 'Commission', value: s.totalCommission, foot: `Other charges ${s.totalOtherCharges?.toFixed(2)}` },
        { label: 'Awaiting authorisation', value: s.pendingCount, format: 'number', tone: s.pendingCount ? 'warn' : '' },
      ];
    }
  }

  async view(row: any) {
    const response = await this.api.get(`equity-trades/${row.id}`);
    if (response.success) {
      this.detail = response.data;
      const t = (this.trade = response.data.trade);
      this.detailTiles = [
        { label: `${t.buySellName} ${t.stockSymbol}`, value: t.orderTypeName || '-', format: 'text' },
        { label: 'Quantity x price', value: `${t.quantity} x ${t.tradePrice?.toFixed(4)}`, format: 'text', foot: `${t.orderQtyExecuted} of ${t.orderQuantity} ordered executed` },
        { label: 'Consideration', value: t.consideration },
        { label: this.netLabel(), value: t.netConsideration },
      ];
    }
  }

  netLabel(): string {
    return this.trade?.buySell === 'SELL' ? 'Net proceeds to the client' : 'Net amount payable by the client';
  }

  async contractNote(row: any) {
    const response = await this.api.get(`equity-trades/${row.id}/contract-note`);
    if (response.success) {
      this.reportData.showPdfReport('Contract Note', response.data);
    }
  }

  async print() {
    const response = await this.api.get('equity-trades/report', this.filter);
    if (response.success) {
      this.reportData.showPdfReport('Trade & Settlement Report', response.data);
    }
  }

  async exportExcel() {
    const response = await this.api.get('equity-trades/export', this.filter);
    if (response.success) {
      downloadBase64(response.data);
    }
  }
}
