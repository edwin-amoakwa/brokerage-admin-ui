import { Routes } from '@angular/router';
import { authGuard, landingRedirect } from './core/auth.guard';
import { LoginComponent } from './auth/login/login.component';
import { ChangePasswordComponent } from './auth/change-password/change-password.component';
import { ForbiddenComponent } from './auth/forbidden/forbidden.component';
import { NotFoundComponent } from './auth/not-found/not-found.component';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'Sign in' },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', canActivate: [landingRedirect], children: [] },
      { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES) },
      { path: 'accounts', loadChildren: () => import('./features/accounts/accounts.routes').then((m) => m.ACCOUNTS_ROUTES) },
      { path: 'equities', loadChildren: () => import('./features/equities/equities.routes').then((m) => m.EQUITIES_ROUTES) },
      { path: 'trading', loadChildren: () => import('./features/trading/trading.routes').then((m) => m.TRADING_ROUTES) },
      { path: 'fixed-income', loadChildren: () => import('./features/fixed-income/fixed-income.routes').then((m) => m.FIXED_INCOME_ROUTES) },
      { path: 'cash', loadChildren: () => import('./features/cash/cash.routes').then((m) => m.CASH_ROUTES) },
      { path: 'history', loadChildren: () => import('./features/history/history.routes').then((m) => m.HISTORY_ROUTES) },
      { path: 'support', loadChildren: () => import('./features/support/support.routes').then((m) => m.SUPPORT_ROUTES) },
      { path: 'reports', loadChildren: () => import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES) },
      { path: 'admin', loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES) },
      { path: 'profile/change-password', component: ChangePasswordComponent, title: 'Change password' },
      { path: 'forbidden', component: ForbiddenComponent },
      { path: '**', component: NotFoundComponent },
    ],
  },
];
