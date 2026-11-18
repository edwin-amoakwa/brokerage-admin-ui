import { Routes } from '@angular/router';
import { CorporateActionProcessingComponent } from './corporate-actions/corporate-action-processing.component';
import { CorporateActionsComponent } from './corporate-actions/corporate-actions.component';
import { ExecutionProcessingComponent } from './execution-processing/execution-processing.component';
import { ExecutionUploadComponent } from './execution-processing/execution-upload.component';
import { ExecutionsComponent } from './executions/executions.component';
import { OrderBatchesComponent } from './order-batches/order-batches.component';
import { OrderUploadComponent } from './order-upload/order-upload.component';
import { ExchangeLinkComponent } from './exchange-link/exchange-link.component';
import { EquityOrdersComponent } from './orders/orders.component';
import { TradesComponent } from './trades/trades.component';
import { WorkingOrdersComponent } from './working-orders/working-orders.component';

/** Routes for the equities feature. Each route's data.permission is its page key (layout/menu.ts). */
export const EQUITIES_ROUTES: Routes = [
  { path: 'orders', component: EquityOrdersComponent, data: { permission: 'equities.orders', title: 'Orders' } },
  { path: 'order-upload', component: OrderUploadComponent, data: { permission: 'equities.order-upload', title: 'Upload Stock Orders' } },
  { path: 'working-orders', component: WorkingOrdersComponent, data: { permission: 'equities.working-orders', title: 'Working Orders' } },
  { path: 'order-batches', component: OrderBatchesComponent, data: { permission: 'equities.order-batches', title: 'Order Batching' } },
  { path: 'execution-processing', component: ExecutionProcessingComponent, data: { permission: 'equities.execution-processing', title: 'Execution Processing' } },
  { path: 'execution-processing/upload', component: ExecutionUploadComponent, data: { permission: 'equities.execution-processing', title: 'Execution Uploads' } },
  { path: 'trades', component: TradesComponent, data: { permission: 'equities.trades', title: 'Trade Records' } },
  { path: 'executions', component: ExecutionsComponent, data: { permission: 'equities.executions', title: 'Equity Transactions' } },
  { path: 'dividends', component: CorporateActionsComponent, data: { permission: 'equities.dividends', title: 'Dividends', kind: 'dividend' } },
  { path: 'dividend-processing', component: CorporateActionProcessingComponent, data: { permission: 'equities.dividend-processing', title: 'Dividend Processing', kind: 'dividend' } },
  { path: 'bonus-issues', component: CorporateActionsComponent, data: { permission: 'equities.bonus-issues', title: 'Bonus Shares', kind: 'bonus' } },
  { path: 'bonus-processing', component: CorporateActionProcessingComponent, data: { permission: 'equities.bonus-processing', title: 'Bonus Processing', kind: 'bonus' } },
  { path: 'exchange-link', component: ExchangeLinkComponent, data: { permission: ['equities.exchange-link', 'admin.exchange-link-settings'], title: 'Exchange Link' } },
];
