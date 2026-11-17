import { Component, EventEmitter, Output, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, readFileAsUpload } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';

/**
 * Bulk import of CSD / depository numbers from the Incomplete Registrations
 * Excel export. Ops fills in the CSD_NUMBER column, then uploads the file
 * here. Preview first (dry-run), then import. Opened from a dialog on the
 * Incomplete Registrations page.
 */
@Component({
  selector: 'app-csd-upload',
  imports: [ButtonModule, TableModule, TagModule, StatTilesComponent],
  templateUrl: './csd-upload.component.html',
  styleUrl: './csd-upload.component.scss',
})
export class CsdUploadComponent {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

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
    const response = await this.api.post('csd-uploads/preview', this.upload);
    this.previewing = false;
    if (response.success) {
      this.preview = response.data;
      const p = this.preview;
      this.previewTiles = [
        { label: 'Rows', value: p.total, format: 'number' },
        { label: 'To update', value: p.updates, format: 'number', tone: 'ok' },
        { label: 'Unchanged', value: p.unchanged, format: 'number' },
        { label: 'Skipped', value: p.skipped, format: 'number', tone: p.skipped ? 'bad' : '' },
      ];
    }
  }

  async runImport() {
    const p = this.preview;
    const ok = await this.notify.confirm(
      `Update CSD numbers for ${p.updates} investor${p.updates !== 1 ? 's' : ''}${p.skipped ? ` (${p.skipped} rows will be skipped)` : ''}?`,
      'Import CSD numbers', 'Import');
    if (!ok) {
      return;
    }
    this.importing = true;
    const response = await this.api.post('csd-uploads/import', this.upload);
    this.importing = false;
    if (response.success) {
      this.result = response.data;
      const r = this.result;
      this.resultTiles = [
        { label: 'Investors updated', value: r.updated, format: 'number', tone: 'ok' },
        { label: 'Accounts updated', value: r.accountsUpdated, format: 'number' },
        { label: 'Unchanged', value: r.unchanged, format: 'number' },
        { label: 'Rows skipped', value: r.skipped?.length || 0, format: 'number', tone: r.skipped?.length ? 'bad' : '' },
      ];
      this.preview = null;
      this.notify.success(`Updated ${r.updated} investor${r.updated !== 1 ? 's' : ''} (${r.accountsUpdated} account${r.accountsUpdated !== 1 ? 's' : ''})`);
      this.imported.emit(this.result);
    }
  }

  reset() {
    this.preview = null;
    this.result = null;
  }

  actionSeverity(action: string): 'success' | 'info' | 'danger' {
    if (action === 'Update') return 'success';
    if (action === 'Unchanged') return 'info';
    return 'danger';
  }
}

