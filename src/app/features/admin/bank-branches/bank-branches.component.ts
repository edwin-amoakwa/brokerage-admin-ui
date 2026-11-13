import { Component } from '@angular/core';
import { CrudConfig, CrudPageComponent } from '../../../shared/crud-page/crud-page.component';

/** Bank Branches (JSF sysadmin/bank-branches.xhtml). */
@Component({
  selector: 'app-bank-branches',
  imports: [CrudPageComponent],
  templateUrl: './bank-branches.component.html',
  styleUrl: './bank-branches.component.scss',
})
export class BankBranchesComponent {
  config: CrudConfig = {
    title: 'Bank Branches',
    subtitle: 'Branches of the banks investors and wallets bank with',
    resource: 'bank-branches',
    noun: 'bank branch',
    invalidates: ['bank-branches'],
    defaults: () => ({ branchActive: true }),
    columns: [
      { field: 'bankName', header: 'Bank' },
      { field: 'branchName', header: 'Branch Name' },
      { field: 'sortCode', header: 'Sort Code' },
      { field: 'swiftCode', header: 'SWIFT Code' },
      { field: 'branchActive', header: 'Active', type: 'boolean' },
    ],
    fields: [
      { key: 'bankId', label: 'Bank', type: 'select', list: 'banks-all', required: true, col: 12 },
      { key: 'branchName', label: 'Branch name', type: 'text', required: true, col: 12 },
      { key: 'sortCode', label: 'Sort code', type: 'text' },
      { key: 'swiftCode', label: 'SWIFT code', type: 'text' },
      { key: 'branchActive', label: 'Active', type: 'checkbox' },
    ],
  };
}
