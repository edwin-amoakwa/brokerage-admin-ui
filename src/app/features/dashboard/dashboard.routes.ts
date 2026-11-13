import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';

/** Routes for the dashboard feature. Each route's data.permission is its page key (layout/menu.ts). */
export const DASHBOARD_ROUTES: Routes = [
  { path: '', component: DashboardComponent, data: { permission: 'dashboard', title: 'Dashboard' } },
];
