import { Routes } from '@angular/router';
import { BanksComponent } from './banks/banks.component';
import { RiskLevelsComponent } from './risk-levels/risk-levels.component';
import { CountriesComponent } from './countries/countries.component';
import { RegistrarsComponent } from './registrars/registrars.component';
import { IndustriesComponent } from './industries/industries.component';
import { StockExchangesComponent } from './stock-exchanges/stock-exchanges.component';
import { StocksComponent } from './stocks/stocks.component';
import { EquityPricesComponent } from './equity-prices/equity-prices.component';
import { FeeTypesComponent } from './fee-types/fee-types.component';
import { ExchangeFeesComponent } from './exchange-fees/exchange-fees.component';
import { BankAccountsComponent } from './bank-accounts/bank-accounts.component';
import { RiskQuestionsComponent } from './risk-questions/risk-questions.component';
import { NotificationsComponent } from './notifications/notifications.component';
import { RolesComponent } from './roles/roles.component';
import { UsersComponent } from './users/users.component';
import { CaseCategoriesComponent } from '../support/admin/case-categories.component';
import { CaseTeamsComponent } from '../support/admin/case-teams.component';
import { SecurityIssuersComponent } from '../fixed-income/admin/security-issuers.component';
import { FixedIncomeSecuritiesComponent } from '../fixed-income/admin/fixed-income-securities.component';
import { FixedIncomePricesComponent } from '../fixed-income/admin/fixed-income-prices.component';

/** Routes for the admin feature. Each route's data.permission is its page key (layout/menu.ts). */
export const ADMIN_ROUTES: Routes = [
  { path: 'users', component: UsersComponent, data: { permission: 'admin.users', title: 'User Accounts' } },
  { path: 'roles', component: RolesComponent, data: { permission: 'admin.roles', title: 'Roles' } },
  { path: 'risk-levels', component: RiskLevelsComponent, data: { permission: 'admin.risk-levels', title: 'Risk Levels' } },
  { path: 'countries', component: CountriesComponent, data: { permission: 'admin.countries', title: 'Countries' } },
  { path: 'registrars', component: RegistrarsComponent, data: { permission: 'admin.registrars', title: 'Registrars' } },
  { path: 'industries', component: IndustriesComponent, data: { permission: 'admin.industries', title: 'Industries' } },
  { path: 'case-categories', component: CaseCategoriesComponent, data: { permission: 'admin.case-categories', title: 'Case Categories' } },
  { path: 'case-teams', component: CaseTeamsComponent, data: { permission: 'admin.case-teams', title: 'Case Teams' } },
  { path: 'stock-exchanges', component: StockExchangesComponent, data: { permission: 'admin.stock-exchanges', title: 'Stock Exchanges' } },
  { path: 'stocks', component: StocksComponent, data: { permission: 'admin.stocks', title: 'Stocks' } },
  { path: 'equity-prices', component: EquityPricesComponent, data: { permission: 'admin.equity-prices', title: 'Equity Market Prices' } },
  { path: 'fee-types', component: FeeTypesComponent, data: { permission: 'admin.fee-types', title: 'Fee Types' } },
  { path: 'exchange-fees', component: ExchangeFeesComponent, data: { permission: 'admin.exchange-fees', title: 'Exchange Fees' } },
  { path: 'security-issuers', component: SecurityIssuersComponent, data: { permission: 'admin.security-issuers', title: 'Security Issuers' } },
  { path: 'fixed-income-securities', component: FixedIncomeSecuritiesComponent, data: { permission: 'admin.fixed-income-securities', title: 'Fixed Income Securities' } },
  { path: 'fixed-income-prices', component: FixedIncomePricesComponent, data: { permission: 'admin.fixed-income-prices', title: 'Fixed Income Market Prices' } },
  { path: 'bank-accounts', component: BankAccountsComponent, data: { permission: 'admin.bank-accounts', title: 'Bank Accounts' } },
  { path: 'banks', component: BanksComponent, data: { permission: ['admin.banks', 'admin.bank-branches'], title: 'Banks' } },
  { path: 'bank-branches', redirectTo: 'banks?tab=branches' },
  { path: 'risk-questions', component: RiskQuestionsComponent, data: { permission: 'admin.risk-questions', title: 'Risk Assessment Questions' } },
  { path: 'notifications', component: NotificationsComponent, data: { permission: 'admin.notifications', title: 'Notifications' } },
  // Messaging Templates was merged into Notifications; old links land there.
  { path: 'messaging-templates', redirectTo: 'notifications', pathMatch: 'full' },
];
