import { Routes } from '@angular/router';
import { FiExecutionProcessingComponent } from './execution-processing/fi-execution-processing.component';
import { FiExecutionUploadComponent } from './execution-processing/fi-execution-upload.component';
import { FiOrderBatchesComponent } from './order-batches/fi-order-batches.component';
import { FiOrdersComponent } from './orders/fi-orders.component';
import { FiRedemptionsComponent } from './redemptions/fi-redemptions.component';
import { FiSimpleTransactionsComponent } from './simple-transactions/fi-simple-transactions.component';
import { FiTradesComponent } from './trades/fi-trades.component';
import { FiWorkingOrdersComponent } from './working-orders/fi-working-orders.component';

/**
 * Routes for the fixed-income feature. Each route's data.permission is its page key (layout/menu.ts).
 * The three System Admin screens (security issuers, securities, prices) live in ./admin and are
 * wired from admin.routes.ts.
 */
export const FIXED_INCOME_ROUTES: Routes = [
  { path: 'orders', component: FiOrdersComponent, data: { permission: 'fixed-income.orders', title: 'Orders' } },
  { path: 'working-orders', component: FiWorkingOrdersComponent, data: { permission: 'fixed-income.working-orders', title: 'Working Transactions' } },
  { path: 'order-batches', component: FiOrderBatchesComponent, data: { permission: 'fixed-income.order-batches', title: 'Order Batching' } },
  { path: 'execution-processing', component: FiExecutionProcessingComponent, data: { permission: 'fixed-income.execution-processing', title: 'Execution Processing' } },
  { path: 'execution-processing/upload', component: FiExecutionUploadComponent, data: { permission: 'fixed-income.execution-processing', title: 'Upload Executions' } },
  { path: 'trades', component: FiTradesComponent, data: { permission: 'fixed-income.trades', title: 'Trade' } },
  { path: 'simple-transactions', component: FiSimpleTransactionsComponent, data: { permission: 'fixed-income.simple-transactions', title: 'Simple Transaction' } },
  { path: 'redemptions', component: FiRedemptionsComponent, data: { permission: 'fixed-income.redemptions', title: 'Fixed Income Redemption' } },
];
