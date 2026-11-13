import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, readFileAsUpload, today } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';

/**
 * Equity market prices (JSF sysadmin/equity-market-price.xhtml): filtered
 * list, manual entry, and an Excel upload previewed before it is saved. Rows
 * whose symbol matches no stock are listed as Unmatched instead of being
 * dropped silently.
 */
@Component({
  selector: 'app-equity-prices',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, DialogModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule, PageHeaderComponent, StatTilesComponent],
  templateUrl: './equity-prices.component.html',
  styleUrl: './equity-prices.component.scss',
})
export class EquityPricesComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);

  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  saving = false;
  fromDate: string | null = null;
  toDate: string | null = null;
  stockId: string | null = null;
  stocks: any[] = [];
  record: any = null;
  dialogVisible = false;

  uploadVisible = false;
  uploadFile: File | null = null;
  preview: any = null;
  previewTiles: StatTile[] = [];
  reading = false;
  confirming = false;
  private lastEvent: any = { first: 0, rows: 20 };

  async ngOnInit() {
    this.stocks = await this.lookups.list('stocks');
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const response = await this.api.get('equity-prices', { fromDate: this.fromDate, toDate: this.toDate, stockId: this.stockId, ...pageParams(event) });
    this.loading = false;
    if (response.success) {
      this.rows = response.data || [];
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
  }

  create() {
    this.record = { valueDate: today(), marketPrice: null, equityId: null };
    this.dialogVisible = true;
  }

  edit(row: any) {
    this.record = { ...row };
    this.dialogVisible = true;
  }

  async save() {
    const r = this.record;
    if (!r.valueDate || !r.equityId || !(r.marketPrice > 0)) {
      this.notify.warn('Enter the value date, equity and a market price above zero', 'Required');
      return;
    }
    this.saving = true;
    const response = await this.api.save('equity-prices', r);
    this.saving = false;
    if (response.success) {
      this.dialogVisible = false;
      this.load(this.lastEvent);
    }
  }

  async remove(row: any) {
    if (await this.notify.confirmDelete(`the ${row.equityCode} price of ${row.valueDate}`)) {
      const response = await this.api.delete(`equity-prices/${row.id}`);
      if (response.success) {
        this.load(this.lastEvent);
      }
    }
  }

  openUpload() {
    this.uploadFile = null;
    this.preview = null;
    this.uploadVisible = true;
  }

  setUploadFile(file: File | null) {
    this.uploadFile = file;
    this.preview = null;
  }

  saveableCount(): number {
    return this.preview ? (this.preview.createCount || 0) + (this.preview.updateCount || 0) : 0;
  }

  severity(outcome: string): any {
    return outcome === 'New' ? 'success' : outcome === 'Update' ? 'info' : outcome === 'Unmatched' ? 'danger' : 'warn';
  }

  async readFile() {
    if (!this.uploadFile) {
      this.notify.warn('Select the Excel file', 'Required');
      return;
    }
    this.reading = true;
    const response = await this.api.post('equity-prices/upload/preview', await readFileAsUpload(this.uploadFile));
    this.reading = false;
    this.preview = response.success ? response.data : null;
    if (this.preview) {
      this.previewTiles = [
        { label: 'New', value: this.preview.createCount, format: 'number', tone: 'ok' },
        { label: 'Updates', value: this.preview.updateCount, format: 'number' },
        { label: 'Unmatched', value: this.preview.unmatchedCount, format: 'number', tone: this.preview.unmatchedCount ? 'bad' : '' },
        { label: 'Skipped', value: this.preview.skipCount, format: 'number', tone: this.preview.skipCount ? 'warn' : '' },
      ];
    }
  }

  async confirmUpload() {
    if (!this.uploadFile) {
      return;
    }
    if (this.preview?.unmatchedCount && !(await this.notify.confirm(`${this.preview.unmatchedCount} row(s) match no stock and will not be saved. Save the other ${this.saveableCount()} price(s)?`))) {
      return;
    }
    this.confirming = true;
    const response = await this.api.post('equity-prices/upload', await readFileAsUpload(this.uploadFile));
    this.confirming = false;
    if (response.success) {
      this.uploadVisible = false;
      this.reload();
    }
  }
}
