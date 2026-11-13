import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ApiService } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { InvestorKycComponent } from '../shared/investor-kyc.component';
import { InvestorTableComponent } from '../shared/investor-table.component';

/**
 * Account Creation queue: investors who have been verified but have no
 * principal trading account yet. Review, confirm the depository account
 * number, then create the account (sets Investor.accountCreated).
 */
@Component({
  selector: 'app-account-creation',
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, PageHeaderComponent, InvestorTableComponent, InvestorKycComponent],
  templateUrl: './account-creation.component.html',
  styleUrl: './account-creation.component.scss',
})
export class AccountCreationComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotifyService);
  private route = inject(ActivatedRoute);

  @ViewChild('table') table?: InvestorTableComponent;

  investor: any = null;
  depAccountNo = '';
  savingDep = false;
  creating = false;

  /** Deep link from the Accounts Dashboard work queue: ?investorId= opens that investor. */
  ngOnInit() {
    const investorId = this.route.snapshot.queryParamMap.get('investorId');
    if (investorId) {
      this.open({ id: investorId });
    }
  }

  async open(row: any) {
    const response = await this.api.get(`investors/${row.id}`);
    if (response.success) {
      this.investor = response.data;
      this.depAccountNo = this.investor.depAccountNo || '';
    }
  }

  close() {
    this.investor = null;
  }

  async saveDepository() {
    this.savingDep = true;
    const response = await this.api.put(`account-creations/${this.investor.id}/depository`, { depAccountNo: this.depAccountNo });
    this.savingDep = false;
    if (response.success) {
      this.investor = response.data;
    }
  }

  async createAccount() {
    const message = this.depAccountNo?.trim()
      ? `Open the principal trading account for ${this.investor.displayName}?`
      : `No depository account number has been entered. Open the account for ${this.investor.displayName} without it?`;
    if (!(await this.notify.confirm(message, 'Create account', 'Create account'))) {
      return;
    }
    this.creating = true;
    const response = await this.api.post(`account-creations/${this.investor.id}/create-account`, { depAccountNo: this.depAccountNo });
    this.creating = false;
    if (response.success) {
      this.investor = response.data;
    }
  }
}
