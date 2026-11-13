import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';

/**
 * Dividend processing (JSF equities/dividend-processing.xhtml) and bonus
 * processing (equities/bonus-processing.xhtml); route data.kind picks which.
 * Preview the per-account entitlements, then process: every payout and the
 * status change are written in one transaction.
 */
@Component({
  selector: 'app-corporate-action-processing',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputTextModule, TableModule, TagModule, PageHeaderComponent, StatTilesComponent],
  templateUrl: './corporate-action-processing.component.html',
  styleUrl: './corporate-action-processing.component.scss',
})
export class CorporateActionProcessingComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotifyService);
  private route = inject(ActivatedRoute);

  bonus = false;
  resource = 'dividend-processing';
  rows: any[] = [];
  tiles: StatTile[] = [];
  previewTiles: StatTile[] = [];
  preview: any = null;
  subject: any = null;
  search = '';
  busy = false;

  ngOnInit() {
    this.bonus = this.route.snapshot.data['kind'] === 'bonus';
    this.resource = this.bonus ? 'bonus-processing' : 'dividend-processing';
    this.load();
  }

  async load() {
    const response = await this.api.get(this.resource);
    if (response.success) {
      this.rows = response.data.rows;
      this.tiles = [
        { label: 'Unprocessed', value: response.data.unprocessedCount, format: 'number', tone: response.data.unprocessedCount ? 'warn' : '' },
        { label: 'Processed', value: response.data.processedCount, format: 'number', tone: 'ok' },
      ];
    }
  }

  filtered(): any[] {
    const k = this.search.trim().toLowerCase();
    return k ? this.rows.filter((r) => `${r.stockSymbol} ${r.stockName}`.toLowerCase().includes(k)) : this.rows;
  }

  async showPreview(row: any) {
    const response = await this.api.get(`${this.resource}/${row.id}/entitlements`);
    if (response.success) {
      this.subject = row;
      this.preview = response.data;
      this.previewTiles = [
        { label: 'Accounts', value: this.preview.rows.length, format: 'number' },
        this.bonus
          ? { label: 'Bonus shares to credit', value: this.preview.total, format: 'number' }
          : { label: 'Total gross payout', value: this.preview.total },
        this.bonus
          ? { label: 'Ratio', value: row.ratio, format: 'text' }
          : { label: 'Amount per share', value: row.amountPerShare },
      ];
    }
  }

  async process(row: any) {
    const what = this.bonus ? `the bonus issue on ${row.stockSymbol}` : `the dividend on ${row.stockSymbol}`;
    if (!(await this.notify.confirm(`Process ${what}? Payouts are created for every entitled account and it is marked processed.`, 'Process', 'Process'))) {
      return;
    }
    this.busy = true;
    const response = await this.api.post(`${this.resource}/${row.id}/process`);
    this.busy = false;
    if (response.success) {
      if (this.subject?.id === row.id) {
        this.preview = null;
      }
      this.load();
    }
  }

  async processAll() {
    if (!(await this.notify.confirm(`Process all ${this.rows.length} unprocessed ${this.bonus ? 'bonus issues' : 'dividends'}?`, 'Process all', 'Process all'))) {
      return;
    }
    this.busy = true;
    await this.api.post(`${this.resource}/process-all`);
    this.busy = false;
    this.preview = null;
    this.load();
  }
}
