import { Component } from '@angular/core';
import { CrudConfig, CrudPageComponent } from '../../../shared/crud-page/crud-page.component';

/** Fee Types (JSF sysadmin/fee-type.xhtml). */
@Component({
  selector: 'app-fee-types',
  imports: [CrudPageComponent],
  templateUrl: './fee-types.component.html',
  styleUrl: './fee-types.component.scss',
})
export class FeeTypesComponent {
  config: CrudConfig = {
    title: 'Fee Types',
    subtitle: 'Kinds of fees that can be charged on trades',
    resource: 'fee-types',
    noun: 'fee type',
    invalidates: ['fee-types'],
    defaults: () => ({ feesActive: true, brokerCommission: false }),
    columns: [
      { field: 'feeName', header: 'Fee Name' },
      { field: 'brokerCommission', header: 'Broker Commission', type: 'boolean' },
      { field: 'feesActive', header: 'Fees Active', type: 'boolean' },
    ],
    fields: [
      { key: 'feeName', label: 'Fee name', type: 'text', required: true, col: 12 },
      { key: 'brokerCommission', label: 'Broker commission', type: 'checkbox' },
      { key: 'feesActive', label: 'Fees active', type: 'checkbox' },
    ],
  };
}
