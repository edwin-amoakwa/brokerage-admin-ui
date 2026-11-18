import { Routes } from '@angular/router';
import { LiveQuotesComponent } from './live-quotes/live-quotes.component';

export const TRADING_ROUTES: Routes = [
  { path: 'live-quotes', component: LiveQuotesComponent, data: { permission: 'trading.live-quotes', title: 'Live Quotes' } },
];
