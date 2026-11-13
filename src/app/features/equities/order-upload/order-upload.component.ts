import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ApiService, readFileAsUpload } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';

/**
 * Stock order upload (JSF equities/stock-order-upload.xhtml): imports orders
 * from an Excel export, creating the orders, their executions and the cash
 * transactions. Preview first, then save. The JSF "Delete Trades" / "Delete
 * Orders" buttons (unconfirmed deletes of every trade, cash transaction and
 * order) are deliberately not carried over.
 */
@Component({
  selector: 'app-order-upload',
  imports: [DatePipe, DecimalPipe, ButtonModule, TableModule, PageHeaderComponent],
  templateUrl: './order-upload.component.html',
  styleUrl: './order-upload.component.scss',
})
export class OrderUploadComponent {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  upload: any = null;
  rows: any[] = [];
  importable = 0;
  errors = 0;
  busy = false;
  saved = false;

  async pick(event: any) {
    const file: File | undefined = event.target?.files?.[0];
    this.upload = file ? await readFileAsUpload(file) : null;
    this.show([]);
    this.saved = false;
  }

  private show(rows: any[]) {
    this.rows = rows;
    this.importable = rows.filter((r) => !r.error && r.orderNo).length;
    this.errors = rows.filter((r) => r.error).length;
  }

  async preview() {
    this.busy = true;
    const response = await this.api.post('equity-order-upload/preview', this.upload);
    this.busy = false;
    if (response.success) {
      this.saved = false;
      this.show(response.data);
    }
  }

  async save() {
    const message = `Import ${this.importable} order(s)? Trades also create their executions and paid cash transactions.`
      + (this.errors ? ` ${this.errors} row(s) with problems will be skipped.` : '');
    if (!(await this.notify.confirm(message, 'Save upload', 'Save'))) {
      return;
    }
    this.busy = true;
    const response = await this.api.post('equity-order-upload', this.upload);
    this.busy = false;
    if (response.success) {
      this.saved = true;
      this.show(response.data);
    }
  }
}
