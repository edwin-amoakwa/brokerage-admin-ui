import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
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
import { firstOfMonth, sideSeverity } from '../equities-shared';

/** Equity transactions: the read-only blotter of executions (JSF equities/equity-trades-transaction.xhtml). */
@Component({
  selector: 'app-executions',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputTextModule, ProgressBarModule, SelectModule, TableModule, TagModule,
    PageHeaderComponent, ReportViewerComponent, StatTilesComponent],
  templateUrl: './executions.component.html',
  styleUrl: './executions.component.scss',
})
export class ExecutionsComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);

  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  tiles: StatTile[] = [];
  filter: any = { fromDate: firstOfMonth(), toDate: today(), buySell: null, stockId: null, transactionStatus: null, keyword: '' };
  sides: any[] = [];
  stocks: any[] = [];
  statuses: any[] = [];
  reportData = new ReportData();
  private lastEvent: any = { first: 0, rows: 25 };

  side = sideSeverity;

  async ngOnInit() {
    [this.sides, this.stocks, this.statuses] = await Promise.all([
      this.lookups.enum('BuySell'), this.lookups.list('stocks'), this.lookups.enum('TransactionStatus'),
    ]);
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const [response, summary] = await Promise.all([
      this.api.get('equity-executions', { ...this.filter, ...pageParams(event, 25) }),
      this.api.get('equity-executions/summary', this.filter),
    ]);
    this.loading = false;
    if (response.success) {
      this.rows = response.data;
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
    if (summary.success) {
      const s = summary.data;
      this.tiles = [
        { label: 'Executions', value: s.totalCount, format: 'number' },
        { label: 'Buy consideration', value: s.buyConsideration, foot: `${s.buyCount} buy(s)` },
        { label: 'Sell consideration', value: s.sellConsideration, foot: `${s.sellCount} sell(s)` },
        { label: 'Quantity', value: s.totalQuantity, format: 'number' },
        { label: 'Unprocessed', value: s.unprocessedCount, format: 'number', tone: s.unprocessedCount ? 'warn' : '' },
      ];
    }
  }

  async print() {
    const response = await this.api.get('equity-executions/report', this.filter);
    if (response.success) {
      this.reportData.showPdfReport('Equity Transaction Report', response.data);
    }
  }
}
