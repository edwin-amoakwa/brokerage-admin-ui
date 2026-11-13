import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, today } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';

/**
 * Fixed-income market prices fetched from the Stately market-data service for
 * a date (JSF sysadmin/fixed-income-prices.xhtml): fetch, preview, save.
 * Saving is an upsert keyed on market date + ISIN, so saving again updates
 * rows instead of duplicating them.
 */
@Component({
  selector: 'app-fixed-income-prices',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputTextModule, TableModule, TagModule, PageHeaderComponent],
  templateUrl: './fixed-income-prices.component.html',
  styleUrl: './fixed-income-prices.component.scss',
})
export class FixedIncomePricesComponent {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  marketDate = today();
  prices: any[] = [];
  fetched = false;
  fetching = false;
  saving = false;

  get matchedCount(): number {
    return this.prices.filter((p) => p.fixedIncomeId).length;
  }

  get existingCount(): number {
    return this.prices.filter((p) => p.existing).length;
  }

  async fetch() {
    if (!this.marketDate) {
      this.notify.warn('Please select a market date');
      return;
    }
    this.fetching = true;
    const response = await this.api.get('fixed-income-prices/fetch', { marketDate: this.marketDate });
    this.fetching = false;
    this.fetched = response.success;
    this.prices = response.success ? response.data || [] : [];
  }

  async save() {
    if (!(await this.notify.confirm(`Save all ${this.prices.length} fetched price(s)?`, 'Save prices', 'Save'))) {
      return;
    }
    this.saving = true;
    const response = await this.api.post('fixed-income-prices', { marketDate: this.marketDate, prices: this.prices });
    this.saving = false;
    if (response.success) {
      this.prices = [];
      this.fetched = false;
    }
  }
}
