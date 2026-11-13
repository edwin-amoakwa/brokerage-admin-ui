import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { orderStatusSeverity } from '../fixed-income-options.service';

/**
 * Fixed-income order batches (JSF fixed-income/fixed-income-order-batching.xhtml).
 * Batch the un-batched pending orders, view / manage a batch (remove orders,
 * totals recalculated), delete it, and export its orders as CSV (the JSF
 * "export" built the rows and then did nothing).
 */
@Component({
  selector: 'app-fi-order-batches',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, TableModule, TabsModule, TagModule, PageHeaderComponent],
  templateUrl: './fi-order-batches.component.html',
  styleUrl: './fi-order-batches.component.scss',
})
export class FiOrderBatchesComponent {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  tab = 'pending';
  pending: any[] = [];
  pendingTotal = 0;
  loadingPending = false;
  pendingEvent: any = { first: 0, rows: 20 };
  batches: any[] = [];
  batchTotal = 0;
  loadingBatches = false;
  batchEvent: any = { first: 0, rows: 20 };
  batching = false;
  batch: any = null;
  severity = orderStatusSeverity;

  async loadPending(event: any) {
    this.pendingEvent = event;
    this.loadingPending = true;
    const response = await this.api.get('fixed-income-order-batches/pending-orders', pageParams(event));
    this.loadingPending = false;
    if (response.success) {
      this.pending = response.data;
      this.pendingTotal = response.pager?.totalRecords ?? this.pending.length;
    }
  }

  async loadBatches(event: any) {
    this.batchEvent = event;
    this.loadingBatches = true;
    const response = await this.api.get('fixed-income-order-batches', pageParams(event));
    this.loadingBatches = false;
    if (response.success) {
      this.batches = response.data;
      this.batchTotal = response.pager?.totalRecords ?? this.batches.length;
    }
  }

  async batchPending() {
    if (!(await this.notify.confirm('Put every un-batched pending order into a new batch?', 'Batch pending orders', 'Batch'))) {
      return;
    }
    this.batching = true;
    const response = await this.api.post('fixed-income-order-batches');
    this.batching = false;
    if (response.success) {
      this.batch = response.data;
    }
  }

  async view(id: string) {
    const response = await this.api.get(`fixed-income-order-batches/${id}`);
    if (response.success) {
      this.batch = response.data;
    }
  }

  async removeOrder(row: any) {
    if (await this.notify.confirm(`Remove order ${row.orderNo} from this batch?`, 'Remove order', 'Remove')) {
      const response = await this.api.delete(`fixed-income-order-batches/${this.batch.id}/orders/${row.id}`);
      if (response.success) {
        this.batch = response.data;
      }
    }
  }

  async deleteBatch(row: any) {
    if (await this.notify.confirmDelete('this batch (its orders go back to un-batched)')) {
      const response = await this.api.delete(`fixed-income-order-batches/${row.id}`);
      if (response.success) {
        this.batch = null;
        this.tab = 'batches';
      }
    }
  }

  async exportBatch(id: string) {
    const response = await this.api.get(`fixed-income-order-batches/${id}`);
    if (response.success) {
      this.exportCsv(response.data);
    }
  }

  /** generateExportData: account, order date, order no, amount, estimated cost and comms per order. */
  exportCsv(batch: any) {
    const header = ['Order No', 'Order Date', 'Account', 'Buy/Sell', 'Asset Sub Class', 'Security', 'Amount', 'Estimated Comms'];
    const cell = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const o of batch.orders || []) {
      lines.push([o.orderNo, o.valueDate, o.accountName, o.buySellName, o.subClassName, o.fixedIncomeName, o.amount, o.estimatedComms].map(cell).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fixed-income-batch-${batch.batchDate || batch.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
