import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, today } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { EntityPickerComponent } from '../../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';

/**
 * Early (unscheduled) redemption of fixed-income holdings (JSF
 * fixed-income/fixed-income-redemption.xhtml). Pick an account, then a
 * holding, enter the date and principal, calculate the interest and save. As
 * in the JSF page the principal and interest rows are authorised on save; the
 * screen says so and the server records who authorised them.
 */
@Component({
  selector: 'app-fi-redemptions',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputNumberModule, InputTextModule, MessageModule, TableModule, TagModule,
    EntityPickerComponent, PageHeaderComponent],
  templateUrl: './fi-redemptions.component.html',
  styleUrl: './fi-redemptions.component.scss',
})
export class FiRedemptionsComponent {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  account: any = null;
  fromDate: string | null = null;
  toDate: string | null = null;
  holdings: any[] = [];
  holding: any = null;
  redemptions: any[] = [];
  redemptionDate = today();
  amount: number | null = null;
  interest: any = null;
  saving = false;

  selectAccount(account: any) {
    this.account = account;
    this.holding = null;
    this.holdings = [];
    if (account) {
      this.loadHoldings();
    }
  }

  async loadHoldings() {
    const response = await this.api.get('fixed-income-redemptions/holdings', {
      accountId: this.account.id, fromDate: this.fromDate, toDate: this.toDate, paginated: false,
    });
    this.holdings = response.success ? response.data : [];
  }

  async redeem(row: any) {
    this.holding = row;
    this.redemptionDate = today();
    this.amount = null;
    this.interest = null;
    await this.loadRedemptions();
  }

  private async refreshHolding() {
    const response = await this.api.get(`fixed-income-redemptions/holdings/${this.holding.id}`);
    if (response.success && response.data) {
      this.holding = response.data;
    }
  }

  async loadRedemptions() {
    const response = await this.api.get(`fixed-income-redemptions/holdings/${this.holding.id}/redemptions`);
    this.redemptions = response.success ? response.data : [];
  }

  closeHolding() {
    this.holding = null;
    this.loadHoldings();
  }

  private request() {
    return { transactionId: this.holding.id, redemptionDate: this.redemptionDate, amount: this.amount || 0 };
  }

  async calculate() {
    if (!this.amount || this.amount <= 0) {
      this.notify.warn('Input Valid Amount');
      return;
    }
    const response = await this.api.post('fixed-income-redemptions/interest', this.request());
    this.interest = response.success ? response.data : null;
  }

  async save() {
    if (!(await this.notify.confirm('Save this redemption? The principal and interest rows are authorised immediately.', 'Save redemption', 'Save'))) {
      return;
    }
    this.saving = true;
    const response = await this.api.post('fixed-income-redemptions', this.request());
    this.saving = false;
    if (response.success) {
      this.amount = null;
      this.interest = null;
      await this.refreshHolding();
      await this.loadRedemptions();
    }
  }

  async removeBatch(row: any) {
    if (await this.notify.confirmDelete('this redemption (its principal and interest rows)')) {
      const response = await this.api.delete(`fixed-income-redemptions/holdings/${this.holding.id}/batches/${row.batch}`);
      if (response.success) {
        await this.refreshHolding();
        await this.loadRedemptions();
      }
    }
  }
}
