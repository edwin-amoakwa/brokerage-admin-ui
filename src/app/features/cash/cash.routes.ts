import { Routes } from '@angular/router';
import { CashTransactionsComponent } from './cash-transactions.component';

/** Routes for the cash feature. Each route's data.permission is its page key (layout/menu.ts). */
export const CASH_ROUTES: Routes = [
  { path: 'transactions', component: CashTransactionsComponent, data: { permission: 'cash.transactions', title: 'Cash Transactions' } },
];
