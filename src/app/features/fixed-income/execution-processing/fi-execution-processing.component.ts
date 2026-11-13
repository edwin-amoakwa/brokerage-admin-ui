import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, today } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { SessionService } from '../../../core/session.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';

/**
 * Fixed-income execution processing (JSF fixed-income-execution-processing.xhtml):
 * the day's executions, "Process into Trades" (one authorised trade per order),
 * the resulting trades and the unprocessed fills per date. The JSF row "Edit"
 * called an equities bean method and failed; it now opens the order in
 * Working Transactions.
 */
@Component({
  selector: 'app-fi-execution-processing',
  imports: [FormsModule, DatePipe, DecimalPipe, RouterLink, ButtonModule, InputTextModule, TableModule, TagModule, PageHeaderComponent],
  templateUrl: './fi-execution-processing.component.html',
  styleUrl: './fi-execution-processing.component.scss',
})
export class FiExecutionProcessingComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private session = inject(SessionService);

  valueDate = today();
  executions: any[] = [];
  trades: any[] = [];
  unprocessed: any[] = [];
  loading = false;
  processing = false;

  get canManageOrders(): boolean {
    return this.session.can('fixed-income.working-orders');
  }

  ngOnInit() {
    this.load();
  }

  private apply(data: any) {
    this.executions = data?.executions || [];
    this.trades = data?.trades || [];
    this.unprocessed = data?.unprocessed || [];
  }

  async load() {
    this.loading = true;
    const response = await this.api.get('fixed-income-executions', { valueDate: this.valueDate });
    this.loading = false;
    if (response.success) {
      this.apply(response.data);
    }
  }

  async process() {
    if (!(await this.notify.confirm(`Process the fills of ${this.valueDate} into authorised trades? Authorised trades post to the client ledger.`,
      'Process into trades', 'Process'))) {
      return;
    }
    this.processing = true;
    const response = await this.api.post('fixed-income-executions/process', {}, { valueDate: this.valueDate });
    this.processing = false;
    if (response.success) {
      this.apply(response.data);
    }
  }

  openOrder(row: any) {
    this.router.navigate(['/fixed-income/working-orders'], { queryParams: { orderId: row.orderId } });
  }
}
