import { formatDate } from '@angular/common';
import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ApiService } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { ExcelService } from '../../../services/excel.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { CsdUploadComponent } from '../csd-upload/csd-upload.component';
import { InvestorKycComponent } from '../shared/investor-kyc.component';
import { InvestorTableComponent } from '../shared/investor-table.component';

/**
 * Columns written to the export, in order. An allow-list: only these fields
 * leave the app, so ids, UI-only fields and anything the backend adds later
 * stay out of the file. CSD_NUMBER is blank for the user to fill in and
 * re-import through "Upload CSD New Account File".
 */
const EXPORT_COLUMNS: { header: string; value: (r: any) => any }[] = [
  { header: 'INVESTOR_CODE', value: (r) => r.investorCode },
  { header: 'DISPLAY_NAME', value: (r) => r.displayName || r.corporateName || `${r.surname ?? ''} ${r.firstName ?? ''}`.trim() },
  { header: 'EMAIL_ADDRESS', value: (r) => r.emailAddress },
  { header: 'MOBILE_PHONE', value: (r) => r.mobilePhone },
  { header: 'REGISTRATION_DATE', value: (r) => (r.registrationDate ? formatDate(r.registrationDate, 'dd/MM/yyyy', 'en-US') : '') },
  { header: 'CSD_NUMBER', value: () => '' },
];

/**
 * Account Creation queue: investors who have been verified but have no
 * principal trading account yet. Review, confirm the depository account
 * number, then create the account (sets Investor.accountCreated).
 * Export writes every matching investor (honouring the search) to Excel;
 * Upload CSD New Account File reads that file back with CSD_NUMBER filled in.
 */
@Component({
  selector: 'app-account-creation',
  imports: [FormsModule, RouterLink, ButtonModule, DialogModule, InputTextModule, PageHeaderComponent, InvestorTableComponent, InvestorKycComponent, CsdUploadComponent],
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
  exporting = false;
  showCsdUpload = false;

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

  onImported() {
    this.showCsdUpload = false;
    this.table?.refresh();
  }

  async export() {
    if (!this.table || this.exporting) {
      return;
    }
    this.exporting = true;
    try {
      const rows = await this.table.fetchAll();
      if (rows === null) {
        this.notify.error('Could not load investors for export.');
        return;
      }
      if (rows.length === 0) {
        this.notify.info('There are no investors awaiting account creation to export.');
        return;
      }
      const headers = EXPORT_COLUMNS.map((c) => c.header);
      const data = rows.map((r) => EXPORT_COLUMNS.map((c) => c.value(r) ?? ''));
      ExcelService.exportRowsAsExcelFile(headers, data, 'account-creation');
      this.notify.success(`Exported ${rows.length} investor${rows.length === 1 ? '' : 's'}.`);
    } finally {
      this.exporting = false;
    }
  }
}
