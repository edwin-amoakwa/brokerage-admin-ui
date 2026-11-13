import { Component } from '@angular/core';
import { CrudConfig, CrudPageComponent } from '../../../shared/crud-page/crud-page.component';

/** Stock Exchanges (JSF sysadmin/stock-exchange.xhtml). */
@Component({
  selector: 'app-stock-exchanges',
  imports: [CrudPageComponent],
  templateUrl: './stock-exchanges.component.html',
  styleUrl: './stock-exchanges.component.scss',
})
export class StockExchangesComponent {
  config: CrudConfig = {
    title: 'Stock Exchanges',
    subtitle: 'Exchanges and their settlement period (T+n days)',
    resource: 'stock-exchanges',
    noun: 'stock exchange',
    invalidates: ['stock-exchanges'],
    defaults: () => ({ settlementPeriod: 0 }),
    columns: [
      { field: 'exchangeCode', header: 'Exchange Code' },
      { field: 'exchangeName', header: 'Exchange Name' },
      { field: 'settlementPeriod', header: 'Settlement Period', type: 'number' },
    ],
    fields: [
      { key: 'exchangeCode', label: 'Exchange code', type: 'text' },
      { key: 'exchangeName', label: 'Exchange name', type: 'text', required: true },
      { key: 'settlementPeriod', label: 'Settlement period (days)', type: 'number', hint: 'Used to compute trade settlement dates (T+n).' },
    ],
  };
}
