import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { ApiService, readFileAsUpload } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';

/**
 * Excel upload of fixed-income executions keyed by order number (JSF
 * fixed-income-execution_uploads.xhtml): preview matched / unmatched rows,
 * then save the matched ones. Unlike the JSF page the file's amount and price
 * are kept, bad files are reported, and a saved preview cannot be re-saved.
 */
@Component({
  selector: 'app-fi-execution-upload',
  imports: [DatePipe, DecimalPipe, RouterLink, ButtonModule, TableModule, TabsModule, PageHeaderComponent],
  templateUrl: './fi-execution-upload.component.html',
  styleUrl: './fi-execution-upload.component.scss',
})
export class FiExecutionUploadComponent {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  file: File | null = null;
  preview: any = null;
  tab = 'matched';
  uploading = false;
  saving = false;
  saved = false;

  pick(event: any) {
    this.file = event.target?.files?.[0] ?? null;
  }

  async upload() {
    if (!this.file) {
      this.notify.warn('Please select a file');
      return;
    }
    this.uploading = true;
    const upload = await readFileAsUpload(this.file);
    const response = await this.api.post('fixed-income-executions/upload/preview', { fileString: upload.fileString, fileName: upload.fileName });
    this.uploading = false;
    if (response.success) {
      this.preview = response.data;
      this.saved = false;
      this.tab = this.preview.matched.length ? 'matched' : 'unmatched';
    }
  }

  async save() {
    this.saving = true;
    const response = await this.api.post('fixed-income-executions/upload/confirm', { rows: this.preview.matched });
    this.saving = false;
    if (response.success) {
      this.saved = true;
    }
  }
}
