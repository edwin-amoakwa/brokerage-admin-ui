import { Component } from '@angular/core';
import { CrudConfig, CrudPageComponent } from '../../../shared/crud-page/crud-page.component';

/**
 * Banks (JSF sysadmin/bank.xhtml).
 * REFERENCE PATTERN for a simple reference-data screen: a CrudConfig only.
 */
@Component({
  selector: 'app-banks',
  imports: [CrudPageComponent],
  templateUrl: './banks.component.html',
  styleUrl: './banks.component.scss',
})
export class BanksComponent {
  config: CrudConfig = {
    title: 'Banks',
    subtitle: 'Banks available for investor and firm bank accounts',
    resource: 'banks',
    noun: 'bank',
    invalidates: ['banks'],
    defaults: () => ({ bankActive: true, viewOrder: 0 }),
    columns: [
      { field: 'bankName', header: 'Bank Name' },
      { field: 'sortCode', header: 'Sort Code' },
      { field: 'swiftCode', header: 'SWIFT Code' },
      { field: 'countryName', header: 'Country' },
      { field: 'bankActive', header: 'Active', type: 'boolean' },
      { field: 'viewOrder', header: 'View Order', type: 'number' },
    ],
    fields: [
      { key: 'bankName', label: 'Name', type: 'text', required: true, col: 12 },
      { key: 'sortCode', label: 'Sort code', type: 'text' },
      { key: 'swiftCode', label: 'SWIFT code', type: 'text' },
      { key: 'countryId', label: 'Country', type: 'select', list: 'countries' },
      { key: 'viewOrder', label: 'View order', type: 'number' },
      { key: 'bankActive', label: 'Active', type: 'checkbox' },
      { key: 'mobileMoney', label: 'Mobile money', type: 'checkbox' },
    ],
  };
}
