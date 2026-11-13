import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { downloadBase64, orderSeverity } from '../equities-shared';

/**
 * Equity order batching (JSF equities/equity-order-batching.xhtml): group the
 * un-batched PENDING orders into a batch, view, export or delete batches.
 */
@Component({
  selector: 'app-order-batches',
  imports: [DatePipe, DecimalPipe, ButtonModule, TableModule, TabsModule, TagModule, PageHeaderComponent],
  templateUrl: './order-batches.component.html',
  styleUrl: './order-batches.component.scss',
})
export class OrderBatchesComponent {
  private api = inject(ApiService);
  private notify = inject(NotifyService);
  private router = inject(Router);

  tab: any = 'pending';
  pending: any[] = [];
  pendingTotal = 0;
  batches: any[] = [];
  batchTotal = 0;
  loading = false;
  busy = false;
  batch: any = null;
  batchOrders: any[] = [];
  pendingEvent: any = { first: 0, rows: 20 };
  batchEvent: any = { first: 0, rows: 20 };

  severity = orderSeverity;

  async loadPending(event: any) {
    this.pendingEvent = event;
    this.loading = true;
    const response = await this.api.get('equity-order-batches/pending-orders', pageParams(event));
    this.loading = false;
    if (response.success) {
      this.pending = response.data;
      this.pendingTotal = response.pager?.totalRecords ?? this.pending.length;
    }
  }

  async loadBatches(event: any) {
    this.batchEvent = event;
    const response = await this.api.get('equity-order-batches', pageParams(event));
    if (response.success) {
      this.batches = response.data;
      this.batchTotal = response.pager?.totalRecords ?? this.batches.length;
    }
  }

  async batchPending() {
    this.busy = true;
    const response = await this.api.post('equity-order-batches');
    this.busy = false;
    if (response.success) {
      this.loadPending(this.pendingEvent);
      this.loadBatches(this.batchEvent);
      this.view(response.data.id);
    }
  }

  async view(id: string) {
    const response = await this.api.get(`equity-order-batches/${id}`);
    if (response.success) {
      this.batch = response.data.batch;
      this.batchOrders = response.data.orders;
    }
  }

  close() {
    this.batch = null;
    this.batchOrders = [];
  }

  /** Opens the order in the order ticket (the JSF "Manage" button called a method that did not exist). */
  manage(order: any) {
    this.router.navigate(['/equities/orders'], { queryParams: { orderId: order.id } });
  }

  async removeOrder(order: any) {
    if (await this.notify.confirm(`Remove order ${order.orderNo} from this batch?`, 'Remove order', 'Remove')) {
      const response = await this.api.delete(`equity-order-batches/${this.batch.id}/orders/${order.id}`);
      if (response.success) {
        this.view(this.batch.id);
      }
    }
  }

  async exportBatch(batch: any) {
    const response = await this.api.get(`equity-order-batches/${batch.id}/export`);
    if (response.success) {
      downloadBase64(response.data);
    }
  }

  async deleteBatch(batch: any) {
    if (await this.notify.confirmDelete('this batch (its orders stay pending)')) {
      const response = await this.api.delete(`equity-order-batches/${batch.id}`);
      if (response.success) {
        this.loadBatches(this.batchEvent);
        this.loadPending(this.pendingEvent);
      }
    }
  }
}
