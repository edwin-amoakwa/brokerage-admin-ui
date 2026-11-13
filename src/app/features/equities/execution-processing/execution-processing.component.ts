import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { StepperModule } from 'primeng/stepper';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, today } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { ReportData } from '../../../core/report-data';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../../shared/report-viewer/report-viewer.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';
import { sideSeverity } from '../equities-shared';

/**
 * Execution processing (JSF equities/execution-processing.xhtml): a day's
 * executions grouped by order, consolidated into one trade per order, plus
 * the days still awaiting processing.
 */
@Component({
  selector: 'app-execution-processing',
  imports: [FormsModule, DatePipe, DecimalPipe, RouterLink, ButtonModule, InputTextModule, MessageModule, StepperModule, TableModule, TagModule,
    PageHeaderComponent, ReportViewerComponent, StatTilesComponent],
  templateUrl: './execution-processing.component.html',
  styleUrl: './execution-processing.component.scss',
})
export class ExecutionProcessingComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  valueDate = today();
  day: any = {};
  summary: any = {};
  groups: any[] = [];
  trades: any[] = [];
  pendingDays: any[] = [];
  tiles: StatTile[] = [];
  search = '';
  busy = false;
  reportData = new ReportData();

  side = sideSeverity;

  ngOnInit() {
    this.load();
    this.loadPendingDays();
  }

  async load() {
    const response = await this.api.get('execution-processing/day', { valueDate: this.valueDate });
    if (!response.success) {
      return;
    }
    this.day = response.data;
    this.summary = response.data.summary;
    this.groups = response.data.groups;
    this.trades = response.data.trades;
    const s = this.summary;
    this.tiles = [
      { label: 'Executions', value: s.executionCount, format: 'number' },
      { label: 'Orders', value: s.orderCount, format: 'number' },
      { label: 'Awaiting', value: s.pendingCount, format: 'number', foot: `${s.pendingGroupCount} order(s)`, tone: s.pendingCount ? 'warn' : '' },
      { label: 'Processed', value: s.processedCount, format: 'number', foot: `${s.processedGroupCount} order(s)`, tone: 'ok' },
      { label: 'Executed value', value: s.executedValue },
    ];
  }

  async loadPendingDays() {
    const response = await this.api.get('execution-processing/pending-days');
    if (response.success) {
      this.pendingDays = response.data;
    }
  }

  step(): number {
    if (!this.summary.executionCount) {
      return 1;
    }
    if (this.summary.pendingCount > 0) {
      return this.summary.processedCount > 0 ? 3 : 2;
    }
    return 4;
  }

  filteredGroups(): any[] {
    const k = this.search.trim().toLowerCase();
    if (!k) {
      return this.groups;
    }
    return this.groups.filter((g) =>
      [g.orderNo, g.accountName, g.accountCode, g.stockSymbol, g.stockName].some((v) => `${v ?? ''}`.toLowerCase().includes(k)));
  }

  pendingFills(): number {
    return this.pendingDays.reduce((sum, d) => sum + (d.fills || 0), 0);
  }

  selectDay(day: any) {
    this.valueDate = day.valueDate;
    this.load();
  }

  async processDay() {
    if (!(await this.notify.confirm('Process the executions of this day into trades? Fees are applied and orders updated.', 'Process into trades', 'Process'))) {
      return;
    }
    this.busy = true;
    await this.api.post('execution-processing/process', null, { valueDate: this.valueDate });
    this.busy = false;
    this.load();
    this.loadPendingDays();
  }

  async processAll() {
    if (!(await this.notify.confirm('Process every day that still has unprocessed executions into trades?', 'Process all', 'Process all'))) {
      return;
    }
    this.busy = true;
    await this.api.post('execution-processing/process-all');
    this.busy = false;
    this.load();
    this.loadPendingDays();
  }

  async print() {
    const response = await this.api.get('execution-processing/report', { valueDate: this.valueDate });
    if (response.success) {
      this.reportData.showPdfReport('Trade & Settlement Report', response.data);
    }
  }
}
