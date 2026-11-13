import { Routes } from '@angular/router';
import { AccountCreationComponent } from './account-creation/account-creation.component';
import { AccountsComponent } from './accounts/accounts.component';
import { AccountDashboardComponent } from './dashboard/account-dashboard.component';
import { BeneficiariesComponent } from './beneficiaries/beneficiaries.component';
import { IncompleteRegistrationsComponent } from './incomplete-registrations/incomplete-registrations.component';
import { InvestorFormComponent } from './investors/investor-form.component';
import { InvestorProfileComponent } from './investors/investor-profile.component';
import { InvestorsComponent } from './investors/investors.component';
import { PortfolioComponent } from './portfolio/portfolio.component';
import { RiskAssessmentsComponent } from './risk-assessments/risk-assessments.component';
import { UtilitiesComponent } from './utilities/utilities.component';
import { VerificationsComponent } from './verifications/verifications.component';

/** Routes for the accounts feature. Each route's data.permission is its page key (layout/menu.ts). */
export const ACCOUNTS_ROUTES: Routes = [
  { path: 'dashboard', component: AccountDashboardComponent, data: { permission: 'accounts.dashboard', title: 'Accounts Dashboard' } },
  { path: 'investors', component: InvestorsComponent, data: { permission: 'accounts.investors', title: 'Investors' } },
  { path: 'investors/new', component: InvestorFormComponent, data: { permission: 'accounts.investors', title: 'Add investor' } },
  { path: 'investors/:id/edit', component: InvestorFormComponent, data: { permission: 'accounts.investors', title: 'Edit investor' } },
  { path: 'investors/:id', component: InvestorProfileComponent, data: { permission: 'accounts.investors', title: 'Investor profile' } },
  { path: 'investor-upload', redirectTo: 'investors' },
  { path: 'incomplete-registrations', component: IncompleteRegistrationsComponent, data: { permission: 'accounts.incomplete-registrations', title: 'Incomplete Registrations' } },
  { path: 'verifications', component: VerificationsComponent, data: { permission: 'accounts.verifications', title: 'Investor Verifications' } },
  { path: 'account-creation', component: AccountCreationComponent, data: { permission: 'accounts.account-creation', title: 'Account Creation' } },
  { path: 'accounts', component: AccountsComponent, data: { permission: 'accounts.accounts', title: 'Accounts' } },
  { path: 'portfolio', component: PortfolioComponent, data: { permission: 'accounts.portfolio', title: 'Account Portfolio' } },
  { path: 'beneficiaries', component: BeneficiariesComponent, data: { permission: 'accounts.beneficiaries', title: 'Beneficiaries' } },
  { path: 'risk-assessments', component: RiskAssessmentsComponent, data: { permission: 'accounts.risk-assessments', title: 'Investor Risk Assessment' } },
  { path: 'utilities', component: UtilitiesComponent, data: { permission: 'accounts.utilities', title: 'Account Utilities' } },
];
