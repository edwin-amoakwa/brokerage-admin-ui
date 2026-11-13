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
 * KYC verification queue (JSF accounts/investor-verification.xhtml): review a
 * completed registration, record the depository account number and mark the
 * investor verified ("Verify for Account Creation"). The investor is sent the
 * verification-completed message and moves to the Account Creation page.
 */
@Component({
  selector: 'app-verifications',
  imports: [FormsModule, RouterLink, ButtonModule, InputTextModule, PageHeaderComponent, InvestorTableComponent, InvestorKycComponent],
  templateUrl: './verifications.component.html',
  styleUrl: './verifications.component.scss',
})
export class VerificationsComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotifyService);
  private route = inject(ActivatedRoute);

  @ViewChild('table') table?: InvestorTableComponent;

  investor: any = null;
  depAccountNo = '';
  savingDep = false;
  verifying = false;

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
    const response = await this.api.put(`investor-verifications/${this.investor.id}/depository`, { depAccountNo: this.depAccountNo });
    this.savingDep = false;
    if (response.success) {
      this.investor = response.data;
    }
  }

  async verify() {
    const message = this.depAccountNo?.trim()
      ? `Verify ${this.investor.displayName} for account creation? They will be told their verification is complete.`
      : `No depository account number has been entered. Verify ${this.investor.displayName} for account creation anyway?`;
    if (!(await this.notify.confirm(message, 'Verify for account creation', 'Verify'))) {
      return;
    }
    this.verifying = true;
    const response = await this.api.post(`investor-verifications/${this.investor.id}/verify`, { depAccountNo: this.depAccountNo });
    this.verifying = false;
    if (response.success) {
      this.investor = response.data;
    }
  }
}
