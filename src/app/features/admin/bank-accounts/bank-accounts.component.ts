import { Component } from '@angular/core';
import { CrudConfig, CrudPageComponent } from '../../../shared/crud-page/crud-page.component';

/** Bank Accounts (JSF sysadmin/bank-account.xhtml). */
@Component({
  selector: 'app-bank-accounts',
  imports: [CrudPageComponent],
  templateUrl: './bank-accounts.component.html',
  styleUrl: './bank-accounts.component.scss',
})
export class BankAccountsComponent {
  config: CrudConfig = {
    title: 'Bank Accounts',
    subtitle: "The firm's bank accounts used for client money and settlement",
    resource: 'bank-accounts',
    noun: 'bank account',
    invalidates: ['bank-accounts'],
    defaults: () => ({ activeStatus: true }),
    columns: [
      { field: 'bankName', header: 'Bank Name' },
      { field: 'accountName', header: 'Account Name' },
      { field: 'activeStatus', header: 'Active', type: 'boolean' },
    ],
    fields: [
      { key: 'bankName', label: 'Bank name', type: 'text', required: true },
      { key: 'accountName', label: 'Account name', type: 'text', required: true },
      { key: 'activeStatus', label: 'Active', type: 'checkbox' },
    ],
  };
}
