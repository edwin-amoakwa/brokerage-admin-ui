import { Routes } from '@angular/router';
import { ReportsComponent } from './reports.component';

/** Routes for the reports feature. Each route's data.permission is its page key (layout/menu.ts). */
export const REPORTS_ROUTES: Routes = [
  { path: '', component: ReportsComponent, data: { permission: 'reports', title: 'Reports' } },
];
