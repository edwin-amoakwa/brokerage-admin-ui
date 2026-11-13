import { Routes } from '@angular/router';
import { CaseDeskComponent } from './cases/case-desk.component';
import { CasesComponent } from './cases/cases.component';
import { InteractionsComponent } from './interactions/interactions.component';

/** Routes for the support feature. Each route's data.permission is its page key (layout/menu.ts). */
export const SUPPORT_ROUTES: Routes = [
  { path: 'cases', component: CasesComponent, data: { permission: 'support.cases', title: 'Cases' } },
  { path: 'cases/:id', component: CaseDeskComponent, data: { permission: 'support.cases', title: 'Case' } },
  { path: 'interactions', component: InteractionsComponent, data: { permission: 'support.interactions', title: 'Contact Log' } },
];
