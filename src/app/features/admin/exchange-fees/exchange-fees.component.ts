import { Component } from '@angular/core';
import { CrudConfig, CrudPageComponent } from '../../../shared/crud-page/crud-page.component';

/** Exchange Fees (JSF sysadmin/exchange-fee.xhtml). */
@Component({
  selector: 'app-exchange-fees',
  imports: [CrudPageComponent],
  templateUrl: './exchange-fees.component.html',
  styleUrl: './exchange-fees.component.scss',
})
export class ExchangeFeesComponent {
  config: CrudConfig = {
    title: 'Exchange Fees',
    subtitle: 'Fees charged per exchange. These drive trade charge calculations.',
    resource: 'exchange-fees',
    noun: 'exchange fee',
    invalidates: ['exchange-fees'],
    defaults: () => ({ amount: 0, feesActive: true, brokerCommission: false, adjustable: false }),
    columns: [
      { field: 'stockExchangeName', header: 'Exchange' },
      { field: 'feeName', header: 'Fee' },
      { field: 'applicationModeName', header: 'Application Mode' },
      { field: 'amount', header: 'Amount', type: 'money' },
      { field: 'brokerCommission', header: 'Broker Commission', type: 'boolean' },
      { field: 'feesActive', header: 'Fees Active', type: 'boolean' },
      { field: 'adjustable', header: 'Adjustable', type: 'boolean' },
    ],
    fields: [
      { key: 'stockExchangeId', label: 'Stock exchange', type: 'select', list: 'stock-exchanges', required: true },
      { key: 'feeId', label: 'Fee', type: 'select', list: 'fee-types', required: true },
      { key: 'applicationMode', label: 'Application mode', type: 'select', enum: 'ApplicationMode', required: true },
      { key: 'amount', label: 'Amount', type: 'decimal', required: true },
      { key: 'brokerCommission', label: 'Broker commission', type: 'checkbox', col: 4 },
      { key: 'adjustable', label: 'Adjustable', type: 'checkbox', col: 4 },
      { key: 'feesActive', label: 'Fees active', type: 'checkbox', col: 4 },
    ],
  };
}
