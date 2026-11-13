import { Component, ViewChild, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, readFileAsUpload } from '../../../core/api.service';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { CrudConfig, CrudPageComponent } from '../../../shared/crud-page/crud-page.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';

/**
 * Countries and currencies (JSF sysadmin/country.xhtml), with the Excel
 * upload. The upload now updates countries whose code already exists and adds
 * the rest; it never deletes, and reports what it did per row.
 */
@Component({
  selector: 'app-countries',
  imports: [ButtonModule, TableModule, TagModule, CrudPageComponent, StatTilesComponent],
  templateUrl: './countries.component.html',
  styleUrl: './countries.component.scss',
})
export class CountriesComponent {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);

  @ViewChild(CrudPageComponent) crud!: CrudPageComponent;

  file: File | null = null;
  uploading = false;
  report: any = null;
  tiles: StatTile[] = [];
  problemRows: any[] = [];

  config: CrudConfig = {
    title: 'Countries',
    subtitle: 'Countries and their currencies',
    resource: 'countries',
    noun: 'country',
    invalidates: ['countries'],
    columns: [
      { field: 'countryCode', header: 'Country Code' },
      { field: 'countryName', header: 'Country' },
      { field: 'phoneCode', header: 'Phone Code' },
      { field: 'currency', header: 'Currency' },
      { field: 'currencyCode', header: 'Currency Code' },
    ],
    fields: [
      { key: 'countryCode', label: 'Country code', type: 'text' },
      { key: 'countryName', label: 'Country name', type: 'text', required: true },
      { key: 'phoneCode', label: 'Phone code', type: 'text' },
      { key: 'currency', label: 'Currency', type: 'text' },
      { key: 'currencyCode', label: 'Currency code', type: 'text' },
    ],
  };

  async upload(input: HTMLInputElement) {
    if (!this.file) {
      this.notify.warn('Select an Excel file first', 'Required');
      return;
    }
    this.uploading = true;
    const payload = await readFileAsUpload(this.file);
    const response = await this.api.post('countries/upload', payload);
    this.uploading = false;
    if (!response.success) {
      return;
    }
    this.report = response.data;
    this.tiles = [
      { label: 'Rows read', value: this.report.rowsRead, format: 'number' },
      { label: 'Added', value: this.report.createCount, format: 'number', tone: 'ok' },
      { label: 'Updated', value: this.report.updateCount, format: 'number' },
      { label: 'Skipped', value: this.report.skipCount, format: 'number', tone: this.report.skipCount ? 'warn' : '' },
    ];
    this.problemRows = (this.report.rows || []).filter((r: any) => r.outcome === 'Skipped');
    this.file = null;
    input.value = '';
    this.lookups.invalidate('countries');
    this.crud?.reload();
  }
}
