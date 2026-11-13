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
 * Execution upload (JSF equities/execution_uploads.xhtml): an Excel file of
 * fills matched to orders by order number. Columns: execution date (Excel date
 * or dd/MM/yyyy), order number, quantity, price; the first row is a header.
 */
@Component({
  selector: 'app-execution-upload',
  imports: [DatePipe, DecimalPipe, RouterLink, ButtonModule, TableModule, TabsModule, PageHeaderComponent],
  templateUrl: './execution-upload.component.html',
  styleUrl: './execution-upload.component.scss',
})
export class ExecutionUploadComponent {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  upload: any = null;
  rows: any[] | null = null;
  good: any[] = [];
  failed: any[] = [];
  busy = false;
  saved = false;

  async pick(event: any) {
    const file: File | undefined = event.target?.files?.[0];
    this.upload = file ? await readFileAsUpload(file) : null;
    this.rows = null;
    this.saved = false;
  }

  private show(rows: any[]) {
    this.rows = rows;
    this.good = rows.filter((r) => !r.error);
    this.failed = rows.filter((r) => r.error);
  }

  async preview() {
    this.busy = true;
    const response = await this.api.post('execution-processing/upload/preview', this.upload);
    this.busy = false;
    if (response.success) {
      this.saved = false;
      this.show(response.data);
      if (this.failed.length) {
        this.notify.warn(`${this.failed.length} row(s) could not be matched; see the Failed tab.`);
      }
    }
  }

  async save() {
    if (!(await this.notify.confirm(`Save ${this.good.length} execution(s)? They will await processing.`, 'Save executions', 'Save'))) {
      return;
    }
    this.busy = true;
    const response = await this.api.post('execution-processing/upload', this.upload);
    this.busy = false;
    if (response.success) {
      this.saved = true;
      this.show(response.data);
    }
  }
}
