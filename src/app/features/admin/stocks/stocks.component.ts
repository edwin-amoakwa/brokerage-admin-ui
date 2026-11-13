import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, readFileAsUpload } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';

/**
 * Stock register (JSF sysadmin/stocks.xhtml): summary tiles, searchable list,
 * create/edit with share checks, guarded delete, and the read -> preview ->
 * confirm Excel upload. The server re-reads the same file on confirm, so no
 * preview state is kept between requests.
 */
@Component({
  selector: 'app-stocks',
  imports: [FormsModule, DecimalPipe, ButtonModule, DialogModule, InputNumberModule, InputTextModule, ProgressBarModule, SelectModule, TableModule, TagModule, PageHeaderComponent, StatTilesComponent],
  templateUrl: './stocks.component.html',
  styleUrl: './stocks.component.scss',
})
export class StocksComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);

  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  saving = false;
  keyword = '';
  exchangeId: string | null = null;
  missingOnly = false;
  tiles: StatTile[] = [];
  exchanges: any[] = [];
  industries: any[] = [];
  registrars: any[] = [];
  record: any = null;
  dialogVisible = false;

  uploadVisible = false;
  upload: any = {};
  uploadFile: File | null = null;
  preview: any = null;
  previewTiles: StatTile[] = [];
  reading = false;
  confirming = false;
  private lastEvent: any = { first: 0, rows: 20 };

  async ngOnInit() {
    this.loadSummary();
    [this.exchanges, this.industries, this.registrars] = await Promise.all([
      this.lookups.list('stock-exchanges'),
      this.lookups.list('industries'),
      this.lookups.list('registrars'),
    ]);
  }

  async loadSummary() {
    const response = await this.api.get('stocks/summary');
    if (!response.success) {
      return;
    }
    const s = response.data;
    this.tiles = [
      { label: 'Listed stocks', value: s.totalCount, format: 'number', key: 'all', foot: 'Click to clear filters', active: !this.missingOnly },
      { label: 'Exchanges', value: s.exchangeCount, format: 'number' },
      { label: 'Issued shares', value: s.totalIssuedShares, format: 'number' },
      { label: 'Missing share data', value: s.missingShareDataCount, format: 'number', key: 'missing', tone: s.missingShareDataCount ? 'warn' : '', active: this.missingOnly },
    ];
  }

  onTile(tile: StatTile) {
    if (tile.key === 'all') {
      this.keyword = '';
      this.exchangeId = null;
      this.missingOnly = false;
    } else if (tile.key === 'missing') {
      this.missingOnly = true;
    } else {
      return;
    }
    this.tiles = this.tiles.map((t) => ({ ...t, active: t.key === 'missing' ? this.missingOnly : t.key === 'all' ? !this.missingOnly : false }));
    this.reload();
  }

  refresh() {
    this.loadSummary();
    this.reload();
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const response = await this.api.get('stocks', {
      keyword: this.keyword,
      stockExchangeId: this.exchangeId,
      missingShareData: this.missingOnly || null,
      ...pageParams(event),
    });
    this.loading = false;
    if (response.success) {
      this.rows = response.data || [];
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
  }

  issuedPercent(r: any): number {
    const authorised = Number(r?.authorisedShares) || 0;
    if (authorised <= 0) {
      return -1;
    }
    return Math.round(((Number(r.issuedShares) || 0) * 1000) / authorised) / 10;
  }

  create() {
    this.record = { authorisedShares: 0, issuedShares: 0 };
    this.dialogVisible = true;
  }

  edit(row: any) {
    this.record = { ...row };
    this.dialogVisible = true;
  }

  async save() {
    const r = this.record;
    if (!r.stockSymbol?.trim() || !r.stockName?.trim() || !r.stockExchangeId) {
      this.notify.warn('Enter the symbol, name and stock exchange', 'Required');
      return;
    }
    if (r.authorisedShares > 0 && r.issuedShares > r.authorisedShares) {
      this.notify.warn('Issued shares cannot exceed the authorised shares');
      return;
    }
    this.saving = true;
    const response = await this.api.save('stocks', r);
    this.saving = false;
    if (response.success) {
      this.dialogVisible = false;
      this.lookups.invalidate('stocks');
      this.refreshAfterChange();
    }
  }

  async remove(row: any) {
    if (!(await this.notify.confirmDelete(`the stock ${row.stockSymbol}`))) {
      return;
    }
    const response = await this.api.delete(`stocks/${row.id}`);
    if (response.success) {
      this.lookups.invalidate('stocks');
      this.refreshAfterChange();
    }
  }

  private refreshAfterChange() {
    this.loadSummary();
    this.load(this.lastEvent);
  }

  openUpload() {
    this.upload = {};
    this.uploadFile = null;
    this.preview = null;
    this.uploadVisible = true;
  }

  setUploadFile(file: File | null) {
    this.uploadFile = file;
    this.preview = null;
  }

  private async uploadPayload(): Promise<any | null> {
    if (!this.upload.stockExchangeId || !this.upload.registrarId) {
      this.notify.warn('Select the stock exchange and the registrar', 'Required');
      return null;
    }
    if (!this.uploadFile) {
      this.notify.warn('Select the Excel file', 'Required');
      return null;
    }
    const file = await readFileAsUpload(this.uploadFile);
    return { ...file, stockExchangeId: this.upload.stockExchangeId, registrarId: this.upload.registrarId };
  }

  async readFile() {
    const payload = await this.uploadPayload();
    if (!payload) {
      return;
    }
    this.reading = true;
    const response = await this.api.post('stocks/upload/preview', payload);
    this.reading = false;
    if (!response.success) {
      this.preview = null;
      return;
    }
    this.preview = response.data;
    this.previewTiles = [
      { label: 'To create', value: this.preview.createCount, format: 'number', tone: 'ok' },
      { label: 'Skipped', value: this.preview.skipCount, format: 'number', tone: this.preview.skipCount ? 'warn' : '' },
      { label: 'Already listed', value: this.preview.duplicateCount, format: 'number', tone: this.preview.duplicateCount ? 'bad' : '' },
      { label: 'Rows read', value: this.preview.rowsRead, format: 'number' },
    ];
  }

  async confirmUpload() {
    if (!(await this.notify.confirm(`Create ${this.preview.createCount} stock(s) on the register?`))) {
      return;
    }
    const payload = await this.uploadPayload();
    if (!payload) {
      return;
    }
    this.confirming = true;
    const response = await this.api.post('stocks/upload', payload);
    this.confirming = false;
    if (response.success) {
      this.uploadVisible = false;
      this.lookups.invalidate('stocks');
      this.refreshAfterChange();
    }
  }
}
