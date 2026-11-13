import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, today } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';

/**
 * Capture of dividends (JSF equities/dividend.xhtml) and bonus issues
 * (equities/bonus.xhtml); route data.kind picks which. Saving always puts the
 * record back to Declared; processed records cannot be edited or deleted.
 */
@Component({
  selector: 'app-corporate-actions',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule,
    PageHeaderComponent, StatTilesComponent],
  templateUrl: './corporate-actions.component.html',
  styleUrl: './corporate-actions.component.scss',
})
export class CorporateActionsComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);
  private route = inject(ActivatedRoute);

  bonus = false;
  resource = 'dividends';
  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  keyword = '';
  summary: any = {};
  tiles: StatTile[] = [];
  stocks: any[] = [];
  record: any = null;
  saving = false;
  private lastEvent: any = { first: 0, rows: 10 };

  async ngOnInit() {
    this.bonus = this.route.snapshot.data['kind'] === 'bonus';
    this.resource = this.bonus ? 'bonus-issues' : 'dividends';
    this.stocks = await this.lookups.list('stocks');
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  clearSearch() {
    this.keyword = '';
    this.reload();
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const resource = this.route.snapshot.data['kind'] === 'bonus' ? 'bonus-issues' : 'dividends';
    const [response, summary] = await Promise.all([
      this.api.get(resource, { keyword: this.keyword, ...pageParams(event, 10) }),
      this.api.get(`${resource}/summary`),
    ]);
    this.loading = false;
    if (response.success) {
      this.rows = response.data;
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
    if (summary.success) {
      this.summary = summary.data;
      this.tiles = [
        { label: this.route.snapshot.data['kind'] === 'bonus' ? 'Bonus issues' : 'Dividends', value: this.summary.totalCount, format: 'number', foot: 'Click to clear the search' },
        { label: 'Unprocessed', value: this.summary.declaredCount, format: 'number', tone: 'warn' },
        { label: 'Processed', value: this.summary.processedCount, format: 'number', tone: 'ok' },
      ];
    }
  }

  create() {
    this.record = { declareDate: today() };
  }

  clear() {
    this.record = { id: this.record?.id, declareDate: today() };
  }

  edit(row: any) {
    this.record = { ...row };
  }

  async save() {
    this.saving = true;
    const response = await this.api.save(this.resource, this.record);
    this.saving = false;
    if (response.success) {
      this.record = null;
    }
  }

  async remove(row: any) {
    if (await this.notify.confirmDelete(`this ${this.bonus ? 'bonus issue' : 'dividend'} on ${row.stockSymbol}`)) {
      const response = await this.api.delete(`${this.resource}/${row.id}`);
      if (response.success) {
        this.load(this.lastEvent);
      }
    }
  }
}
