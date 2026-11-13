import { Routes } from '@angular/router';
import { AccountTransactionsComponent } from './account-transactions.component';
import { CashTransactionHistoryComponent } from './cash-transaction-history.component';
import { FixedIncomeHistoryComponent } from './fixed-income-history.component';

/** Routes for the history feature. Each route's data.permission is its page key (layout/menu.ts). */
export const HISTORY_ROUTES: Routes = [
  { path: 'account-transactions', component: AccountTransactionsComponent, data: { permission: 'history.account-transactions', title: 'Account Transactions' } },
  { path: 'fixed-income-transactions', component: FixedIncomeHistoryComponent, data: { permission: 'history.fixed-income-transactions', title: 'Fixed Income Transaction History' } },
  { path: 'cash-transactions', component: CashTransactionHistoryComponent, data: { permission: 'history.cash-transactions', title: 'Cash Transaction History' } },
];
