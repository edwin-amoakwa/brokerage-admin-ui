import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, readFileAsUpload } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';

/**
 * Bulk import of investors, beneficiaries and principal accounts from the
 * legacy Excel export (JSF accounts/investor-upload.xhtml), opened from the
 * "Upload Investors" button on the Investors page. Preview first,
 * then import. Existing investors are updated (matched on the investor id in
 * the first column) instead of the old "delete every investor first".
 */
@Component({
  selector: 'app-investor-upload',
  imports: [ButtonModule, TableModule, TagModule, PageHeaderComponent, StatTilesComponent],
  templateUrl: './investor-upload.component.html',
  styleUrl: './investor-upload.component.scss',
})
export class InvestorUploadComponent {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  /** Hides the page header when shown inside a dialog. */
  @Input() embedded = false;
  /** Fires after a successful import so the host can refresh its list. */
  @Output() imported = new EventEmitter<any>();

  upload: { fileString: string; fileName: string } | null = null;
  preview: any = null;
  result: any = null;
  previewing = false;
  importing = false;
  previewTiles: StatTile[] = [];
  resultTiles: StatTile[] = [];

  async pick(event: any) {
    const file: File | undefined = event.target?.files?.[0];
    this.preview = null;
    this.result = null;
    if (!file) {
      this.upload = null;
      return;
    }
    const { fileString, fileName } = await readFileAsUpload(file);
    this.upload = { fileString, fileName };
  }

  async runPreview() {
    if (!this.upload) {
      this.notify.warn('Choose the Excel file first');
      return;
    }
    this.previewing = true;
    this.result = null;
    const response = await this.api.post('investor-uploads/preview', this.upload);
    this.previewing = false;
    if (response.success) {
      this.preview = response.data;
      const p = this.preview;
      this.previewTiles = [
        { label: 'Rows', value: p.total, format: 'number' },
        { label: 'New investors', value: p.inserts, format: 'number', tone: 'ok' },
        { label: 'Updates', value: p.updates, format: 'number' },
        { label: 'Skipped (problems)', value: p.skipped, format: 'number', tone: p.skipped ? 'bad' : '' },
        { label: 'Beneficiaries', value: p.beneficiaries, format: 'number' },
      ];
    }
  }

  async runImport() {
    const p = this.preview;
    const ok = await this.notify.confirm(
      `Import ${p.inserts} new and update ${p.updates} existing investors${p.skipped ? ` (${p.skipped} rows with problems will be skipped)` : ''}?`,
      'Import investors', 'Import');
    if (!ok) {
      return;
    }
    this.importing = true;
    const response = await this.api.post('investor-uploads/import', this.upload);
    this.importing = false;
    if (response.success) {
      this.result = response.data;
      const r = this.result;
      this.resultTiles = [
        { label: 'Investors added', value: r.inserted, format: 'number', tone: 'ok' },
        { label: 'Investors updated', value: r.updated, format: 'number' },
        { label: 'Accounts opened', value: r.accountsOpened, format: 'number' },
        { label: 'Beneficiaries added', value: r.beneficiariesAdded, format: 'number' },
        { label: 'Beneficiaries updated', value: r.beneficiariesUpdated, format: 'number' },
        { label: 'Rows skipped', value: r.skipped?.length || 0, format: 'number', tone: r.skipped?.length ? 'bad' : '' },
      ];
      this.preview = null;
      this.imported.emit(this.result);
    }
  }

  reset() {
    this.preview = null;
    this.result = null;
  }
}
