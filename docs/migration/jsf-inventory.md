# JSF -> Angular migration inventory: brokerage-admin

App: `/Users/edwin/development/projects/stately/brokerage-system/brokerage/brokerage-admin`
Stack: Jakarta EE 10 WAR, JSF (Faces servlet) + PrimeFaces 15 (jakarta) + OmniFaces 4.2, EclipseLink JPA (`brokeragePU`, JTA datasource `jdbc/brokerage`, MySQL), JasperReports 7, in-house libs `stately-common-jakarta` / `stately-jsf-jakarta` (QryBuilder, CrudService base, JsfMsg/JsfUtil, `stately:` composite tags). GlassFish/Payara (`glassfish-web.xml`).
The same WAR also hosts a JAX-RS API under `/api` (`api/JAXRSConfiguration`, `api/endpoint/*`, ~25 endpoints, investor/mobile-facing, with `CORSFilter`). It is NOT used by the JSF admin pages, but is prior art for the Angular back end.

Scope read: 81 `.xhtml` files (2 root, 10 composite components, 1 template, 2 menus, 66 pages under `secured/`) and all classes under `jsf/**`.

How this file was produced: the cross-cutting part (this section: config, template, menus, login/error, composite components, shared/session beans, converters, listener, reachability) was read directly. The per-module page sections further down were produced by five parallel readers, one per module, each instructed to open every page and bean in full; any file a reader could not open is flagged in that module's section.

---

## A. Configuration

### WEB-INF/web.xml
- Context params: `jakarta.faces.PROJECT_STAGE=Production`; `jakarta.faces.FACELETS_BUFFER_SIZE=1048576` (buffers the page so a render-time exception can still forward to the error page). PrimeFaces theme param is commented out.
- Servlet: `Faces Servlet` (`jakarta.faces.webapp.FacesServlet`), load-on-startup 1, mapped to `*.xhtml` only.
- Welcome file: `login.xhtml`.
- Session timeout: **600 minutes** (10 hours).
- Error pages: `java.lang.Throwable` -> `/error.xhtml`; HTTP 500 -> `/error.xhtml`. No 404 / ViewExpired page.
- **No filters, no `<security-constraint>`, no `<login-config>`, no security roles.** There is no container security at all.

### WEB-INF/faces-config.xml
- Resource bundle `com.statelyhub.brokerage.resources.messages` as var `msg` (223 lines in `messages.properties`; used ~1700 times in pages for labels, `msg.date_pattern_1`, `msg.money_format`, etc. -> needs an i18n/labels file in Angular).
- One phase listener: `com.statelyhub.brokerage.jsf.listeners.BrokeragePhaseListener`.
- **No navigation rules. No converters registered here** (all are `@FacesConverter(forClass=...)` annotations).

### WEB-INF/beans.xml, glassfish-web.xml
- `beans.xml`: `bean-discovery-mode="all"`.
- `glassfish-web.xml`: `<class-loader delegate="false"/>`.

### Authentication / authorisation (as actually implemented)
- `jsf/listeners/BrokeragePhaseListener` (the only access control): before RENDER_RESPONSE, if the viewId contains `"secured"` and `userSession.userUR == null` it redirects to `AppPages.login`. It only guards rendering: a postback to a secured view still runs APPLY/INVOKE phases before the redirect. It also only matches the substring "secured".
- `LoginController` (`@Named loginController`, request scoped): `doLogin()` -> `UserService.login(Credential)` -> JPQL via QryBuilder on `UserAccount` where `emailAddress = ?` and `userPassword = SHA-hash(password)` (`SecurityHash.shaHash`, unsalted). On success `userSession.login(userAccount)` and `Faces.redirect(AppPages.adminIndex)`; on failure message "Wrong username or password.". `doLogout()` invalidates session, `Faces.logout()`, redirect to login.
- **`UserAccount.accountStatus` (ACTIVE/INACTIVE) is never checked at login** - inactive users can sign in.
- **There are no roles, groups or permissions anywhere.** `UserAccount` has only accountName, emailAddress, userPassword, phoneNo, accountStatus. No page has a `rendered=`/`disabled=` condition based on the user; the menu has no render conditions. `userSession.userCategory` and `userSession.accountName` are never set (the top bar "role" line is always blank; `CaseController.actorName()` falls back to "Back office").
- `AppPages`: `static String adminIndex = Faces.getRequestBaseURL() + "secured/index.xhtml"`, `login = Faces.getRequestBaseURL()`. These statics are initialised once, from whichever request first loads the class, so the host/scheme of the first request is baked in for everybody (breaks behind a proxy or with multiple host names).
- `UserService.emailPhone(email)` (password reset: generates a 6-char token, sets it as the new password, hard-coded URL `http://localhost:8080/breath-web/`, email sending commented out) is not called from any JSF page.

---

## B. Layout, template, login, error

### secured/appTemplate.xhtml - TEMPLATE (used by all 66 pages under secured/, via `ui:composition template`)
1. Kind: Facelets template. Inserts: `pageTitle`, `pageSubTitle`, `pageActions`, `pageContent`.
2. Beans: `userSession` (session), `loginController` (request).
3. Purpose: admin shell - left sidebar (includes `menus/app-menues.xhtml`), top bar, page title bar, footer.
4. Actions: sidebar toggle buttons (JS `assets/js/sidebar.js`: accordion, current-page highlight by URL, mobile drawer, remembers open group in storage key `sidebar.openGroup`); global `p:messages globalOnly` with `p:autoUpdate` in the top bar (all `JsfMsg` messages surface here -> toast/notification service in Angular); Notifications bell (static, no behaviour); user dropdown: Profile (dead `javascript:;`), Settings (dead), **Change Password** (`href="sysadmin/change-password.xhtml"` - a RELATIVE link, so it only resolves correctly from `/secured/index.xhtml`; from any page in a sub-folder it points to e.g. `/secured/accounts/sysadmin/change-password.xhtml` and 404s), Logout (`h:commandButton action="#{loginController.doLogout()}"`).
5. Services: `LoginController.doLogout` only.
6. Roles: none. Shows `#{userSession.userUR}` (UserAccount.toString) and `#{userSession.userCategory}` (always null).
7. Unusual: title hard-coded "Prime Brokerage"; assets: bootstrap css/js, `app.css`, `common.css`, `app-template.css`, `stately-ui.css` (the `st-*` design system used by newer pages), Google Font Inter; avatar image hard-coded.

### login.xhtml - FULL PAGE (standalone, no template; welcome file)
1. Kind: full page.
2. Bean: `loginController` (request scoped), fields `emailAddress`, `userpassword`.
3. Purpose: staff sign-in.
4. Actions: Username (required), Password (required, reveal-password button and Caps Lock hint in `assets/js/login.js`), "Sign in" `h:commandButton action="#{loginController.doLogin()}"`; `p:messages`. Shows the JSF project stage as an environment badge.
5. Services: `UserService.login` (see above).
6. Roles: none.
7. Unusual: branding is "Laurus Africa" / "Prime Brokerage" (logo `assets/images/laurus-africa-logo.png`), text says "Use your Laurus Africa network account" although auth is the local `user_accounts` table. No "forgot password" flow; static text says resets are done by the administrator. No lockout, no captcha, no OTP.

### error.xhtml - FULL PAGE (standalone)
1. Kind: error page for Throwable / 500. No template, no beans, inline CSS on purpose.
3. Purpose: "Something went wrong" page showing request URI and exception type; links "Go to the dashboard" (`/secured/index.xhtml`) and "Back".
7. Angular equivalent: global error handler / error route.

---

## C. Menu structure

### secured/menus/app-menues.xhtml - ACTIVE MENU (included by appTemplate.xhtml)
Plain `<a href>` links, **no render conditions on any item**, no beans. Structure (label -> target under `/secured/`):

- **Dashboard** -> `index.xhtml`
- *Main Menu*
  - **Accounts**
    - Investors -> `accounts/investors.xhtml`
    - Upload Investors -> `accounts/investor-upload.xhtml`
    - Incomplete Registrations -> `accounts/incomplete-kycs.xhtml`
    - Investor Verifications -> `accounts/investor-verification.xhtml`
    - Account -> `accounts/account.xhtml`
    - Account Portfolio -> `accounts/account-portfolio.xhtml`
    - Beneficiary -> `accounts/beneficiary.xhtml`
    - Investor Risk Assessment -> `accounts/investor-risks-assessments.xhtml`
    - Account Utilities -> `accounts/account-utilities.xhtml`
  - **Equities**
    - Orders -> `equities/trade-order.xhtml`
    - Upload Stock Orders -> `equities/stock-order-upload.xhtml`
    - Working Orders -> `equities/equity-working-orders.xhtml`
    - Order Batching -> `equities/equity-order-batching.xhtml`
    - Execution Processing -> `equities/execution-processing.xhtml`
    - Trade Records -> `equities/trade-records.xhtml`
    - Equity Transactions -> `equities/equity-trades-transaction.xhtml`
    - Dividends -> `equities/dividend.xhtml`
    - Dividend Processing -> `equities/dividend-processing.xhtml`
    - Bonus Shares -> `equities/bonus.xhtml`
    - Bonus Processing -> `equities/bonus-processing.xhtml`
  - **Fixed Income**
    - Orders -> `fixed-income/fixed-income-trade-order.xhtml`
    - Working Transactions -> `fixed-income/fixed-income-working-orders.xhtml`
    - Order Batching -> `fixed-income/fixed-income-order-batching.xhtml`
    - Execution Processing -> `fixed-income/fixed-income-execution-processing.xhtml`
    - Execution Upload -> `fixed-income/fixed-income-execution_uploads.xhtml`
    - Trade -> `fixed-income/fixed-income-transactions.xhtml`
    - Simple Transaction -> `fixed-income/simple-transaction.xhtml`
    - Fixed Income Redemption -> `fixed-income/fixed-income-redemption.xhtml`
  - **Cash Transactions**
    - Cash Transactions -> `cash/cash-transaction.xhtml`
  - **Transactions History**
    - Account Transactions -> `transactions/account-transaction.xhtml`
    - FixedIncome Trans. History -> `transactions/fi-transaction-history.xhtml`
    - Cash Transaction History -> `transactions/cash-transaction-records.xhtml`
  - **Client Care**
    - Cases -> `support/cases.xhtml`
    - Contact Log -> `support/interactions.xhtml`
  - **Reports** -> `report/reports.xhtml`
- *System Admin*
  - **General**: User Accounts -> `sysadmin/user-accounts.xhtml`; Risk Level -> `sysadmin/risk-level.xhtml`; Country -> `sysadmin/country.xhtml`; Registrar -> `sysadmin/registrar.xhtml`; Industry -> `sysadmin/industry.xhtml`; Case Categories -> `sysadmin/case-categories.xhtml`; Case Teams -> `sysadmin/case-teams.xhtml`
  - **Equities**: Stock Exchanges -> `sysadmin/stock-exchange.xhtml`; Stocks -> `sysadmin/stocks.xhtml`; Equity Market Prices -> `sysadmin/equity-market-price.xhtml`; Fees Type -> `sysadmin/fee-type.xhtml`; Exchange Fees -> `sysadmin/exchange-fee.xhtml`
  - **Fixed Income**: Issuers -> `sysadmin/issuers.xhtml`; Security Issuers -> `sysadmin/security-issuer.xhtml`; Fixed Income Security -> `sysadmin/fixed-income.xhtml`; Fixed Income Market Prices -> `sysadmin/fixed-income-prices.xhtml`
  - **Mutual Funds**: Funds -> `sysadmin/funds.xhtml`
  - **Bank Account**: Bank Accounts -> `sysadmin/bank-account.xhtml`; Bank -> `sysadmin/bank.xhtml`; Bank Branches -> `sysadmin/bank-branches.xhtml`
  - **Risk Assessment Config**: Assessment Questions -> `sysadmin/risk-assessment-question.xhtml`
  - **Messaging Templates**: Messaging Templates -> `sysadmin/messaging-templates.xhtml`

58 menu targets (57 leaf pages + dashboard). Outside the sidebar: `sysadmin/change-password.xhtml` (top-bar dropdown, relative link, see above), `equities/execution_uploads.xhtml` (only via a text link inside `equities/execution-processing.xhtml`).

### secured/menus/app-menues-old.xhtml - DEAD (not included anywhere)
Previous sidebar markup (`has-arrow` metisMenu style). Same link set as the active menu minus the newer pages (no investor-upload, stock-order-upload, dividends, bonus, Client Care, registrar, industry, case categories/teams, equity market prices, FI market prices). It also links two pages that **no longer exist**: `accounts/account-listing.xhtml` and `equities/trade.xhtml`. No render conditions. Ignore for migration.

### Pages NOT reachable from the menu or any include/link
| Page | Status |
|---|---|
| `secured/accounts/account_2.xhtml` | Dead copy of account.xhtml (uses `accountController`) |
| `secured/accounts/investors_1.xhtml` | Dead copy of investors.xhtml (uses `investorController`) |
| `secured/accounts/account-investor.xhtml` | Orphan (`accountInvestorController`); no link/include |
| `secured/accounts/account-overview.xhtml` | Orphan (`accountOverviewController`); no link/include |
| `secured/dashboard3.xhtml` | Orphan alternative dashboard (`dashbaordViewController`) |
| `secured/fixed-income/fixed-income-market-price.xhtml` | Orphan (`fixedIncomeMarketPriceController`); superseded by `sysadmin/fixed-income-prices.xhtml` |
| `secured/menus/app-menues-old.xhtml` | Dead fragment |
| `secured/equities/execution_uploads.xhtml` | Not in menu; reachable only from an inline link in execution-processing.xhtml |
| `secured/sysadmin/change-password.xhtml` | Not in menu; top-bar link is relative and broken from sub-folders |

Menu-linked but **broken**: `sysadmin/issuers.xhtml` (EL `#{issuersController...}`) and `sysadmin/security-issuer.xhtml` (EL `#{securityIssuerController...}`) - no `@Named` bean with either name exists anywhere in `src/main/java`, so every expression resolves to null. `sysadmin/funds.xhtml` is a 16-line stub. See the sysadmin section for detail.

Beans with no page: `sigupController` (self-registration creating an ACTIVE `UserAccount` with no approval - no page uses it), `cashController`, `navHelper`, `appModule`, `userCommonOptions` (empty).

---

## D. Composite components (`resources/brokerage/*.xhtml`, namespace `brokerage:`)

All are composite components (`cc:interface`/`cc:implementation`). Each maps to a shared Angular component.

### resources/brokerage/accountSearch.xhtml - `<brokerage:accountSearch>`
1. Composite component. Used by: accounts/account-overview, accounts/account-portfolio, cash/cash-transaction, equities/trade-order, fixed-income/fixed-income-redemption, fixed-income-trade-order, fixed-income-transactions, simple-transaction, transactions/account-transaction, transactions/cash-transaction-records.
2. Bean: `accountSearch` (`jsf/AccountSearch`, **session scoped**).
3. Purpose: search an account and pick one; the host page then reads `accountSearch.selectedAccount`.
4. Attributes: `ajax` (true), `rows` (8), `update` (@form), `selectAction` (method, no-arg), `otherAction` (unused). UI: search text, "search by" dropdown hard-coded to `accountCode` / `accountName`, Search button -> `accountSearch.searchAccount()`. Result table (paginated, row toggler with depositoryCode, accountName, accountType, stockExchange, principalInvestor, id): columns Account Code and Account Name (column filters, contains) rendered as command links which first `setPropertyActionListener` the row into `accountSearch.selectedAccount` then call the host's `selectAction`; several other columns are `rendered="false"`. A red "X" column calls `accountSearch.deleteAccount(account)` which is a **no-op** (always reports failure).
5. Data: `QryBuilder.get(em, Account.class).addStringQryParam(searchField, searchText, LIKE)` directly in the bean (the field name comes from the client value). No minimum length; empty text returns everything.
7. State: `accountsList`, `selectedAccount`, `searchField`, `searchText` live in the session and are **shared by every page that embeds the component** - the account picked on one page is still selected on the next. `clear()` resets and calls `JsfUtil.resetViewRoot()`.

### resources/brokerage/investorSearch.xhtml - `<brokerage:investorSearch>`
1. Composite. Used by: accounts/account, account-utilities, beneficiary, investor-risks-assessments, support/cases, support/interactions.
2. Bean: `investorSearch` (`jsf/accounts/InvestorSearch`, **session scoped**).
3. Purpose: search and pick an investor; host reads `investorSearch.selectedInvestor`.
4. Attributes as accountSearch. Search text + "search by" (surname, othernames, investorName, emailAddress) -> `investorSearch.searchInvestor()`. Table: row toggler (investorName, surname, othernames, email, id), Investor Name link (sets `selectedInvestor`, calls `selectAction`), Email (filter). Hidden (`rendered=false`) surname column and delete "X" (`deleteInvestor` is a no-op).
5. Data: `QryBuilder` LIKE query on `Investor` in the bean. Empty text returns nothing; the "at least 3 characters" message is guarded by `length < 1` so it never fires.
7. Same shared session state caveat as accountSearch.

### resources/brokerage/fixedIncomeSearch.xhtml - `<brokerage:fixedIncomeSearch>`
1. Composite. Used by: fixed-income/fixed-income-transactions, fixed-income-working-orders.
2. Bean: `fixedIncomeSearch` (`jsf/FixedIncomeSearch`, **session scoped**).
4. Security Code text -> `fixedIncomeSearch.searchFixedIncome()`; table with row toggler (id, dayCount), Security Code link (sets `selectedFixedIncome`, calls `selectAction`), Maturity Date (`stately:dateDisplay`). Attributes `allowMutipleSelection`, `otherAccountAction`, `otherActionLabel` declared but unused.
5. Service: `FixedIncomeService.searchFixedIncome(fixedIncomeQP, dateRange)`.

### resources/brokerage/investorList.xhtml - `<brokerage:investorList>`
1. Composite. Used by: accounts/investors, incomplete-kycs, investor-verification.
2. No bean of its own; everything is passed in.
3. Purpose: the investor register table - global search box (client-side PrimeFaces filter over surname/first/other names, email, investor code, phone, ID number, status), "Showing x of y" count, sortable columns: Investor (avatar initials, name, code, email), Contact (mobile, residential country), Identification (ID type tag, number), Registration date (+ "Verified by" / "Awaiting review"), Status pill; row expansion renders `<brokerage:investor>`; action column with edit button (icon or labelled) and delete button with confirm dialog.
4. Attributes: `value`, `filteredValue`, `rows` (10), `widgetVar`, `update`, `showSearch`, `showExpansion`, `searchPlaceholder`, `emptyMessage`, `selected` (writable target for the clicked row), `editAction`, `editLabel`, `editIcon`, `editAjax`, `deleteAction`.
7. Relies on entity view helpers `Investor.getInitials()`, `getDisplayName()`, `getStatus()`, `getStatusStyle()` (presentation logic in the entity -> move to DTO or Angular pipe). Whole list is loaded and filtered in memory (no server paging).

### resources/brokerage/investor.xhtml - `<brokerage:investor>`
1. Composite. Used by investorList (row expansion) and directly by accounts/investor-upload and the dead investors_1.
3. Read-only investor detail card in six groups: Personal, Contact & Address, Identification, Employment & Financial (incl. risk level), Alerts (sms/email/purchase/sales/cash flags), Verification (status, registration date, verified date/by, bioDataCompleted, bioDataVerified). Attributes: `value` (required), `columns` (legacy), `showHeader`.

### resources/brokerage/equityOrder.xhtml - `<brokerage:equityOrder>`
1. Composite. Used once, by equities/equity-working-orders.
3. Read-only summary of an EquityOrder: orderNo, valueDate, account name, orderQuantity, buySell, orderPrice, qtyLeft, qtyExecuted. Declared attributes `ajax`, `update`, `selectAction`, `otherAction` are unused.

### resources/brokerage/stats.xhtml + statTile.xhtml - `<brokerage:stats>`, `<brokerage:statTile>`
1. Composites (pure presentation). Used by account-portfolio, cash-transaction, equity-trades-transaction, execution-processing, trade-records, account-transaction.
3. Summary tile strip; a tile has `label`, `value`, `pattern` (number format), `foot`, `tone` (ok/warn/bad), `onclick` (click-to-filter tiles), `styleClass`, `rendered`, and `value`/`foot` facets.

### resources/brokerage/steps.xhtml + step.xhtml - `<brokerage:steps>`, `<brokerage:step>`
1. Composites (pure presentation). Used only by equities/execution-processing.
3. Step indicator; a step has `no`, `title`, `sub`, `state` (done/current/empty).

### External composite library `stately:` (from `stately-jsf-jakarta` jar, not in this repo)
Used in 4 files: `stately:dateDisplay`, `stately:doubleDisplay` (equity-order-batching, fixed-income-order-batching, fixedIncomeSearch) and `stately:formControl saveButtonAction=...` (sysadmin/messaging-templates - a save/clear/close button bar). An `sps:infoPanel` reference in fixed-income-market-price.xhtml is commented out. The source of these tags could not be read (they live in a dependency jar).

---

## E. Shared / cross-cutting beans

### CommonOptions - `commonOptions`, REQUEST scoped (`jsf/CommonOptions.java`)
Feeds dropdowns on ~27 pages. Every getter that hits the DB runs a fresh unbounded `QryBuilder` query **each time EL evaluates it** (several times per request). In Angular these become lookup endpoints + cached reference data.
- Enum lists (no DB): `investorTypes`, `fixedIncomeTenorList`, `buySellList`, `orderStatusList`, `transactionStatusList`, `orderTypeList`, `execTypesList`, `timeInForceList`, `activeInactiveStatusList`, `accountTypeList`, `investorAccountTypeList` (AccountClassification), `applicationModeList`, `titleList`, `genderList`, `annualIncomeList`, `maritalStatusList`, `educationList`, `idTypeList`, `alertTypeList`, `residentialStatusList`, `debitCreditList`, `assetClassList`, `assetSubClassList`, `fixedIncomeDayCountList`, `ratePolicyList`, `fiMarketTypeList`, `currencyEnumsList`, `portfolioList`, `paymentChannelList`, `paymentStatusList`, `caseTypeList`, `caseStatusList`, `casePriorityList`, `caseChannelList`, `caseVisibilityList`, `caseResolutionCodeList`, `interactionTypeList`, `interactionDirectionList`.
- Entity lists (DB, all rows unless stated): `fixedIncomeSecuritiesList` (FixedIncome with maturityDate >= today, by securityCode), `accountsList` (all Account), `stocksList`, `stockExchangesList`, `investorsList` (all Investor), `tradeOrdersList` (all EquityOrder), `tradesList` (all EquityTransaction), `feesList` (FeeType), `exchangeFeeList`, `registrarsList` (by name), `industriesList` (by name), `countryList`, `riskLevelList`, `banksList` (bankActive = true), `bankAccountList` (activeStatus = true, by accountName), `securityIssuerList` (by issuerName), `caseCategoryList` (active, by name), `caseTeamList` (active, by name), `userAccountList` (by accountName).

### Session-scoped beans and the state they hold
Nearly every controller is `@SessionScoped` (only `investorUploadController`, `stockOrderUploadController`, `dashboardController` are view scoped; `loginController`, `commonOptions`, `dashbaordViewController`, `sigupController`, `userCommonOptions` are request scoped; `appModule` is application scoped). Consequence: search filters, result lists, the record being edited and open-dialog flags all survive navigation and are shared across browser tabs of the same user. Angular must reproduce only what is intended (e.g. keep filters) and drop accidental carry-over. Details of each controller's fields are in the module sections; the summary:

| Bean (@Named) | Class | State held in session |
|---|---|---|
| `userSession` | jsf/UserSession | Logged-in `UserAccount userUR` (whole entity incl. password hash), `accountName`, `userCategory` (both never set) |
| `navHelper` | jsf/NavHelper | `module`, `division`, `page` strings; `switchModule()` returns `/app/secured/<module>/home.xhtml` and `returnToPage()` returns `clientService/home.xhtml` - pages that do not exist. Unused by any page |
| `accountSearch` | jsf/AccountSearch | search field/text, result list, `selectedAccount` - shared by 10 pages |
| `investorSearch` | jsf/accounts/InvestorSearch | search field/text, result list, `selectedInvestor` - shared by 6 pages |
| `fixedIncomeSearch` | jsf/FixedIncomeSearch | query-param FixedIncome, date range, result list, `selectedFixedIncome` |
| accounts: `accountController`, `accountInvestorController`, `accountOverviewController`, `accountPortfolioController`, `accountUtilitiesController`, `beneficiaryController`, `incompleteInvestorKycController`, `investorController`, `investorRiskAssessmentController`, `investorVerificationController` | jsf/accounts/* | current entity being edited, lists, selected account/investor, filter values (see accounts section) |
| cash/transactions: `cashTransactionController`, `cashTransactionRecordsController`, `accountTransactionController`, `cashController` (unused), `fixedIncomeTransactionHistoryController` | jsf/accounts, jsf, jsf/equities | current transaction, date ranges, result lists, totals |
| equities: `bonusController`, `bonusProcessingController`, `dividendController`, `dividendProcessingController`, `equitiesWorkingOrdersListView`, `equityExecutionUploadController`, `equityOrderBatchController`, `equityOrderExecutionProcessiingController` (note the typo in the name), `equityTradeRecordsController` (class EquityTradeController), `equityTradeTransactionController` (class EquityTradesController), `tradeOrderController` | jsf/equities/* | order/trade being edited, batches, uploaded rows, filters |
| fixed income: `fixedIncomeTradeOrderController`, `fixedIncomeTransactionController`, `fixedIncomeWorkingOrdersListView`, `fixedIncomeExecutionProcessingController`, `fixedIncomeMarketPriceController`, `fixedIncomeExecutionUploadController`, `fixedIncomeOrderBatchController`, `fixedIncomeRedemptionController`, `simpleFixedIncomeTransactionController`, `fixedIncomePriceFetchController` | jsf, jsf/equities | as above |
| support: `caseController`, `interactionController`, `caseCategoryController`, `caseTeamController` | jsf/support/* | open case, message drafts, filters, lists |
| sysadmin/reference data: `bankAccountController`, `bankController`, `bankBranchController`, `countryController`, `industryController`, `registrarController`, `riskLevelController`, `riskAssessmentQuestionController`, `userAccountController`, `messagingTemplateController`, `changePasswordController`, `stockController`, `stockExchangeController`, `exchangeFeeController`, `feeTypeController`, `equityMarketPriceController`, `fixedIncomeController` | jsf, jsf/sysadmin, jsf/equities | entity being edited + cached list |

Other classes in `jsf/`: `AssetValuation` is a JPA `@Entity` (table `asset_valuation`) misplaced in the jsf package; `ValuationUtil` is a static helper; `AppPages` holds the two redirect URLs; `DashbaordViewController` (sic) is the request-scoped bean of the orphan dashboard3.

---

## F. Converters and listeners

### jsf/convertors (22 classes)
All are identical in shape: `@FacesConverter(forClass = X.class) class XConverter extends org.omnifaces.converter.SelectItemsConverter`, overriding only `getAsString` to return the entity `getId()` (String id). `getAsObject` is inherited: OmniFaces looks the id up among the `f:selectItems` of the component, so there is **no DB lookup** and no explicit `converter=` attribute in pages - they apply automatically wherever a `selectOneMenu`/`selectManyMenu`/autocomplete binds to that entity type. In Angular they disappear: bind dropdowns by id.

The "likely use" column is inferred from the matching dropdown sources: `forClass` converters are applied implicitly, so pages contain no explicit reference that could be traced. Treat it as a guide, not a verified usage list.

| Converter | Entity | Likely use (inferred) |
|---|---|---|
| AccountConverter | Account | account dropdowns (`commonOptions.accountsList`) |
| AccountInvestorConverter | AccountInvestor | account-holder selection on account pages |
| BankAccountConverter | BankAccount | company bank account on cash transactions (`commonOptions.bankAccountList`) |
| BankBranchConverter | BankBranch | branch dropdowns (bank account / investor bank details) |
| BankConverter | Bank | `commonOptions.banksList` |
| CaseCategoryConverter | CaseCategory | cases, case-categories (parent), `commonOptions.caseCategoryList` |
| CaseTeamConverter | CaseTeam | cases, case-categories (default team), `commonOptions.caseTeamList` |
| CountryConverter | Country | nationality / residential country, `commonOptions.countryList` |
| FeeConverter | FeeType | exchange-fee page, `commonOptions.feesList` |
| FixedIncomeConverter | FixedIncome | FI order/transaction security dropdowns, `commonOptions.fixedIncomeSecuritiesList` |
| IndustryConverter | Industry | stocks, `commonOptions.industriesList` |
| InvestorConverter | Investor | `commonOptions.investorsList` |
| RegistrarConverter | Registrar | stocks, `commonOptions.registrarsList` |
| RiskAssessmentAnswerConverter | RiskAssessmentAnswer | investor risk assessment answers |
| RiskLevelConverter | RiskLevel | investors, risk questions, `commonOptions.riskLevelList` |
| SecurityIssuerConverter | SecurityIssuer | fixed-income security, `commonOptions.securityIssuerList` |
| StockConverter | Stock | orders, dividends, bonus, market prices, `commonOptions.stocksList` |
| StockExchangeConverter | StockExchange | accounts, stocks, exchange fees (`getAsString(null)` returns the literal "stock exchange" instead of null - a bug) |
| SupportCaseConverter | SupportCase | interactions (link a contact to a case) |
| TradeConverter | EquityTransaction | `commonOptions.tradesList` |
| TradeOrderConverter | EquityOrder | `commonOptions.tradeOrdersList` |
| UserAccountConverter | UserAccount | case owner / team members, `commonOptions.userAccountList` |

Dates use inline `f:convertDateTime type="localDate" pattern="#{msg.date_pattern_1}"`; numbers use `f:convertNumber pattern="#{msg.money_format}"`.

### jsf/listeners (1 class)
`BrokeragePhaseListener` - the login guard described in section A. Runs for every phase id but only acts before RENDER_RESPONSE.

---

# Page-by-page inventory

## Module: dashboard, cash, transactions, report

Scope: 7 pages under `src/main/webapp/secured/`. All 7 xhtml files and all backing beans were read in full (DashboardController, DashbaordViewController, CashTransactionController, CashTransactionRecordsController, AccountTransactionController, FixedIncomeTransactionHistoryController, ReportsController, CashController, AssetValuation, ValuationUtil; plus the relevant methods of FixedIncomeReportService, BrokerageReportManager, ReportManager, CrudService, CashTransaction/AccountTransaction entity helpers, FixedIncomeService.getRunningTransactionByDate_all, and the `brokerage:accountSearch` composite). Nothing was unreadable.

Cross-cutting facts

- Template for 6 of 7 pages: `secured/appTemplate.xhtml` (defines `pageTitle`, `pageSubTitle`, `pageActions`, `pageContent`; includes `menus/app-menues.xhtml`). `menus/app-menues-old.xhtml` is not included anywhere (dead menu).
- No page in this scope has any role/permission check (`rendered=`/`disabled=` on roles or user type). None of the beans inject `userSession`. Access control is only whatever the login phase listener (`BrokeragePhaseListener`) enforces for `/secured/*`.
- No polling, push, or timers on any page.
- All "Print" actions are `h:commandLink target="_blank"` full (non-ajax) posts; the bean builds a list of DTOs and a Jasper report is streamed to the response through `ReportManager.showReport(listData, inputStream)` (`ReportManager` is a `@Stateless` `JasperReportManager`; `.jasper` paths in `BrokerageReportFiles`). If the bean bails out with `JsfMsg.error(...)`, the user gets a new blank tab re-rendering the same page with a message.
- `CrudService` is `@Stateless extends CrudController` (library). Beans call `crudService.save(entity)`, `crudService.delete(entity)`, `crudService.generateId()`, and `crudService.getEm()` directly for `QryBuilder`/JPQL. Each `save` is its own EJB transaction.
- REST endpoints already exist in the same module: `api/endpoint/CashTransactionEndpoint` (`v1/cash-transactions`) and `api/endpoint/AccountTransactionEndpoint` (`v1/accounts/{accountId}/account-transactions`). Worth checking for reuse (not read; out of scope).
- Classes named in the brief that are NOT backing beans: `jsf/AssetValuation` is a JPA `@Entity` (`asset_valuation` table, with a `convertToRate(rate)` helper) used by `FixedIncomeService`/`ValuationService`/`AccountService`; `jsf/ValuationUtil` is a static helper (`divid4Units`, `accept` >0.5, `acceptAmountLeft` >10) used by `FixedIncomeService`. Neither is referenced by any xhtml.
- Dead beans found: `jsf/CashController` (`@Named cashController`, `@SessionScoped`) is referenced by no xhtml and no Java class. Its `@PostConstruct loadCashTransactions()` loads ALL `CashTransaction` rows unfiltered; `saveCashTransaction`/`deleteCashTransaction` are plain `crudService.save/delete`; `printCashTransactions()` only prints to stdout. `reports/ReportsController` (`@Named reportsController`, `@SessionScoped`) is referenced by no xhtml (see reports.xhtml below).

---

### secured/index.xhtml

1. **Kind**: full page; `ui:composition template="./appTemplate.xhtml"`. Defines `pageTitle` ("Operations Dashboard"), `pageSubTitle`, `pageActions`, `pageContent`. This is the post-login landing page.
2. **Bean**: `com.statelyhub.brokerage.jsf.DashboardController` - `@Named("dashboardController")`, `@ViewScoped`. Injects only `CrudService`.
3. **Purpose**: read-only operations dashboard - KPIs, work queues, order flow, compliance counts, onboarding funnel, corporate actions, payments, client care, activity feed.
4. **User actions / content**
   - Header strip (`pageActions`): Value date (`valueDate`); Prices pill `pricedToday of listedStocks fresh` (ok if `pricesFresh`, else warn with tooltip using `stalePrices`); End-of-day pill from `eodPresent` / `eodAuthorised` ("Run & authorised" / "Run, not authorised" / "Not run").
   - Only button: form `dashboardActions` -> `p:commandButton value=#{msg.load}` `ajax="false"` -> `dashboardController.refresh()` (re-runs `load()`).
   - Headline KPI cards: `assetValue` (AUA), `cashBalance` + `cashPercentOfAua`, `revenueMtd` (fees MTD), `netFlowMtd` (shown only if `netFlowAvailable`, else a "Not available yet" placeholder). Currency label "GHS" hard-coded.
   - "Needs attention today" queue (badge `actionsOutstanding`), each row an `h:link` (plain GET navigation, no state carried):
     - Cash transactions pending (`cashPending`) -> outcome `/secured/accounts/cash-transaction` (BROKEN - see 7)
     - Cases past their target (`casesBreached`) -> `/secured/support/cases`
     - Cases with no owner (`casesUnassigned`) -> `/secured/support/cases`
     - Orders awaiting authorisation (`ordersUnauthorised`, `ordersUnauthorisedValue`) -> `/secured/equities/trade-order`
     - KYC awaiting verification (`kycAwaitingVerification`) -> `/secured/accounts/investor-verification`
     - Incomplete registrations (`registrationsIncomplete`) -> `/secured/accounts/incomplete-kycs`
     - Corporate actions this week (`corporateActionsThisWeek`) -> `/secured/sysadmin/fixed-income`
   - "Order flow today" (rendered if `ordersToday gt 0`, else empty state): header `ordersToday`, `considerationToday`; legend + stacked horizontal bar from map `ordersByStatus` (`keySet().toArray()` via `ui:repeat`, width from `sharePercent(part, whole)`); Buy vs sell bars (`buyValueToday`, `sellValueToday`); "Most traded" top 5 from `topStocksToday` (`Object[]{symbol, value}`); execution quality minis `fillRate`, `cancelRate`, `averageOrderSize`.
   - "Compliance & AML" (static rows, no links): `idsExpired`, `idsExpiringSoon`, `pepFlagged`, `reportableForeign`, `sourceOfFundsMissing`.
   - "Client book": `accountsTotal`, bars from map `accountsByClassification`.
   - "Onboarding funnel" (90 days): `onboardRegistered`, `onboardCompleted`, `onboardVerified`, percentages via `sharePercent`, drop-offs computed in EL (`onboardRegistered - onboardCompleted`, `onboardCompleted - onboardVerified`).
   - "Corporate actions" list: `upcomingActions` (`FiCorporateAction`: `valueDate`, `fixedIncome.securityCode`, `corporateActionType.label`, `fixedIncome.securityIssuer.issuer.issuerName`, `interestRate`).
   - "Securities maturing" list: `maturingSecurities` (`FixedIncome`: `maturityDate`, `securityCode`, `statusStyle`, `status`, `assetSubClass.label`, `coupon`).
   - "Payments this month": `paymentsFailed` pill, legend/stacked bar from map `paymentsByChannel` over `paymentsTotal`, `paymentsCount`, minis `settlementRate`, `paymentsFailed`, `payoutReadiness`.
   - "Client channel & alerts": `appAdoption`, `sessionsActive`, `investorsVerified`; bars from map `alertCoverage` via `alertPercent(count)`.
   - "Client care": `casesBreached` pill, `casesOpen`, `complaintsOpen`, `casesEscalated`, `casesRaisedThisMonth`, `casesResolvedThisMonth`, `satisfactionAverage`.
   - "What clients are raising": bars from map `casesByCategory` (width relative to `casesRaisedThisMonth`, or 1 if zero).
   - "Recent activity": `recentActivity` (`AccountActivitiy`: `activityType`, `description`, `account.accountCode`).
   - No charts library - all "charts" are CSS bars with inline `width:%` from bean percentages. No tables, dialogs, uploads, exports.
5. **Data access / logic (all in the bean; no service layer)** - `load()` (`@PostConstruct`) fires roughly 55 JPQL queries through `crudService.getEm().createQuery(...)` via private helpers `count/sum/rows/topRows/list` (each swallows exceptions and returns 0/empty, logging to stdout). Whole thing must become one or more server-side dashboard endpoints.
   - `loadEndOfDay`: `SELECT e FROM Eod e ORDER BY e.eodDate DESC` (max 1) -> `assetValue`, `cashBalance`, `eodAuthorised`; **`valueDate` is overridden with the latest `eod.eodDate`** (falls back to `LocalDate.now()`), `monthStart` = first of that month. `revenueMtd = SUM(e.todayFees)`; net flow = `SUM(e.amountPurchase) - SUM(e.amountRedeemed)` from `Eod` since `monthStart`; `netFlowAvailable = in != 0 || out != 0`.
   - `loadMarketDataFreshness`: `COUNT(s) FROM Stock`, `COUNT(DISTINCT p.equity) FROM EquityMarketPrice p WHERE p.valueDate = :d`.
   - `loadActionQueue`: `CashTransaction` where `paymentStatus = PENDING`; `EquityOrder` where `authorised = false` (count and `SUM(orderQuantity * orderPrice)`); `Investor` `bioDataCompleted = true AND bioDataVerified = false`; `Investor` `bioDataCompleted = false`; `FiCorporateAction` `valueDate BETWEEN valueDate AND +7d`.
   - `loadOrderFlow`: `EquityOrder` by `valueDate`: count, `SUM(orderQuantity*orderPrice)`, group by `orderStatus`, sums by `buySell` BUY/SELL, top 5 by `stock.stockSymbol`, counts with `OrderStatus.COMPLETELY_FILLED` / `CANCELLED`; `averageOrderSize = considerationToday / ordersToday`.
   - `loadCompliance`: `Investor.idExpiryDate < :d`; `BETWEEN d AND d+60`; `isPepInGhana OR isPepOutsideGhana`; `isForeignCitizen OR hasGreenCard OR foreignTaxId non-empty`; `sourceOfFunds IS NULL`.
   - `loadClientBook`: `COUNT Account`; `GROUP BY a.classification`.
   - `loadOnboarding`: `Investor.registrationDate >= valueDate-90` total / `bioDataCompleted` / `bioDataVerified`.
   - `loadPayments`: `CashTransaction` since `monthStart`: `SUM(amount) GROUP BY paymentChannel`, count, count `PAID`, count `FAILED`; `COUNT(DISTINCT b.investor) FROM InvestorBankAccount b`.
   - `loadChannelAndAlerts`: `Investor` total / verified / `userPassword` non-empty ("registered on app"); `LoginSession.activeStatus = true`; alert flags `enableSmsAlert`, `enableEmailAlert`, `purchaseAlert`, `salesAlert`, `cashTransactionAlert`.
   - `loadClientCare`: `SupportCase` with `caseStatus IN CaseStatus.openStatuses` (open, `owner IS NULL`, `ackBreached OR resolveBreached`, `escalated`, `caseType = COMPLAINT`), `reportedAt`/`resolvedAt >= monthStart`, `AVG(s.rating) FROM CaseSatisfaction` last 3 months, top 6 `category.categoryName` last 3 months.
   - `loadLists`: `FiCorporateAction` next 30 days (max 8), `FixedIncome` maturing in 30 days (max 5), `AccountActivitiy ORDER BY id DESC` (max 8).
   - Derived calculations in bean: `getStalePrices`, `isPricesFresh`, `getCashPercentOfAua`, `getFillRate`, `getCancelRate`, `getSettlementRate`, `getAppAdoption`, `getPayoutReadiness`, `alertPercent`, `sharePercent`, `getActionsOutstanding` (sum of 5 queue counts - excludes the two case rows), `label()` (enum name -> "Sentence case", null -> "Unspecified").
   - Hard-coded windows: `MATURING_WINDOW_DAYS=30`, `ID_EXPIRY_WINDOW_DAYS=60`, `FUNNEL_WINDOW_DAYS=90`.
6. **Roles**: none. Every logged-in admin sees firm-wide figures.
7. **Unusual / bugs**
   - Referenced from: menu (`app-menues.xhtml` line 6), `error.xhtml` "home" button, `AppPages.adminIndex` (redirect target in `LoginController` and `SigupController`). Live.
   - **Broken link**: first queue row uses outcome `/secured/accounts/cash-transaction`; no such view exists (the page is `/secured/cash/cash-transaction.xhtml`). JSF will render it as a dead/disabled link.
   - **`refresh()` double-counts**: bean is view-scoped and the button is a postback, so `load()` runs again on the same instance. `paymentsTotal` is accumulated with `+=` and never reset, so it doubles on every click; maps `ordersByStatus`, `accountsByClassification`, `paymentsByChannel`, `alertCoverage` are not cleared (only `casesByCategory` is), so stale keys can linger.
   - "Value date" is the latest EOD date, not today - "today" figures (orders, prices) are really "as of last EOD date".
   - "Payments this month" sums `CashTransaction.amount` for all directions/statuses; since debits are stored negative, the channel totals net debits against credits.
   - Query failures are silently shown as 0.
   - "GHS" hard-coded in the view; funnel colours hard-coded.

---

### secured/dashboard3.xhtml

1. **Kind**: orphan fragment - a bare `<div class="page">` with no `ui:composition`, no template, no namespaces declared. Not included by anything (`grep dashboard3` over `src/main/webapp` and `src/main/java` returns no hits), not in any menu, no navigation outcome.
2. **Bean**: `com.statelyhub.brokerage.jsf.DashbaordViewController` (sic) - `@Named("dashbaordViewController")`, `@RequestScoped`. Used only by this file.
3. **Purpose**: abandoned old dashboard built on a purchased Bootstrap admin template; superseded by `index.xhtml`.
4. **Content**: four live counters - `totalInvestors`, `incompleteRegistration`, `totalPendingVerification`, `totalActiveAccounts`. Everything else is static template mock-up: empty chart divs `chart1`..`chart7` (no script wiring in this file), "Monthly Revenue" Day/Week/Month buttons and "Download CSV" button (plain `<button>`, no action), "Revenue by Channel", "Order Status" (289/348/152), "Best Selling Stocks" (MTN, CAL with ice-cream icons), "Recent Reviews", "Support Inbox" (fake names), "Recent Orders" table (Nike shoes). Uses `#{application.contextPath}` for image URLs. No actions call a bean.
5. **Data access**: `init()` (`@PostConstruct`) - `QryBuilder.get(em, Investor.class).count()`; `...addObjectParam(Investor._bioDataCompleted, false).count()`; `...addObjectParam(_bioDataCompleted, true).addObjectParam(_bioDataVerified, false).count()`; `QryBuilder.get(em, Account.class).count()` (labelled "Active Accounts" but counts all accounts; filter commented out). No business logic.
6. **Roles**: none.
7. **Unusual**: **DEAD** - do not migrate. Same counters exist on `index.xhtml` (`registrationsIncomplete`, `kycAwaitingVerification`, `accountsTotal`).

---

### secured/cash/cash-transaction.xhtml

1. **Kind**: full page; `template="./../appTemplate.xhtml"`. Uses composites `brokerage:accountSearch`, `brokerage:stats`, `brokerage:statTile`. One global `p:confirmDialog`. Menu: "Cash Transactions > Cash Transactions".
2. **Bean**: `com.statelyhub.brokerage.jsf.accounts.CashTransactionController` - `@Named("cashTransactionController")`, `@SessionScoped`. Injects `CrudService`, `AccountSearch` (session bean), `BrokerageReportManager`. Shared: `commonOptions.portfolioList`, `debitCreditList`, `paymentStatusList`, `bankAccountList`, `currencyEnumsList`, `paymentChannelList`; `accountSearch.searchText`, `searchField`, `searchAccount()`, `accountsList`, `selectedAccount`, `deleteAccount(account)` (all via the composite).
3. **Purpose**: per-account, per-portfolio cash ledger with capture of deposits/withdrawals, mark-as-paid, delete, account-to-account transfer, and statement print.
4. **User actions**
   - State A (`not accountSelected`): `brokerage:accountSearch` in form `cashAccountSearch` (`ajax=true`, `rows=10`, `update=":mainContent"`); clicking an account sets `accountSearch.selectedAccount` (`f:setPropertyActionListener`) then calls `cashTransactionController.selectAccount()`.
   - State B (`accountSelected`):
     - Toolbar form `cashActions`:
       - Portfolio `p:selectOneMenu` -> `portfolioFilter` (items `commonOptions.portfolioList`, no "All" option); `p:ajax event="change"` -> `loadSelectedCashTransaction()`, updates `:mainContent`.
       - "Change Account" -> `changeAccount()` (ajax).
       - "Transfer Funds" -> `activateTransferMode()` (ajax; button highlighted when `transferMode`).
       - "Print Statement" `h:commandLink target="_blank"` -> `printCashTransaction()` (PDF via Jasper `cash_transaction.jasper`).
     - Account identity strip: `selectedAccount.stockExchange.exchangeCode`, `accountName`, `accountCode`, `depositoryCode`, `accountType`, `principalInvestor.displayName`, `principalInvestor.emailAddress`.
     - Stat tiles: `ledgerBalance`; `totalCredit` + `creditCount`; `totalDebit` + `debitCount`; `pendingAmount` + `pendingCount`; `netMovement`.
     - Ledger form `cashTable`:
       - Filters: Type -> `directionFilter` ("All" + `commonOptions.debitCreditList`); Status -> `statusFilter` ("All" + `commonOptions.paymentStatusList`); From/To `p:datePicker` -> `dateRange.fromDate/toDate`; Search button (`ajax="false"`) -> `loadSelectedCashTransaction()`.
       - `p:dataTable id="cashTbl"` over `cashTransactionList`, `filteredValue=filteredTransactions`, 15 rows, paginator (15/30/50/100), row key `id`. Columns: row toggler; Date (`valueDate`, sortable); Description (`description`, column filter contains; sub-line `tranRefNo`); Bank account (`bankAccount.accountName`); Portfolio (`portfolio.label`, sortable); Credit; Debit; Balance (`balanceAt(row)`); Status pill (`statusStyleOf(row)`, `statusLabelOf(row)`); Actions.
       - Row expansion: `currency`, `paymentChannel.label`, payment status pill, `tranRefNo`, `verified`, `valueDate`, `paymentWallet.walletLabel`, `amount`; button "Mark as Paid" (`rendered="#{not isSettled(row)}"`) -> `markAsPaid(row)`.
       - Row actions: pencil -> `editCashTransaction(row)` (loads the row into the right-hand form); trash -> `deleteCashTransaction(row)` behind `p:confirm` ("Delete this cash transaction? This cannot be undone.").
       - Footer row: `transactionCount`, `totalCredit`, `totalDebit`, `ledgerBalance`.
     - Right panel, normal mode - form `cashForm` (`rendered="#{not transferMode}"`), bound to `cashTransactionController.cashTransaction`: `valueDate` (date), `bankAccount` (select, `commonOptions.bankAccountList`), Direction via two buttons "Credit (money in)" -> `useCredit()` / "Debit (money out)" -> `useDebit()` (styled from `credit`), `amount` (`p:inputNumber` 2dp), `currency` (`commonOptions.currencyEnumsList`), `paymentChannel` (`commonOptions.paymentChannelList`), `paymentStatus` (`commonOptions.paymentStatusList`), `tranRefNo`, `description` (textarea). Read-out "Balance after posting" = `balanceAfterPosting` from `ledgerBalance`. Buttons: Clear -> `clearSelectedAccount()` (really "new transaction"); "Save Transaction" (`ajax="false"`) -> `saveSelectedAccount()`. **No portfolio input on the form** - portfolio comes from the toolbar filter.
     - Right panel, transfer mode - form `transferForm` (`rendered="#{transferMode}"`): Value date -> `valueDate`; source strip (read-only, shows `ledgerBalance`); destination: if `destinationAccount != null` show it with "Change" -> `setDestinationAccount(null)`; else inline search: "Search by" -> `transferSearchField` (hard-coded items `accountName` / `accountCode`), text -> `transferSearchText`, Search -> `searchTransferDestination()` (updates `destSearchPanel`), result table `transferAccountResults` (5 rows; Code and Name are commandLinks -> `selectTransferDestination(destAcc)`; Type pill `typeStyle`/`accountType`). Fields: Amount -> `transferAmount`; Destination Portfolio -> `transferDestinationPortfolio` (`commonOptions.portfolioList`); Description -> `transferDescription`. Read-out "Source balance after transfer" computed in EL (`ledgerBalance - transferAmount`). Buttons: Cancel -> `activateNormalMode()`; "Execute Transfer" -> `doTransfer()` behind `p:confirm` ("Transfer X from A to B?").
   - No uploads, no Excel export, no autocomplete.
5. **Data access and bean logic**
   - `selectAccount()`: takes `accountSearch.getSelectedAccount()`; **defaults** `dateRange` = first day of the month three months back .. today, `portfolioFilter = Portfolio.TRADING_ACCOUNT`; `newTransaction()`; `loadSelectedCashTransaction()`.
   - `loadSelectedCashTransaction()`: `QryBuilder.get(em, CashTransaction.class).addObjectParam(_account, selectedAccount).addDateRange(dateRange, _valueDate)` + optional `_portfolio`, `_debitCredit`, `_paymentStatus`, `.orderByDesc(_valueDate)`; then `computeRunningBalances()`.
   - **Logic in bean (must move server-side)**:
     - `computeRunningBalances()` / `balanceAt()`: walks the loaded list oldest-to-newest, balance starts at 0 and sums `credit + debit` (debits stored negative) into a `Map<id, balance>`. No brought-forward balance.
     - `getLedgerBalance()`, `getNetMovement()` (identical), `getTotalCredit()`, `getTotalDebit()` (abs), `getCreditCount()`, `getDebitCount()`, `getPendingCount()`, `getPendingAmount()`, `getBalanceAfterPosting()` - all loops over the currently loaded (filtered) list.
     - `isSettled()` = `paymentStatus == PAID || paid`; `statusLabelOf()`, `statusStyleOf()` (FAILED/CANCELLED -> bad).
     - `newTransaction()` defaults: `valueDate = today`, `debitCredit = CREDIT`, `paymentStatus = PENDING`, `portfolio = portfolioFilter`.
     - `validate()`: portfolio, value date, bank account required; `abs(amount) > 0`; description non-blank.
     - `saveSelectedAccount()`: sets account, `cashTransaction.resolveAmt(isCredit ? +amount : -amount)` (entity method: sets `debitCredit`, signed `amount`, `credit`/`debit` columns; the entity also re-derives these in `@PrePersist/@PreUpdate`), `setPaid(paymentStatus == PAID)`, `crudService.save(cashTransaction)`, `CollectionHelper.checkAdd(list, tx)`, recompute balances. Used for both create and edit.
     - `markAsPaid(item)`: status transition -> `PaymentStatus.PAID`, `paid = true`, `crudService.save(item)`. No guard on current status, no audit.
     - `deleteCashTransaction(item)`: `crudService.delete(item)` hard delete, any status (including PAID).
     - `searchTransferDestination()`: `QryBuilder.get(em, Account.class).addStringQryParam(transferSearchField, text, LIKE)`.
     - `doTransfer()`: validations (value date, source, destination, source != destination, `transferAmount > 0`, `getLedgerBalance() > 0`); `sharedRef = crudService.generateId()` (number/reference generation in bean); builds a DEBIT `CashTransaction` on the source (portfolio = `portfolioFilter`, description `"<desc> → <dest name>"`, `PAID`, `paid=true`, `verified=true`, `tranRefNo=sharedRef`, id from `generateId()`) and a CREDIT on the destination (portfolio = `transferDestinationPortfolio`, description `"<desc> ← <source name>"`, `PAID`, `paid=true`); default description "Internal transfer"; `crudService.save(debit) != null && crudService.save(credit) != null`; then `activateNormalMode()`.
     - `printCashTransaction()`: maps each `CashTransaction` to `CashTransactionDetail` (account, accountNumber, bankAccount, debitCredit, paymentWallet, currency name, channel label, status label, amount, credit, debit, description, sourceId, tranRefNo, paymentUrl, callBackUrl) -> `BrokerageReportManager.generateCashTransactionReport(list)` -> `ReportManager.showReport`.
6. **Roles**: none. "Mark as Paid" is conditional on status only (`not isSettled`). Edit and Delete are available on every row regardless of status or user. No maker/checker on transfers.
7. **Unusual / bugs**
   - Live (menu link in `app-menues.xhtml`).
   - **Session-held state**: selected account, filters, the half-filled form, transfer mode and transfer fields all persist for the whole session and across navigation; also depends on the shared session bean `accountSearch.selectedAccount`.
   - **Transfer is not atomic** despite the on-screen text "Both accounts are updated atomically": two separate `crudService.save` calls (two EJB transactions) from a CDI bean; if the credit fails the debit is already committed.
   - **Insufficient-funds check is wrong**: only `getLedgerBalance() <= 0` is rejected; a transfer larger than the balance passes. And `getLedgerBalance()` is the sum of the rows currently loaded (date range + direction/status filters, includes PENDING rows), not the true account balance. The running "Balance" column has the same limitation (starts from 0 at the start of the filter window).
   - Copy/paste bug: `debit.setVerified(true)` is called twice; the credit leg is never marked verified.
   - Destination portfolio is marked required in the UI but not validated in `doTransfer()` (credit leg can be saved with null portfolio). Transfer `valueDate` has no default and is not reset between transfers. After a transfer the destination ledger is not refreshed (only matters if viewed).
   - `changeAccount()` does not reset `transferMode`, so a new account can open straight into the transfer panel.
   - Changing the Portfolio dropdown reloads the ledger but does not update `cashTransaction.portfolio` on the in-progress form (it keeps the portfolio from the last `newTransaction()`), so a save can post to the previously selected portfolio. Editing a row then switching portfolio has the same effect.
   - `editCashTransaction` puts the managed list row itself into the form; "Clear" discards form but in-memory edits to that row stay in the list until reload. Editing a PAID or transfer-leg row is allowed and will desync the paired leg.
   - "Clear" button is bound to a method named `clearSelectedAccount()` which actually just calls `newTransaction()`; `saveSelectedAccount()` saves the transaction (misleading names).
   - Hard-coded: default 3-month window, default portfolio `TRADING_ACCOUNT`, search-by options, "Internal transfer", arrows in descriptions.
   - Index dashboard links here with a wrong outcome (`/secured/accounts/cash-transaction`).

---

### secured/transactions/account-transaction.xhtml

1. **Kind**: full page; `template="./../appTemplate.xhtml"`. Uses `brokerage:accountSearch`, `brokerage:stats`, `brokerage:statTile`. Menu: "Transactions History > Account Transactions".
2. **Bean**: `com.statelyhub.brokerage.jsf.AccountTransactionController` - `@Named("accountTransactionController")`, `@SessionScoped`. Injects `CrudService`, `AccountSearch`, `BrokerageReportManager` (unused), `FixedIncomeReportService`. Shared: `accountSearch.*` via the composite (same members as above).
3. **Purpose**: read-only account statement - all `AccountTransaction` rows for an account, oldest first, with opening/running/closing balance and PDF print.
4. **User actions**
   - Left rail: `brokerage:accountSearch` in form `statementAccountSearch` (`rows=10`, `update=":mainContent"`) -> `selectAccount()`. When `accountSelected`: "Showing" chip (`selectedAccount.stockExchange.exchangeCode`, `accountName`, `accountCode`) with "Clear" (`immediate="true"`) -> `changeAccount()`.
   - Right side (when `accountSelected`, else empty-state text):
     - Toolbar form `statementActions`: "Reload" -> `loadAccountTransactions()`; "Print Statement" `h:commandLink target="_blank"` -> `printAccountTransactions()` (PDF, `account_statement.jasper`).
     - Stat tiles: `transactionCount`, `openingBalance`, `totalCredit` + `creditCount`, `totalDebit` + `debitCount`, `closingBalance`.
     - Form `statementTable`: From/To date pickers -> `dateRange.fromDate/toDate`; free-text box `globalFilter` (client `onkeyup="PF('statementTbl').filter()"`, placeholder "Description or reference"); "Whole History" (`rendered="#{periodApplied}"`) -> `clearPeriod()`; Search -> `loadAccountTransactions()`. Period label from `periodApplied` / `dateRange`.
     - `p:dataTable` `widgetVar="statementTbl"` over `accountTransactionsList`, `filteredValue=filteredTransactions`, `globalFilterOnly="true"`, 25 rows, paginator (25/50/100/200). Header facet "Balance brought forward" = `openingBalance` (when `periodApplied`). Columns: Date (`valueDate`, sortable); Description (`description` + "Ref `transaction`"; filterBy description+transaction); Portfolio (`portfolio`); Source data (`sourceData`); Credit (`credit`, sortable); Debit (displays `debitAmount` = abs, sortable by `debit`); Balance (`runningBalance`, transient). Footer: `transactionCount`, `totalCredit`, `totalDebit`, `closingBalance`.
   - No row actions, no edits, no dialogs.
5. **Data access and bean logic**
   - `loadAccountTransactions()`: `QryBuilder.get(em, AccountTransaction.class).addObjectParam(_account, selectedAccount).addDateRange(dateRange, _valueDate).orderByAsc(_valueDate)`.
   - `loadOpeningBalance()` (only if `fromDate` set): `QryBuilder...addReturnField("SUM(e.credit + e.debit)").addObjectParam(_account, ...).addLocalDateParam(_valueDate, fromDate, LESS_THAN).getResultAsDouble()`.
   - **Logic in bean**: `computeRunningBalances()` (opening + cumulative `getMovement()` = `credit + debit`, stored on transient `runningBalance`); `getTotalCredit()`, `getTotalDebit()` (abs), `getCreditCount()`, `getDebitCount()` (= total - credits), `getClosingBalance()` (last row's running balance or opening), `isPeriodApplied()`, `getBalanceStyle()`, `movementStyleOf()` (last two unused by the page).
   - `printAccountTransactions()` -> `FixedIncomeReportService.printAccountTransactions(list, openingBalance, dateRange)`: re-maps to `AccountTransactionDetails`, **recomputes the running balance again in the report service**, then `generateAccountStatement(...)` with params `accountName`, `accountCode`, `openingBalance`, `reportPeriod` (`BrokerageReportManager.formatPeriod`), hard-coded footnote "Figures in GHS...".
6. **Roles**: none.
7. **Unusual / bugs**
   - Live (menu link).
   - Session-held state: selected account, date range and loaded list survive navigation; relies on shared `accountSearch.selectedAccount`.
   - Sorting the table by Date/Credit/Debit makes the Balance column meaningless (balances are precomputed in ascending date order). Rows with the same `valueDate` have no secondary sort, so intra-day order (and balance) is not deterministic.
   - Statement is across all portfolios (Portfolio is only a display column) - unlike the cash page there is no portfolio filter; totals/balance mix portfolios.
   - The global filter only affects the on-screen table; tiles, footer totals and the printed statement always use the full list.
   - Footer `colspan="2"` then 3 cells does not line up with the 7 columns (Portfolio and Source columns were added later), so credit/debit/balance totals appear under the wrong columns.
   - `getDebitCount()` counts every non-credit row, including zero-value rows.
   - `brokerageReportManager` injected but unused.

---

### secured/transactions/cash-transaction-records.xhtml

1. **Kind**: full page; `template="./../appTemplate.xhtml"`. Uses `brokerage:accountSearch`. Menu: "Transactions History > Cash Transaction History".
2. **Bean**: `com.statelyhub.brokerage.jsf.accounts.CashTransactionRecordsController` - `@Named("cashTransactionRecordsController")`, `@SessionScoped`. Injects `CrudService`, `AccountSearch`, `BrokerageReportManager`. Shared: `accountSearch.*` via the composite.
3. **Purpose**: older, read-only cash transaction history by account and date range, with print. Functionally a subset of `cash/cash-transaction.xhtml`.
4. **User actions**
   - Left: panel "Account Search" with `brokerage:accountSearch` (`update="mainContent"`) -> `selectAccount()`.
   - Right, form `cashTable`: From/To date pickers -> `dateRange.fromDate/toDate`; Search `p:commandButton ajax="fales"` (sic) -> `loadSelectedCashTransaction()`; Print `h:commandLink target="_blank"` -> `printCashTransaction` (PDF, `cash_transaction.jasper`).
   - `p:dataTable` over `cashTransactionList`, scrollable 500px, **no paginator**. Columns: row toggler (expansion shows only `valueDate`); Date (`valueDate`); Account (`account.accountName`); Bank account (`bankAccount.accountName`); Description; Debit/Credit (`debitCredit`); Debit; Credit; Status (`paymentStatus`); Action column **`rendered="false"`** containing Edit -> `editCashTransaction(row)` with `update=":cashForm"` (no such form on this page).
5. **Data access and bean logic**
   - `selectAccount()`: `accountSearch.getSelectedAccount()` then load.
   - `loadSelectedCashTransaction()`: `QryBuilder.get(em, CashTransaction.class).addObjectParamWhenNotNull(_account, selectedAccount).addDateRange(dateRange, _valueDate)` - no ordering.
   - `printCashTransaction()`: maps to `CashTransactionDetail` (account, bankAccount, debitCredit, amount, credit, debit, description only - fewer fields than the newer page) -> `BrokerageReportManager.generateCashTransactionReport(list)`.
   - Unused by the page: `deleteCashTransaction(row)` (`crudService.delete`), `clearSelectedAccount()` (`JsfUtil.resetViewRoot()`), `editCashTransaction` (hidden column).
   - No calculations or status transitions.
6. **Roles**: none. Edit column is permanently hidden with a literal `rendered="false"` (not a role check).
7. **Unusual / bugs**
   - Live (menu link) but redundant with `cash/cash-transaction.xhtml`; candidate to merge rather than migrate separately.
   - If Search is pressed with no account selected, the query has no account filter and returns **every cash transaction in the system** for the date range (or all of them if no dates), unpaginated.
   - No way to clear the selected account; no indication on screen of which account is selected (session-held).
   - `ajax="fales"` typo (evaluates to non-ajax).
   - No result ordering.

---

### secured/transactions/fi-transaction-history.xhtml

1. **Kind**: full page; `template="./../appTemplate.xhtml"`. Page title is "Trades" (menu label "FixedIncome Trans. History"). Declares the `brokerage` composite namespace but uses none.
2. **Bean**: `com.statelyhub.brokerage.jsf.equities.FixedIncomeTransactionHistoryController` - `@Named("fixedIncomeTransactionHistoryController")`, `@SessionScoped`. Injects `CrudService`, `FixedIncomeReportService`.
3. **Purpose**: list fixed-income transactions (all accounts) by value-date range and print them.
4. **User actions**
   - Filter form: From/To date pickers -> `dateRange.fromDate/toDate`; Search `p:commandButton ajax="fales"` (sic) -> `loadTrades()`; Print `h:commandLink target="_blank"` -> `printTradeReport()` (PDF, `fixed_income_transaction.jasper`); Clear (`ajax="false"`) -> `clearTrade()`.
   - `p:dataTable` (form `tradeTable`) over `tradesList`, 10 rows, paginator. Columns: row toggler (expansion shows only `trade.id`, with a stray `>` character); Account (`account.accountName`); Type (`assetSubClass.label`); Trans date (`valueDate`); Interest rate (`interestRate`, formatted with the money pattern); Face value (`faceValue`); Maturity value (`maturityValue`); Maturity date (`maturityDate`).
   - No account filter, no row actions.
5. **Data access and logic**
   - `loadTrades()`: `QryBuilder.get(em, FixedIncomeTransaction.class).addDateRange(dateRange, _valueDate).orderByAsc(_valueDate)`.
   - `clearTrade()`: empties the list (does not reset `dateRange`).
   - `printTradeReport()` -> `FixedIncomeReportService.transactions(tradesList)` -> `toDetail()` per row -> `generateFixedIncomeTrasactionOrder` (title "Fixed Income Transaction Report").
   - `printTransactionReport()` (used by `report/reports.xhtml`) -> `FixedIncomeReportService.runningTransaction(tradesList, LocalDate.now())`: per row `toDetail()`, `incomeService.calculateAccudInterest(tx, valueDate)`, `marketValue = accrued + faceValue`; report `transactions.jasper`, title "Runing Fixed Income Transactions".
   - Logic to note in `FixedIncomeReportService.toDetail()`: `interestAmount = maturityValue - faceValue`; for `isSimpleTransaction()` the instrument label is `tenor.code + " - " + assetSubClass`; **hard-coded placeholders `details.setDaysRun(91)` and `details.setAccruedInterest(23000)`** (comment: "Please kindly help with how i could get the days run here").
6. **Roles**: none.
7. **Unusual / bugs**
   - Live (menu link).
   - Session-scoped; `tradesList` is null until the first Search (table empty; Print gives "No records to print" in a new tab). List then persists for the session and is reused by the Reports page.
   - With no dates, Search loads every fixed-income transaction, including unauthorised ones (no `authorised` filter).
   - Hard-coded 91 days / 23000 accrued interest go into the printed report DTOs.
   - `ajax="fales"` typo; `update="@form"` on a non-ajax button is a no-op.

---

### secured/report/reports.xhtml

1. **Kind**: full page; `template="./../appTemplate.xhtml"`. Top-level menu item "Reports".
2. **Bean**: borrows `fixedIncomeTransactionHistoryController` (`@SessionScoped`, see above). The dedicated `com.statelyhub.brokerage.reports.ReportsController` (`@Named("reportsController")`, `@SessionScoped`) is **not referenced by this or any page**.
3. **Purpose**: reports launcher - currently a single link, "Running Investment".
4. **User actions**: one `h:commandLink target="_blank"` "Running Investment" -> `fixedIncomeTransactionHistoryController.printTransactionReport()`. No parameters, no date input, no other reports.
5. **Data access and logic**
   - As wired: `FixedIncomeReportService.runningTransaction(tradesList, LocalDate.now())` over whatever list the user last searched on `fi-transaction-history.xhtml` (see that page for the calculation).
   - Intended but unwired: `ReportsController.reportRunningFixedIncome()` -> `FixedIncomeService.getRunningTransactionByDate_all(dateRange.toDate)` (JPQL: `SELECT e FROM FixedIncomeTransaction e WHERE (e.authorised = TRUE AND e.valueDate <= :valueDate AND e.maturityDate > :valueDate) AND (e.transferredDate IS NULL OR e.transferredDate <= :valueDate) ORDER BY e.assetSubClass, e.valueDate DESC`) -> `reportService.runningTransaction(list, toDate)`. `ReportsController.dateRange` defaults to `(null, today)` and has no getter/setter exposure in the page.
6. **Roles**: none.
7. **Unusual / bugs**
   - Live (menu link) but effectively broken: the report content depends on hidden session state from another page. Fresh session -> `tradesList == null` -> "No records to print" in a blank tab. After a search on the FI history page it prints that arbitrary date-range result as "running investments" (not filtered to authorised/unmatured positions).
   - `ReportsController` is dead code holding the correct query; the migration should implement "Running Investment" from `getRunningTransactionByDate_all` with an as-at date parameter.
   - Same hard-coded `daysRun = 91` / `accruedInterest = 23000` placeholders flow through `toDetail()` (accrued interest is then overwritten via `setAccrudInterest`, a differently named field, so both values exist on the DTO).

---

## Module: accounts

Scope: 13 xhtml files under `secured/accounts/` and their backing beans. All 13 pages and all beans listed below were read in full (nothing unreadable). CashTransactionController / CashTransactionRecordsController intentionally not covered (other agent).

Facts common to every page in this module:
- All 13 are full pages using template `secured/appTemplate.xhtml` (`template="./../appTemplate.xhtml"`), defining `pageTitle`, `pageContent` and (new-style pages only) `pageSubTitle`, `pageActions`. None is included via `ui:include` anywhere in the webapp (grep for `ui:include` + `accounts/` returns nothing).
- No page contains any role/permission/user-type check (`rendered`/`disabled` on roles, `userSession`, `navHelper` are not referenced at all in this folder). Access control, if any, is outside these pages. The only shared beans used are `commonOptions` (dropdown sources, listed per page) and the `msg` resource bundle (`msg.date_pattern_1`, `msg.money_format`, `msg.date_picker_year_range`, labels).
- No polling, push or timers anywhere in the module.
- All beans except `InvestorUploadController` (@ViewScoped) are **@SessionScoped**; the "list vs. edit form" mode of each page is a session-held nullable entity (`bean.account == null` -> list, else form). State therefore survives navigation away and back, and is shared across browser tabs.
- Data access is done directly in the beans through `CrudService` (`crudService.getEm()`, `save`, `delete`, `find`, `findBySingleField`, `generateId`) and the in-house `QryBuilder` fluent JPQL builder. No named queries / raw JPQL strings in these beans, except `SUM(...)` return fields inside `PortfolioService`.
- Lists are loaded whole into memory (`@PostConstruct`, once per session) and paginated/filtered client-side by PrimeFaces; there is no server-side paging.
- Menu: live sidebar is `secured/menus/app-menues.xhtml` (included by appTemplate). `app-menues-old.xhtml` is not included anywhere. Live menu "Accounts" entries: investors, investor-upload, incomplete-kycs, investor-verification, account, account-portfolio, beneficiary, investor-risks-assessments, account-utilities. Dashboard `secured/index.xhtml` also links (`h:link outcome`) to `investor-verification` (line 195) and `incomplete-kycs` (line 205).
- **Dead / unreferenced pages: `account_2.xhtml`, `investors_1.xhtml`, `account-investor.xhtml`, `account-overview.xhtml`** (no menu link, include, or navigation outcome anywhere in `src/main/webapp` or `src/main/java`; still reachable by typing the URL). The old menu also links a non-existent `accounts/account-listing.xhtml`.

Shared composite components used by this module (`src/main/webapp/resources/brokerage/`, namespace `brokerage:`), read in full:
- `investorSearch.xhtml` -> bean `InvestorSearch` (`@Named investorSearch`, @SessionScoped, `jsf/accounts/InvestorSearch.java`). UI: text input `investorSearch.searchText`; plain `h:selectOneMenu` `investorSearch.searchField` with hard-coded options `surname | othernames | investorName | emailAddress`; Search button -> `investorSearch.searchInvestor()` (ajax, process `searchPanel`, update results). Results table (`investorSearch.investorsList`, paginator, rows attr default 8) with rowToggler expansion (investorName, surname, othernames, emailAddress, id), column Investor Name as `p:commandLink` that does `f:setPropertyActionListener` -> `investorSearch.selectedInvestor` then calls the page-supplied `selectAction`; column Email (filterBy, contains). Hidden (`rendered="false"`) columns: Surname link and an "X" delete link -> `investorSearch.deleteInvestor(investor)` (stub: always reports failure). Attributes: `ajax`, `rows`, `update`, `selectAction`, `otherAction` (unused).
  - `InvestorSearch.searchInvestor()`: returns silently on empty text; `QryBuilder.get(em, Investor.class).addStringQryParam(searchField, searchText, LIKE).buildQry().getResultList()`. The field name comes straight from the client-posted value (no whitelist). Message says "at least 3 characters" but the check is `length() < 1` (dead check). Other methods: `addInvestor`, `remove`, `clear()` (calls `JsfUtil.resetViewRoot()`), `selectInvestor` (empty), `addSelectedInvestor`, `deleteInvestor` (stub), `investorQP` (unused). Selected investor and last result list are session-held and shared by every page using the composite (account, beneficiary, risk assessment, account utilities).
- `accountSearch.xhtml` -> bean `AccountSearch` (`@Named accountSearch`, @SessionScoped, `jsf/AccountSearch.java`). UI: `accountSearch.searchText`; `accountSearch.searchField` with hard-coded options `accountCode | accountName`; Search -> `accountSearch.searchAccount()`. Results table (`accountSearch.accountsList`) with rowToggler expansion (depositoryCode, accountName, accountType, stockExchange, principalInvestor, id); columns Account Code and Account Name as commandLinks (set `accountSearch.selectedAccount`, then call `selectAction`), both filterBy contains; hidden columns (depository code, account type, stock exchange, principal investor); a **visible** red "X" column -> `accountSearch.deleteAccount(account)` which is a stub (`deleted = false; JsfMsg.msg(false)` -> always shows a failure message; non-ajax `h:commandLink`).
  - `AccountSearch.searchAccount()`: empty-text guard is commented out, so an empty search does `LIKE` on empty text (returns everything) and a null `searchText` throws NPE on `trim()` (caught -> "error in searching for account"). `QryBuilder.get(em, Account.class).addStringQryParam(searchField, searchText, LIKE).printQryInfo()`. Same un-whitelisted field name. Other methods as InvestorSearch (`addAccount`, `remove`, `clear`, `selectAccount` empty, `addSelectedAccount`, `accountQP`).
- `investorList.xhtml` (no bean of its own): investor register table. Attributes `value`, `filteredValue`, `rows`(10), `widgetVar`, `update`, `showSearch`, `showExpansion`, `searchPlaceholder`, `emptyMessage`, `selected`, `editAction`, `editLabel`, `editIcon`, `editAjax`, `deleteAction`. Global keyword filter input (`globalFilter`, `onkeyup PF(widgetVar).filter()`, `globalFilterOnly="true"`), "Showing X of Y investors" counter, rowToggler expansion rendering `brokerage:investor` (read-only investor detail card: Personal, Contact, Identification, Employment/Financial, Alerts, Verification). Columns: Investor (avatar initials, "surname, firstName othernames", investorCode, email; sortable by surname; filter on surname/firstName/othernames/email/investorCode), Contact (mobilePhone, residentialCountry; filter mobilePhone), Identification (validId.label tag, idNumber; filter idNumber), Registration Date (sortable; sub-line "Verified by X" / "Awaiting review"), Status pill (`investor.status` / `investor.statusStyle`; sortable, filterable), Action column (only if edit/delete action supplied): edit button (icon or labelled) and delete button with `p:confirm`, each first writing the row into `cc.attrs.selected` via `f:setPropertyActionListener` then invoking the no-arg action.
  - Entity-derived display logic to reproduce: `Investor.getStatus()` = "Verified" if `bioDataVerified`, else "Pending" if `bioDataCompleted`, else "Incomplete"; `getStatusStyle()` = is-ok / is-warn / is-bad; `getInitials()`, `getDisplayName()`; `Account.isMultiHolder()` = accountType JOINT or ITF; `Account.getTypeStyle()`.
- `stats.xhtml` / `statTile.xhtml`: presentational summary tiles (label, value, pattern, tone, foot facet).

---

### secured/accounts/account.xhtml

1. Kind: full page, template `appTemplate.xhtml`. In live menu ("Account"). Two modes in one page: list view and open/edit view.
2. Beans: `AccountController` (`@Named accountController`, @SessionScoped); `InvestorSearch` (`investorSearch`, @SessionScoped) via `brokerage:investorSearch`; `commonOptions`.
3. Purpose: maintain trading accounts (create/edit/delete), pick the principal investor by search, manage co-holders for Joint/ITF accounts, show linked-record counts.
4. User actions
   - Page actions (only when `accountController.account == null`), form `accountActions`:
     - "Load" (non-ajax) -> `accountController.loadAccounts()`.
     - "Print" `h:commandLink target="_blank"` -> `accountController.printAccounts()` (**stub**: only `System.out.println`; opens a blank tab, no report).
     - "Add New Account" (non-ajax) -> `accountController.newAccount()`.
   - LIST VIEW (`account == null`):
     - 4 clickable summary tiles (JS `stFilterAccounts(term)` writes the term into the global filter input and calls `PF('accountsTable').filter()`): Total (`totalCount`, term ''), Individual (`individualCount`, 'INDIVIDUAL'), Corporate (`corporateCount`, 'CORPORATE'), Joint & ITF (`jointItfCount`, term 'JOINT' - so ITF accounts are counted but not shown by the tile's filter: bug).
     - `p:dataTable accountsTbl` (`accountsList`, `filteredValue=filteredAccounts`, `globalFilterOnly`, 10 rows, paginator bottom). Header: global search input ("Search account code, depository code, name or investor") + "Showing `shownCount` of `totalCount` accounts".
     - Row expansion (rowToggler): accountCode, depositoryCode, accountName, accountType, classification, stockExchange.exchangeName, principalInvestor.investorName, valueDate ("Opened").
     - Columns: Account (avatar = stockExchange.exchangeCode, accountCode, accountName; sortable by accountCode; filter on code+name), Depository Code (sort/filter), Account Type pill (`account.typeStyle`; sort/filter), Classification (sort/filter), Stock Exchange name, Principal Investor name (filter), Action.
     - Row actions: pencil -> `accountController.editAccount(account)` (ajax, update `:mainContent`); trash -> `accountController.deleteAccount(account)` with `p:confirm` ("Delete account {code} - {name}? This cannot be undone.") and a global `p:confirmDialog`.
   - OPEN / EDIT VIEW (`account != null`):
     - Header: account name or "Add New Account"; account code or "... is generated when you save"; account-type pill.
     - Header "Delete" button (form `accountHeadActions`): `rendered` when `account.id` not empty; `disabled="#{accountController.deleteBlocked}"`; title = `deleteBlockedReason`; -> `accountController.deleteAccount(accountController.account)` with `p:confirm`.
     - Column 1 "Principal Investor" card: `brokerage:investorSearch selectAction="#{accountController.selectPrincipalInvestor()}" rows="8" update=":mainContent"` (search text, search-by dropdown, Search button -> `investorSearch.searchInvestor()`, click a name to select).
     - Form `accountForm` with `p:messages formMessages`:
       - Account Code (readonly, "Generated on save"); Opening Date* `p:datePicker` -> `account.valueDate` (required); Account Name* (required; prefilled from investor); Depository Code* (required); Credit Limit* (required, plain inputText bound to `account.creditLimit`); Stock Exchange* `selectOneMenu` <- `commonOptions.stockExchangesList` (filterable); Account Type* <- `commonOptions.accountTypeList` with `p:ajax update="ownership" process="@this"`; Classification* <- `commonOptions.investorAccountTypeList`.
       - Ownership card (`id="ownership"`): picked principal investor (initials, displayName, email / "No email on file") with "Clear" button (immediate, ajax) -> `accountController.changePrincipalInvestor()`; or placeholder "No investor selected" when `not accountController.investorSelected`.
       - Additional Holders: if `not account.multiHolder` -> note "This account type has one holder..."; if `account.multiHolder` -> table `accountController.holders` (Investor name, ID Number, trash button -> `accountController.removeHolder(holder)` with `p:confirm`), plus `selectOneMenu` `accountController.newHolder` <- `commonOptions.investorsList` (entire investor list as dropdown) and "Add holder" -> `accountController.addHolder()`; hint "Save the account first, then add its co-holders" when multiHolder and no id.
       - Linked Records card (only when `account.id` set): tiles from map `accountController.references['Co-holders' | 'Orders' | 'Cash transactions' | 'Payment wallets' | 'Holdings']`; note "Delete is disabled - this account still has {deleteBlockedReason}" when `deleteBlocked`.
       - Sticky action bar: "Close" (immediate, ajax) -> `accountController.resetPage()`; "Clear" (immediate, non-ajax) -> `accountController.clearAccount()`; "Save" (ajax, update `:mainContent`) -> `accountController.saveAccount()`.
       - Second global `p:confirmDialog` (Close / Yes) inside this form.
5. Bean -> services / queries
   - `loadAccounts()` (@PostConstruct, also the Load button): `QryBuilder.get(em, Account.class).orderByDesc(Account._accountCode)` - all accounts.
   - `editAccount(a)`: sets account, `loadHolders()` = `QryBuilder.get(em, AccountInvestor.class).addObjectParam(AccountInvestor._account, account)`; `AccountService.accountReferences(account)` (counts of AccountInvestor, Order, CashTransaction, PaymentWallet, AssetValuation rows by account via `QryBuilder...count()`).
   - `saveAccount()`: `QryBuilder.get(em, Account.class).addObjectParam(_principalInvestor, ..).addObjectParamNotEqual(_accountType, ITF).addObjectParamNotEqual(_accountType, JOINT).getSingleResult(Account.class)`; `SingletonIdService.initAccountId(account)`; `CrudService.save(account)`; `AccountService.accountReferences`.
   - `deleteAccount(a)`: `AccountService.deleteAccount(account)` (returns a problem string or null; refuses if `deleteBlockedBy` finds Orders / Cash transactions / Payment wallets / Holdings; bulk-deletes AccountInvestor rows then deletes the account).
   - `addHolder()`: `CrudService.save(new AccountInvestor(account, newHolder))`. `removeHolder(h)`: `CrudService.delete(h)`.
   - **Business logic in the bean (must move server-side):**
     - `saveAccount()` validation: principal investor required ("Search for and select the principal investor first"); uniqueness rule "Principal Investor is already associated with an individual/corporate account" - **bug: the check does not exclude the account being edited, so re-saving any existing INDIVIDUAL/CORPORATE account is rejected (it finds itself), and it also blocks creating a JOINT/ITF account for an investor who already has an individual account**; `getSingleResult` may misbehave if several match. Defaults `valueDate` to today.
     - Account code generation: `SingletonIdService.initAccountId` = `yyMMdd` of opening date + 3-digit zero-padded (count of accounts with that valueDate + 1); only when code is empty. Count-based -> can collide after deletes or concurrent saves.
     - `selectPrincipalInvestor()`: auto-names the account from `selected.getDisplayName()` if the name is blank. `changePrincipalInvestor()`: clears the name only if it still equals the previous investor's display name.
     - `addHolder()` validation: holder selected; account must be saved; holder != principal; no duplicate holder.
     - `isDeleteBlocked()` / `getDeleteBlockedReason()`: derived from the `references` map, ignoring "Co-holders" (duplicate of `AccountService.deleteBlockedBy`).
     - Summary counts (`getTotalCount`, `getIndividualCount`, `getCorporateCount`, `getJointItfCount`, `getShownCount`) computed by looping the in-memory list.
6. Role/permission checks: none. Only state-based conditions: Delete `rendered` when persisted, `disabled` when linked records exist; holders UI only for JOINT/ITF.
7. Unusual
   - Session-held state: `account`, `holders`, `newHolder`, `references`, whole `accountsList`, `filteredAccounts`; and the shared `investorSearch.selectedInvestor` / result list (shared with beneficiary, risk-assessment and account-utilities pages - a selection/search made on one page is visible on the others).
   - Accounts list is loaded once per session; other users' changes only appear after "Load".
   - Row delete in the list is not disabled for blocked accounts (server refuses with a message instead).
   - `printAccounts()` is a no-op stub behind a visible Print link.
   - Two global `p:confirmDialog`s are declared (one per mode); only one renders at a time.
   - "Clear" in edit mode calls `newAccount()` - it discards the account being edited and starts a new one (not a field reset).
   - `creditLimit` has no number converter/format on the input.
   - Hard-coded reference-map keys ('Co-holders', 'Orders', ...) shared between `AccountService` and the page.

### secured/accounts/account_2.xhtml

1. Kind: full page, template `appTemplate.xhtml`. **Dead copy** (older version of account.xhtml): not in any menu, not included, no navigation outcome references it.
2. Beans: `AccountController` (`accountController`, @SessionScoped); `commonOptions`.
3. Purpose: legacy single-screen account form + list (form always shown above the table).
4. User actions
   - Form `accountForm`: Depository Code, Account Name, Account Type <- `commonOptions.accountTypeList`, Account Investor Type -> `account.accountInvestorType` <- `commonOptions.investorAccountTypeList`, Stock Exchange <- `commonOptions.stockExchangesList`, Principal Investor `selectOneMenu` <- `commonOptions.investorsList` (dropdown instead of search). No required validators.
   - "Save" -> `accountController.saveAccount()`; "Clear" (immediate, non-ajax) -> `accountController.clearAccount()`. "Close" -> `resetPage()` is inside `ui:remove`.
   - "Load" -> `accountController.loadAccounts()` (`ajax="fales"` typo). Print link and "Add New Stock Exchange" button are inside `ui:remove`.
   - Table `accountTable` (`accountsList`, 10 rows): Depository Code, Account Name, Account Type, Stock Exchange, Principal Investor, Edit -> `accountController.editAccount(account)`, Delete -> `accountController.deleteAccount(account)` with JS `confirm('Are You Sure ?')`.
5. Same bean methods as account.xhtml (see above).
6. Role checks: none.
7. Unusual: **broken as written** - binds `account.accountInvestorType`, which no longer exists on the `Account` entity (replaced by `classification`; verified - no such getter), so the page throws on render; the form binds to `accountController.account`, which is null until New/Edit is invoked, so the page fails or shows an unusable form on first load. No opening date / credit limit / co-holder UI. Do not migrate.

### secured/accounts/account-investor.xhtml

1. Kind: full page, template `appTemplate.xhtml`. **Unreferenced/dead**: not in the live or old menu, no includes or outcomes. Superseded by the co-holder panel in account.xhtml.
2. Beans: `AccountInvestorController` (`accountInvestorController`, @SessionScoped); `commonOptions`.
3. Purpose: raw CRUD over the AccountInvestor link table (account <-> additional investor).
4. User actions
   - Form `accountInvestorForm`: Account `selectOneMenu` -> `accountInvestor.account` <- `commonOptions.accountsList`; Investor -> `accountInvestor.investor` <- `commonOptions.investorsList` (both filterable, no required flag).
   - "Save" -> `accountInvestorController.saveAccountInvestor()`; "Clear" (immediate, non-ajax) -> `clearAccountInvestor()`; "Close" -> `resetPage()` in `ui:remove`.
   - "Load" -> `accountInvestorController.loadAccountInvestors()`; Print (`printAccountInvestors()`, stub) and an "Add New" button are in `ui:remove`.
   - Table `accountInvestorTable` (`accountInvestorsList`, 10 rows): Account name, Investor name, Edit -> `editAccountInvestor(accountInvestor)`, Delete -> `deleteAccountInvestor(accountInvestor)` with JS confirm.
5. `loadAccountInvestors()` (@PostConstruct): `QryBuilder.get(em, AccountInvestor.class)` (all rows); `CrudService.save` / `CrudService.delete`. No validation at all (none of the duplicate / principal checks that `AccountController.addHolder()` enforces; null account/investor accepted).
6. Role checks: none.
7. Unusual: session-held `accountInvestor`; label typo `ajax="fales"`. Recommend dropping in favour of the account page's co-holder feature.

### secured/accounts/account-overview.xhtml

1. Kind: full page, template `appTemplate.xhtml`. **Unreferenced/dead** (no menu entry in live or old menu, no includes/outcomes). Superseded by account-portfolio.xhtml.
2. Beans: `AccountOverviewController` (`accountOverviewController`, @SessionScoped); `AccountSearch` (`accountSearch`, @SessionScoped) via `brokerage:accountSearch`.
3. Purpose: read-only overview of one account in three tabs - cash transactions, trades, investor bank accounts.
4. User actions
   - Left panel: `brokerage:accountSearch selectAction="#{accountOverviewController.selectAccount()}" update="mainContent"` (search text, search by code/name, Search -> `accountSearch.searchAccount()`, click code/name to select; visible "X" -> `accountSearch.deleteAccount` stub).
   - "Selected Account" label -> `selectedAccount.accountName`.
   - `p:tabView activeIndex="#{accountOverviewController.selectedTabIndex}"` with `p:ajax event="tabChange" listener="#{accountOverviewController.onTabChange}"`.
   - Tab "Cash Transactions": table `cashTransactionsList` (scrollable, 300px; expansion shows valueDate) - Bank Account name, Description, Debit/Credit, Debit, Credit (money format), "View" -> `viewCashTransaction(cashTransaction)` (non-ajax). Detail panel (when `cashTransaction` not empty): bank account, account, description, debitCredit.fullString, amount, credit, debit; "Close" -> `resetCashTransaction()`.
   - Tab "Trades": table `tradesList` (expansion: id) - Account, Trade Order no (`trade.tradeOrder.orderNo`), Stock, Buy/Sell, Order Type, Quantity, Trade Price, Consideration, Other Charges, Brokerage Commission, Net Consideration, "View" -> `viewTrade(trade)`. Detail panel with the same fields; "Close" -> `resetTrade()`.
   - Tab "Investor Bank Accounts": table `investorBankAccountsList` (expansion: id) - Investor, Bank, Bank Branch, Account Name, Account No (`accountNo`), Active Status checkbox (disabled), "View" -> `viewInvestorBankAccount(..)`. Detail panel; "Close" -> `resetInvestorBankAccount()`.
5. Bean queries: `selectAccount()` reads `accountSearch.getSelectedAccount()` then `loadCashTransactions()` = `QryBuilder.get(em, CashTransaction.class).addObjectParam(CashTransaction._account, selectedAccount)`; `loadTrades()` = `QryBuilder.get(em, EquityTransaction.class).addObjectParam(EquityTransaction._account, ..)`; `loadInvestorBankAccounts()` = `QryBuilder.get(em, InvestorBankAccount.class).addObjectParam(_investor, selectedAccount.getPrincipalInvestor())`. No ordering, no date limits. No business logic.
6. Role checks: none.
7. Unusual / bugs: session-held selected account, lists, selected detail rows and tab index. Stray `>` after `h:outputText` in two expansions; stray `<!--</ui:remove>-->` comments; the first table's `p:rowToggler` is not inside a `p:column`; detail panel binds a boolean checkbox to `investorBankAccount.accountNo` (labelled "Account No" twice - copy/paste bug); uses `investorBankAccount.accountNo` (correct; account-portfolio uses the non-existent `accountNumber`); `span styleClass=` is not valid HTML. Do not migrate separately - fold into the portfolio page if the detail views are wanted.

### secured/accounts/account-portfolio.xhtml

1. Kind: full page, template `appTemplate.xhtml`. In live menu ("Account Portfolio").
2. Beans: `AccountPortfolioController` (`accountPortfolioController`, @SessionScoped); `AccountSearch` (`accountSearch`, @SessionScoped) via `brokerage:accountSearch`; `commonOptions`.
3. Purpose: valuation dashboard for one client account as at today - holdings (equity, fixed income), cash and pending settlement, investor/bank details, filterable trade history, and PDF statements.
4. User actions
   - No account selected (`not accountSelected`): `brokerage:accountSearch selectAction="#{accountPortfolioController.selectAccount()}" rows="10" update=":mainContent"`.
   - Account selected - toolbar form `portfolioActions`:
     - "Change Account" (ajax) -> `accountPortfolioController.changeAccount()`.
     - "Portfolio Statement" `h:commandLink target="_blank"` -> `printPortfolioStatement()` (report).
     - "Print Trades Report" `h:commandLink target="_blank"` -> `printAccountTrades()` (report).
   - Identity strip: exchange code avatar, account name, account code, depository code, exchange name, account type and classification pills, principal investor displayName + email, "Valued as at" `portfolio.valueDate`.
   - Summary tiles (`brokerage:stats`/`statTile`): Portfolio Value (`portfolio.portfolioValue`), Equities (`portfolio.equityValue`, `stockCount`, `equityPercent`), Fixed Income (`portfolio.fixedIncomeValue`, `fixedIncomeCount`, `fixedIncomePercent`), Cash Balance (`portfolio.cashBalance`, `cashPercent`), Pending Settlement (`pendingSettlement`).
   - Equity Holdings card: unrealised gain (`equityGain`, `equityGainPercent`, css `equityGainStyle` up/down); allocation bar + legend driven by `equityPercent` / `fixedIncomePercent` / `cashPercent`; table `equityHoldings` (var holding): Stock symbol (title stockName), Shares (`quantity`), Avg Cost (`averageCost`), Market Price, Market Value, Gain/Loss (`gain`, `gainPercent`, `gainStyle`), Weight (`accountPortfolioController.percentOfPortfolio(holding.marketValue)`); footer row: stock count, `portfolio.equityValue`, `equityGain`, `equityPercent`.
   - Fixed Income Holdings card: table `fixedIncomeHoldings` (var fiHolding): Security name, Value Date, Rate (`interestRate`), Face Value (`amount`), Accrued Interest (`accrudInterest`), Value (`marketValue`); footer: count, `fixedIncomeFaceValue`, `fixedIncomeAccruedInterest`, `portfolio.fixedIncomeValue`.
   - Cash & Settlement card: Ledger balance (`portfolio.cashBalance`), Purchases awaiting settlement (`pendingSettlement`), Available after settlement (`availableAfterSettlement`). "Recent cash movements" table `cashTransactionsList` (`rows="5"`, no paginator): Date (`transDate`), Description, Amount. Link "Print all cash transactions" (`target="_blank"`) -> `printCashTransactions()` (report).
   - Investor & Settlement Bank card: investor displayName, mobilePhone + email, postal address; table `investorBankAccountsList`: Bank name, Account (`accountNumber`).
   - Trade History form `tradeHistoryForm`: filters Side `selectOneMenu` -> `buySell` <- `commonOptions.buySellList` (All = null); Stock -> `stock` <- `commonOptions.stocksList` (filterable; All = null); From / To `p:datePicker` -> `dateRange.fromDate` / `dateRange.toDate`; "Search" (non-ajax) -> `loadTrades()`; second "Print Trades Report" link -> `printAccountTrades()`.
     - Counter: `tradeCount` trades, `buyCount` buys, `sellCount` sells.
     - Table `tradeHistoryTbl` (`tradesList`, `filteredValue=filteredTrades`, 15 rows, rowsPerPage 15/30/50/100): Trade Date (`valueDate`, sortable), Buy/Sell (`sideStyle`, sortable), Equity (symbol, sortable), Settlement Date (`accountPortfolioController.settlementDateOf(trade)`), No. of Shares (sortable), Unit Price (sortable), Trade Consideration (sortable), Broker Commission, Other Charges, Net Consideration (sortable). Footer rows: Buys (`buyCount`, `buyQuantity`, `buyConsideration`, `buyCommission`, `buyOtherCharges`, `buyNet`) and Sells (`sellCount`, `sellQuantity`, `sellConsideration`, `sellCommission`, `sellOtherCharges`, `sellNet`).
5. Bean -> services / queries
   - `selectAccount()`: reads `accountSearch.getSelectedAccount()`; sets default date range = first day of the month three months back .. today; then `loadPortfolio()`, `loadTrades()`, `loadCashTransactions()`, `loadAccountTransactions()`, `loadInvestorBankAccounts()`.
   - `loadPortfolio()`: `PortfolioService.getPortfolio(selectedAccount, LocalDate.now())` (@Stateless; cash balance = `SUM(e.credit + e.debit)` over AccountTransaction for the account; equity holdings valued FIFO via `StockReturnsValuator`; fixed-income holdings with accrued interest; `portfolio.summarise()`).
   - `loadTrades()`: `QryBuilder.get(em, EquityTransaction.class).addObjectParam(_account, ..).addDateRange(dateRange, EquityTransaction._valueDate)` + optional `_buySell`, `_stock`; `orderByDesc(_valueDate)`.
   - `loadCashTransactions()`: `QryBuilder.get(em, CashTransaction.class).addObjectParam(_account, ..)` - **no ordering and no limit**; the page just shows the first 5 rows of an unordered full list labelled "Recent cash movements".
   - `loadAccountTransactions()`: `QryBuilder.get(em, AccountTransaction.class).addObjectParam(_account, ..)` - loaded but never displayed on this page.
   - `loadInvestorBankAccounts()`: `QryBuilder.get(em, InvestorBankAccount.class).addObjectParam(_investor, principalInvestor)`.
   - `getPendingSettlement()`: `PortfolioService.investmentPendingOut(selectedAccount)` = `SUM(e.estimatedExecutionCost - e.actualExecutedCost)` over EquityOrder where buySell = BUY and orderStatus in `OrderStatus.workingOrders`. **Bug: the `.addObjectParam(EquityOrder._account, account)` filter is commented out in the service, so the figure is across ALL accounts, not the selected one.** It is also a getter that hits the DB and is evaluated several times per render (tile, ledger row, `availableAfterSettlement`).
   - Reports: `printAccountTrades()` -> `BrokerageReportManager.generateAccountTradesReport(selectedAccount, tradesList, dateRange)` (guards: account selected, trades not empty); `printPortfolioStatement()` -> `BrokerageReportManager.generatePortflio(portfolio)` (Jasper file `BrokerageReportFiles.portfolio_statement`, param `reportPeriod`; report title is wrongly "Fixed Income Transaction Report"); `printCashTransactions()` -> `FixedIncomeReportService.printCashTransactions(cashTransactionsList)`. Reports are streamed to the new tab via `showReportNow` (PDF). No Excel export.
   - Bean methods with no UI on this page: `printAccountTransactions()` (`FixedIncomeReportService.printAccountTransactions`), `printEquityTransactions()` (`FixedIncomeReportService.printEquityTransactions`), `viewCashTransaction/viewAccountTransaction/viewInvestorBankAccount/viewTrade` and the matching `reset*` methods (leftovers from the overview page).
   - **Business logic / calculations in the bean (move server-side or to a DTO):** `getEquityBookCost()` (sum of holding book cost), `getEquityGain()` = equityValue - bookCost, `getEquityGainPercent()`, `getEquityGainStyle()`, `percentOfPortfolio(v)` = v / portfolioValue * 100, `getEquityPercent / getFixedIncomePercent / getCashPercent`, `getFixedIncomeFaceValue()`, `getFixedIncomeAccruedInterest()`, `getAvailableAfterSettlement()` = cashBalance - pendingSettlement, trade aggregates via `sumTrades(side, field)` (quantity, consideration, commission, other, net per BUY/SELL), `getBuyCount / getSellCount` (sell = total - buys), and `settlementDateOf(trade)` = trade valueDate + `stockExchange.settlementPeriod` **calendar** days (account's exchange first, else the stock's exchange; no business-day/holiday handling).
6. Role checks: none.
7. Unusual
   - Session-held: selected account, portfolio snapshot, all lists, filters (`dateRange`, `buySell`, `stock`); plus shared `accountSearch` state. Portfolio is valued once at selection time and stays stale until the account is re-selected (there is no refresh button; "Search" only reloads trades).
   - Valuation date is hard-coded to `LocalDate.now()`; default trade window hard-coded to ~3 months.
   - Trade footer totals are computed over the full `tradesList`, not the table's filtered rows.
   - "Print Trades Report" appears twice (toolbar and trade filter bar); the toolbar copy sits in a different form, so it prints the last *searched* list, not unsubmitted filter values.
   - The visible red "X" column of `brokerage:accountSearch` (stub delete) appears on this page's search step.
   - Allocation bar widths are inline CSS percentages straight from bean doubles.
   - **Live bug:** the settlement bank table binds `#{investorBankAccount.accountNumber}`, but `InvestorBankAccount` only has `accountNo` (verified: no `getAccountNumber`). The page will throw a PropertyNotFoundException for any account whose principal investor has a bank account on file.
   - `Account.creditLimit` is a String on the entity.

### secured/accounts/account-utilities.xhtml

1. Kind: full page, template `appTemplate.xhtml`. In live menu ("Account Utilities").
2. Beans: `AccountUtilitiesController` (`accountUtilitiesController`, @SessionScoped); `InvestorSearch` (`investorSearch`, @SessionScoped) via `brokerage:investorSearch`.
3. Purpose: back-office reset of an investor's (client portal/mobile) login password.
4. User actions
   - Left: `brokerage:investorSearch selectAction="#{accountUtilitiesController.selectInvestor()}" update="mainContent"`.
   - Right (rendered when `selectedInvestor` not empty): "Change Password" panel - read-only Investor name, Email; `h:inputSecret` -> `accountUtilitiesController.userPassword`; "Change" (ajax) -> `accountUtilitiesController.updateUserPassword()`.
5. `selectInvestor()`: copies `investorSearch.getSelectedInvestor()`, clears password. `updateUserPassword()`: `SecurityHash.getInstance().shaHash(userPassword)` -> `selectedInvestor.setUserPassword(hash)` -> `CrudService.save(selectedInvestor)`.
   - **Business/security logic in the bean:** password hashing is done in the JSF bean with an unsalted SHA hash (`SecurityHash.shaHash`); no password policy (length/complexity), no confirmation field, no audit record of who reset it, no notification to the investor, no forced change on next login. Must become a server-side endpoint with proper hashing and auditing.
6. Role checks: none - any back-office user who can open the page can set any investor's password.
7. Unusual: bug - when `selectedInvestor == null` the method shows "Select An Investor" but does not `return`, then NPEs (caught -> "Password Update Failed"). Session-held selected investor. Page title says "Account Utilities" but only one utility exists.

### secured/accounts/beneficiary.xhtml

1. Kind: full page, template `appTemplate.xhtml`. In live menu ("Beneficiary").
2. Beans: `BeneficiaryController` (`beneficiaryController`, @SessionScoped); `InvestorSearch` (`investorSearch`) via composite.
3. Purpose: maintain an investor's beneficiaries / next of kin (CRUD) after picking the investor by search.
4. User actions
   - Left: `brokerage:investorSearch selectAction="#{beneficiaryController.selectInvestor()}" update="mainContent"`.
   - Right, always-visible read-only investor summary (`beneficiaryController.selectedInvestor.*`): surname, othernames, email, registrationDate, birthDate, verifiedDate, gender, maritalStatus, postalAddress, residentialAddress, annualIncome, mobilePhone, residentialPhone, nationality, riskLevel.
   - List mode (`beneficiary == null`): "Add New Beneficiary" (ajax) -> `beneficiaryController.clearBeneficiary()`. (Load -> `loadBeneficiaries()` and Print -> `printBeneficiarys()` are inside `ui:remove`.) Table `beneficiaryTable` (`beneficiarysList`, 10 rows): Beneficiary Name, Email, Phone, Percentage Allocation, Edit (non-ajax) -> `editBeneficiary(beneficiary)`, Delete -> `deleteBeneficiary(beneficiary)` with JS `confirm('Are You Sure ?')`.
   - Form mode (`beneficiary != null`), form `beneficiaryForm`: Beneficiary Name* (required), Beneficiary Phone* (required), Beneficiary Email, Percentage Allocation* (required), Next of Kin Name, NoK Phone, NoK Email. "Save" (ajax) -> `saveBeneficiary()`; "Clear" (non-ajax) -> `clearBeneficiary()`; "Close" (immediate, ajax) -> `resetPage()`.
5. `selectInvestor()` -> `loadBeneficiaries()` = `QryBuilder.get(em, Beneficiary.class).addObjectParam(Beneficiary._investor, selectedInvestor)`; `CrudService.save(beneficiary)`; `CrudService.delete(beneficiary)`; `clearBeneficiary()` creates a new Beneficiary pre-linked to `selectedInvestor`.
   - Business logic in bean: none beyond wiring - and notably **missing**: no check that percentage allocations total <= 100, no numeric range validation, no email/phone format validation.
6. Role checks: none.
7. Unusual / bugs: "Add New Beneficiary" works with no investor selected (creates a beneficiary with `investor = null`; the save then persists an orphan or fails). "Clear" while editing an existing beneficiary replaces it with a brand-new one (so a subsequent Save inserts instead of updating). The Beneficiary entity has `relationship` and `birthDate` (set by the bulk upload) that this form does not expose. Session-held `selectedInvestor`, `beneficiary`, list; shared `investorSearch` state. `span styleClass=` invalid attributes.

### secured/accounts/incomplete-kycs.xhtml

1. Kind: full page, template `appTemplate.xhtml`. In live menu ("Incomplete Registrations") and linked from the dashboard (`index.xhtml` line 205, `h:link outcome="/secured/accounts/incomplete-kycs"`).
2. Beans: `IncompleteInvestorKycController` (`incompleteInvestorKycController`, @SessionScoped).
3. Purpose: read-only queue of investors whose bio data / KYC registration is incomplete (`bioDataCompleted = false`).
4. User actions
   - `brokerage:investorList value=investorsList filteredValue=filteredInvestors widgetVar="incompleteKycTable" emptyMessage="No investor has an incomplete registration."` - keyword search, sortable columns, row expansion with full investor detail. **No edit or delete action is passed, so there is no Action column.**
   - A toolbar form with Load -> `loadInvestors()`, Add New Investor -> `clearInvestor()` (and Print -> `printInvestors()` in `ui:remove`) exists but is `rendered="false"` (never shown).
   - Detail branch (`investor != null`) is an empty `p:panel header="Investor"`; unreachable from the UI.
5. `loadInvestors()` (@PostConstruct): `QryBuilder.get(em, Investor.class).addObjectParam(Investor._bioDataCompleted, false)`. Unused bean methods: `editInvestor`, `saveInvestor` (`CrudService.save`), `deleteInvestor` (**plain `CrudService.delete(investor)`**, unlike `AccountService.deleteInvestor` used on the investors page), `clearInvestor`, `resetPage`, `printInvestors` (stub).
6. Role checks: none.
7. Unusual: list is loaded once per session with no visible refresh (Load button is hidden) - a user must log out/in to see new incomplete registrations. No ordering. Effectively a static read-only report.

### secured/accounts/investor-risks-assessments.xhtml

1. Kind: full page, template `appTemplate.xhtml`. In live menu ("Investor Risk Assessment").
2. Beans: `InvestorRiskAssessmentController` (`investorRiskAssessmentController`, @SessionScoped); `InvestorSearch` via composite.
3. Purpose: view and capture/change an investor's answers to the risk-assessment questionnaire.
4. User actions
   - Left: `brokerage:investorSearch selectAction="#{investorRiskAssessmentController.selectInvestor()}" update="mainContent"`.
   - Right: read-only investor summary (same 15 fields as beneficiary page, from `selectedInvestor`).
   - Toolbar buttons Load (`loadInvestorRiskAssessments()`), "Take Questionnaire" (`takeQuestionnaire()`, empty method) and Print (`printInvestorRiskAssessments()`, stub) are all inside `ui:remove`.
   - Form `investorRiskAssessmentTable`: `ui:repeat` over `investorRiskAssessmentController.riskAssessmentQuestionsFromMap` (var `riskAssessmentQuestion`), one panel per question: Question text; current Answer (`investorAssesmentValueFromMap(q).riskAssessmentAnswer.answerDescription` or "Unanswered"); `p:selectOneMenu` bound to `investorAssesmentValueFromMap(q).riskAssessmentAnswer` with options from `getAlternateRiskAssessmentAnswers(q)`; `p:commandLink` "Edit" (ajax, update `mainContent,@form`) -> `editInvestorRiskAssessment(investorAssesmentValueFromMap(q))` which actually **saves** that answer.
5. Bean queries
   - `loadRiskAssessmentQuestions()` (@PostConstruct): `QryBuilder.get(em, RiskAssessmentQuestion.class).orderByAsc(RiskAssessmentQuestion._viewOrder)`.
   - `selectInvestor()` -> `loadSelectedInvestorRiskAnswers()`: **loop with one query per question** - `QryBuilder.get(em, InvestorRiskAssessment.class).addObjectParam(_investor, ..).addObjectParam(InvestorRiskAssessment._riskAssessmentAnswer_assessmentQuestion, question).getSingleResult(..)`; when none, builds a placeholder `InvestorRiskAssessment` holding a new transient `RiskAssessmentAnswer` pointing at the question; result stored in a `HashMap<RiskAssessmentQuestion, InvestorRiskAssessment>`.
   - `getAlternateRiskAssessmentAnswers(q)`: `QryBuilder.get(em, RiskAssessmentAnswer.class).addObjectParam(RiskAssessmentAnswer._assessmentQuestion, q)` - **a DB query inside a getter evaluated per question on every render (N+1)**.
   - `editInvestorRiskAssessment(ira)`: `CrudService.save(ira)`; no user feedback message, only `System.out`.
   - Unused: `loadInvestorRiskAssessments`, `saveInvestorRiskAssessment`, `deleteInvestorRiskAssessment`, `clearInvestorRiskAssessment`, `resetPage`.
   - Business logic: the "build one answer slot per question" assembly lives in the bean. **No score calculation and no update of `investor.riskLevel` from the answers** - the risk level shown is whatever was set manually on the investor form.
6. Role checks: none.
7. Unusual / bugs: questions are iterated from `HashMap.keySet()` so **display order is arbitrary** (the `viewOrder` sort is lost). "Edit" link label actually means "save this answer"; all dropdowns are in one form, so clicking one row's link submits every row's selection but persists only that row. Leaving the dropdown on "Select One" sets the answer to null and then saves an `InvestorRiskAssessment` with a null answer. If no investor is selected the map is null and the page shows nothing (exceptions swallowed). Question list is cached per session. Session-held selected investor/answers; shared `investorSearch` state.

### secured/accounts/investor-upload.xhtml

1. Kind: full page, template `appTemplate.xhtml`. In live menu ("Upload Investors").
2. Beans: `InvestorUploadController` (`investorUploadController`, **@ViewScoped** - the only non-session bean in the module).
3. Purpose: bulk import/migration of investors (and their beneficiaries and principal accounts) from a legacy Excel export.
4. User actions
   - Upload form (`enctype="multipart/form-data"`): `p:fileUpload mode="simple" skinSimple="true" required="true"` -> `investorUploadController.file`; "Upload" (non-ajax) -> `investorUploadController.upload()` (parses file into a preview list).
   - "Save" (non-ajax) -> `investorUploadController.save()` (persists).
   - Preview table `investorTable` (`investorsList`, 20 rows, paginator): Investor Code (`investor.id`, column filter), Name (`investorName`, filter), Status (`investor.status`, filter).
   - No file-type restriction, no template download, no error/row-level feedback, no success message.
5. Bean -> services (everything here is business logic in the bean and must move server-side)
   - `upload()`:
     - **`QryBuilder.get(em, Investor.class).delete()` - bulk-deletes EVERY investor row as the first step of parsing, before the file is even read and before the user presses Save.** (If FK constraints exist this throws and the whole upload is swallowed by the catch; if they do not, the investor table is wiped.) The very next loop then does `crudService.find(Investor.class, investorId)` to "update existing" investors, which contradicts the delete.
     - Writes the upload to `ExcelExporter.TEMP_DIR/<client file name>` (client-supplied file name used in the path), reads it with `ExcelDataLoader.read(path).getWorkBookData()`, drops the header row.
     - Hard-coded positional column mapping (0-based): 0 investor id (-> `Investor.id`, trailing ".0" stripped), 1 custname -> investorName (and corporateName), 2 gsdNumber, 3 surname, 4 othername -> firstName, 5 agentNumber, 7 postalAddress, 8 residentialAddress, 9 csdCode, 10 customer type ("C" = corporate), 11 phone, 12 email, 16 bank account no, 17 registrationDate, 19 businessType, 36 employerName, 37 occupation, 39 dob (also used as corporateIncorporationDate), 40 gender (M/F), 41 marital status (M/S), 42 card type (N national id, P passport, V voter, D driver licence, B birth certificate, H NHIS, K SSNIT), 43 idNumber, 44 idExpiryDate, 50 depAccountNo (then overwritten by 142), 51 tinNumber, 104 customerGroup, 105-111 beneficiary 1 (name 105, phone 107, email 108, relationship 109, dob 111), 113-119 beneficiary 2, 121-127 beneficiary 3, 135 fundName, 138 emergencyContactName, 139 emergency phone, 140 emergency email, 142 gsdPrefix **and** depAccountNo, 144 motherMaidenName, 145 spouseName, 146 birthPlace, 147 placeOfIdIssued, 158 digitalAddressGps.
     - Phone normalisation: scientific-notation fix via `BigDecimal.toEngineeringString()`, prefix "0" when 9 digits, split on "/" into mobile + residential, `PhoneNumberService.sanitize`. Same scientific-notation fix for bank account number and emergency phone.
     - Forces `bioDataCompleted = true`, `bioDataVerified = true`, `active = true`; `idIssueDate = LocalDate.now()`.
     - Beneficiaries: created with `crudService.generateId()`, `Relationship.valueOf(upper(text))` (throws on unknown text, aborting the whole parse inside the outer catch).
   - `save()`: for each investor -> `AccountService.initPrincipal(investor)` (finds or creates the principal Account: valueDate today, name = investorName, `SingletonIdService.initAccountId`, saves; sets `bioDataVerified` and **saves the investor** via `crudService.save`), sets `depositoryCode = investor.depAccountNo`, account type/classification (CORPORATE -> `AccountType.CORPORATE` + `AccountClassification.LOCAL_INSTITUTIONAL`; INDIVIDUAL -> `AccountType.INDIVIDUAL` + `LOCAL_RETAIL`), stock exchange looked up **inside the loop** by hard-coded code `"GSE"` (`crudService.findBySingleField(StockExchange.class, StockExchange._exchangeCode, "GSE")`), `crudService.save(account)`; then saves every beneficiary; `clear()`.
   - Injected but unused: `NotificationServiceImpl`, `SingletonIdService` (no investor code generated for imported investors; no welcome message).
6. Role checks: none - a destructive bulk operation open to any user who can reach the page.
7. Unusual / bugs
   - `isCorporateEntity = custTypeStr == "C"` compares Strings by reference -> effectively always false, so every imported investor becomes INDIVIDUAL and the corporate branch (and `Gender.INSTITUTION`) never runs.
   - Marital status: third branch repeats `equals("M")` so DIVORCE is unreachable.
   - `initPrincipal` returns null on failure -> NPE in `save()` aborts the remaining rows; no transaction around the loop (partial imports), no per-row error reporting, exceptions only printed.
   - `beneficiaryList` is not cleared at the start of `upload()` -> uploading twice before Save duplicates beneficiaries.
   - Beneficiary rows always inserted with new ids -> re-importing the same file duplicates them.
   - Account code generation is count-per-day based; importing many investors on one day overflows the 3-digit sequence (codes just get longer) and all get valueDate = today.
   - This is a one-off data-migration tool tied to one legacy spreadsheet layout; confirm whether it should be migrated at all, and if so as a guarded server-side job.

### secured/accounts/investor-verification.xhtml

1. Kind: full page, template `appTemplate.xhtml`. In live menu ("Investor Verifications") and linked from dashboard (`index.xhtml` line 195, `h:link outcome="/secured/accounts/investor-verification"`).
2. Beans: `InvestorVerificationController` (`investorVerificationController`, @SessionScoped).
3. Purpose: KYC verification queue - review a completed registration, record the depository account number, then verify the investor and create their principal trading account.
4. User actions
   - Queue (`investor == null`): `brokerage:investorList value=investorsList filteredValue=filteredInvestors widgetVar="verificationQueueTable" selected="#{investorVerificationController.rowInvestor}" editAction="#{investorVerificationController.processRow()}" editLabel="Process" editIcon="pi pi-check-square" editAjax="false"` - keyword search, expansion, and a labelled "Process" row button (no delete). Empty message "No investor is awaiting verification."
   - Hidden toolbar form (`rendered="false"`): Load -> `loadInvestors()`, Add New Investor -> `clearInvestor()`, Print (`ui:remove`).
   - Detail (`investor != null`, `ui:param inv`), left column, read-only panels: Applicant Information (surname, firstName, othernames, title, maidenName, motherMaidenName, birthDate, birthPlace, gender, maritalStatus, spouseName, occupation, levelOfEducation, nationality, residentialCountry, residentialStatus); Resident Foreigner Details (residencePermitNo, issued place, issue/expiry dates); Proof of Identity and Address (validId, idNumber, idIssueDate, placeOfIdIssued, idExpiryDate, postal/residential address, nearestLandmark, mobile/residential phone, email); Emergency Contact; Financial Profile (bank, bankAccountName, bankAccountNumber, bankBranch); Employment Details (employmentStatus, employerName, employerAddress, natureOfBusiness, employerContactNumber, annualIncome); Client Investment Profile (investmentObjective, initialInvestmentAmount, investmentKnowledge, investmentRiskProfile, investmentHorizon, anticipatedInvestmentActivity, sourceOfFunds, riskLevel, otherIncomeSource); Beneficiary / Next of Kin (inline beneficiary* fields on Investor); PEP Assessment (pepInGhana, details, pepOutsideGhana, details); Tax Compliance FATCA/CRS (foreignCitizen, hasForeignPassport, hasGreenCard, foreignResident, foreignFullName, addresses, phone, foreignTaxId); Others (investorName, registrationDate, bioDataCompleted, bioDataVerified, verifiedDate, verifiedBy, alert flags). Signature image URL is commented out. No ID document / photo / signature viewer.
   - Right column:
     - "Depository Account No" panel: input -> `investor.depAccountNo`; "Save" (non-ajax) -> `saveDepositoryAccountNo()`.
     - "Verification" panel: shows `principalAccount.accountName` and `principalAccount.accountCode` (blank until verified); "Verify / Create Account" (non-ajax) -> `verifyAccount()`.
   - "Close" (immediate, ajax) -> `resetPage()`.
5. Bean -> services
   - `loadInvestors()` (@PostConstruct): `QryBuilder.get(em, Investor.class).addObjectParam(Investor._bioDataCompleted, true).addObjectParam(Investor._bioDataVerified, false)`.
   - `processRow()` -> `editInvestor(rowInvestor)` (sets investor, clears principalAccount).
   - `saveDepositoryAccountNo()`: `CrudService.save(investor)` - no message, no validation.
   - `verifyAccount()`: `AccountService.initPrincipal(investor)` - finds the account whose principalInvestor is this investor, or creates one (valueDate = today, accountName = investorName, `SingletonIdService.initAccountId`, save); then `if (investor.isBioDataCompleted()) investor.setBioDataVerified(true)` and saves the investor. This is the **status transition Pending -> Verified** plus account-number generation; it lives in the service but with gaps (below).
   - Unused: `saveInvestor`, `clearInvestor`, `printInvestors` (stub).
6. Role checks: none (no maker/checker separation, no restriction on who may verify).
7. Unusual / gaps / bugs
   - Verification does **not** set `verifiedDate` or `verifiedBy` (those are only hand-typed on the investors form), sends no notification, shows no success/failure message, and there is no reject / send-back action.
   - The account created by verification has no accountType, classification, stockExchange or depositoryCode (the depository number entered alongside is stored only on `investor.depAccountNo`, not copied to `account.depositoryCode` - the bulk upload does copy it).
   - `initPrincipal` uses `getSingleResult` on principalInvestor - ambiguous if the investor is principal on several accounts.
   - After verification the investor stays in the session-cached queue (list is never reloaded or pruned; the Load button is hidden) until a new session.
   - If `initPrincipal` fails it returns null silently.
   - Session-held `investor`, `rowInvestor`, `principalAccount`, queue list.
   - Hard-coded "Ghana" PEP labels.

### secured/accounts/investors.xhtml

1. Kind: full page, template `appTemplate.xhtml`. In live menu ("Investors"). List and create/edit modes in one page.
2. Beans: `InvestorController` (`investorController`, @SessionScoped); `commonOptions`.
3. Purpose: investor register - search/list, create, edit, delete investors, capture bio data/KYC fields, alert preferences, verification flags, profile image; print investor report.
4. User actions
   - Page actions (when `investor == null`), form `investorActions`: "Load" (non-ajax) -> `loadInvestors()`; "Print" `h:commandLink target="_blank"` -> `printInvestors()` (PDF report); "Add New Investor" (non-ajax) -> `clearInvestor()`.
   - LIST VIEW: 4 clickable tiles using JS `stFilterInvestors(term)` (sets global filter + `PF('investorsTable').filter()`): Total (`totalCount`, ''), Verified (`verifiedCount`, 'Verified'), Awaiting Verification (`pendingCount`, 'Pending'), Incomplete Bio Data (`incompleteCount`, 'Incomplete').
     - `brokerage:investorList value=investorsList filteredValue=filteredInvestors widgetVar="investorsTable" update=":mainContent" selected="#{investorController.rowInvestor}" editAction="#{investorController.editRow()}" deleteAction="#{investorController.deleteRow()}"` - keyword search, sortable columns, row expansion (full detail), pencil edit, trash delete with `p:confirm` ("Delete {firstName} {surname}? This cannot be undone.") + global `p:confirmDialog`.
   - EDIT / CREATE VIEW, form `investorForm` (`enctype="multipart/form-data"`), header shows "surname, firstName" or "Add New Investor", registration date, status pill (`investor.status`/`statusStyle`), `p:messages`.
     - Personal Details: Investor Type* `selectOneMenu` <- `commonOptions.investorTypes` with `p:ajax update="investorDetailsPanel"`.
       - If `investorType == 'CORPORATE'`: Corporate Name, Corporate Incorporation Date (datePicker).
       - If `investorType == 'INDIVIDUAL'`: First Name* (required), Surname* (required), Othernames, Birth Date, Gender <- `commonOptions.genderList`, Marital Status <- `commonOptions.maritalStatusList`, Mother's Maiden Name, Nationality <- `commonOptions.countryList` (filterable), Education Level <- `commonOptions.educationList`, Profile Image `p:fileUpload mode="simple" accept=".jpg, .png, .webp"` -> `investorController.profileImage` (rendered only when `investorController.renderProfileImage()` i.e. investor already has an id).
     - Contact & Address: Email, Mobile Number, Residential Phone, Residential Country <- `commonOptions.countryList`, Residential Status <- `commonOptions.residentialStatusList`, Postal Address, Residential Address.
     - Identification: ID Type <- `commonOptions.idTypeList`, ID Number, Place of Issue, ID Expiry Date.
     - Employment: Occupation, Employer Name.
     - Financial Profile: Annual Income <- `commonOptions.annualIncomeList`, Other Source of Income, Risk Level <- `commonOptions.riskLevelList` (filterable).
     - Alerts (checkboxes): `enableSmsAlert`, `enableEmailAlert`, `purchaseAlert`, `salesAlert`, `cashTransactionAlert`.
     - Verification ("back office only"): checkboxes `bioDataCompleted`, `bioDataVerified`; Registration Date, Verified Date (datePickers); Verified By (free text).
     - Action bar: "Close" (immediate, ajax) -> `resetPage()`; "Clear" (non-ajax) -> `clearInvestor()`; "Save" (ajax, update `:mainContent`) -> `saveInvestor()`.
5. Bean -> services
   - `loadInvestors()` (@PostConstruct): `QryBuilder.get(em, Investor.class).orderByDesc(Investor._surname)` - all investors.
   - `editRow()` -> `editInvestor(rowInvestor)` (also records `verifiedAlready`, never used). `deleteRow()` -> `deleteInvestor(rowInvestor)`.
   - `saveInvestor()`: `SingletonIdService.initInvestorId(investor)`; `CrudService.save(investor)`; if a profile image was posted `InvestorFileService.saveImages(investor, profileImage.getContent(), null)`; `NotificationServiceImpl.sendPlatformWelcomeMessage(investor)` (email + SMS); `resetPage()`.
   - `deleteInvestor(i)`: `AccountService.deleteInvestor(investor)` - **cascading hard delete**: bulk-deletes by investor id AccountInvestor, AccountTransaction (twice), CashTransaction, Order, StockExchangeAccount, EquityTransaction, AssetValuation (via `_account_investor_id` paths), then Account (by `_principalInvestor_id`), Beneficiary, InvestorBankAccount, InvestorRiskAssessment, then the investor; each step's exception is swallowed and the method returns true regardless.
   - `printInvestors()`: maps every Investor to an `InvestorDetails` DTO in a loop (residentialCountry, gender, annualIncome label, residentialStatus label, maritalStatus, levelOfEducation label, email, investorName, registrationDate, residentialAddress, occupation, employerName, motherMaidenName) and calls `BrokerageReportManager.generateInvestorReport(list)` (Jasper `BrokerageReportFiles.INVESTOR_REPORT`, title "Investor Report"). Prints the **whole** list, ignoring the on-screen filter.
   - **Business logic in / triggered from the bean (must move server-side):**
     - Investor code generation: `SingletonIdService.initInvestorId` = `yyMMdd` of registration date + 3-digit (count of investors registered that day + 1); defaults registration date to today; only when code empty.
     - **Welcome message is sent on every save, including edits** (bug - should be first save only).
     - Verification status transition is done by hand: the form lets any user tick `bioDataVerified` / `bioDataCompleted` and type `verifiedBy` / `verifiedDate` directly, bypassing the verification page and without creating the principal account.
     - Summary counts (`getVerifiedCount`, `getPendingCount`, `getIncompleteCount`, `getShownCount`, `getTotalCount`) loop the in-memory list comparing `Investor.getStatus()` strings ("Verified"/"Pending"/"Incomplete").
     - Report DTO mapping loop in `printInvestors()`.
6. Role checks: none. The "Verification - back office only" card is only a label; nothing restricts it. Conditional rendering is purely on `investorType` and on `renderProfileImage()` (persisted investor).
7. Unusual / bugs
   - Hard delete of an investor silently wipes their accounts, orders, trades, cash transactions and holdings (financial history) behind a single confirm dialog; no "has activity" guard like the one accounts have.
   - Until an Investor Type is chosen neither field group renders; for CORPORATE there are no required fields at all (first name/surname required only for INDIVIDUAL), though the action bar note says both are required.
   - Profile image cannot be uploaded while creating (only after first save); Save is an ajax button on a multipart form with `mode="simple"` upload - verify the image actually posts; `profileImage` is session-held and never cleared, so a previously uploaded image can be re-applied to the next investor saved.
   - No email/phone format or uniqueness validation; no duplicate-investor check.
   - Many Investor fields shown on the verification page (title, ID issue date, emergency contact, bank details, PEP/FATCA, investment profile, beneficiary fields, TIN, depository account no) are not editable here.
   - `investorsList` ordered by surname **descending**; loaded once per session, refreshed only via "Load".
   - "Clear" while editing replaces the investor with a new empty one (insert on next save).
   - Session-held `investor`, `rowInvestor`, list, filtered list, `profileImage`.

### secured/accounts/investors_1.xhtml

1. Kind: full page, template `appTemplate.xhtml`. **Dead copy** (older version of investors.xhtml): no menu link, include or outcome references it.
2. Beans: `InvestorController` (`investorController`, @SessionScoped); `commonOptions`.
3. Purpose: legacy investor list + flat edit form.
4. User actions
   - List mode: "Load" -> `investorController.loadInvestors()`; "Add New Investor" -> `clearInvestor()`; Print (`printInvestors()`) inside `ui:remove`.
   - Table `investorTable` (`investorsList`, 10 rows) with rowToggler expansion (id, birthDate, verifiedDate, verifiedBy, title, gender, postal/residential address, annualIncome, otherIncomeSource, maritalStatus, residentialPhone, nationality (mislabelled res. country), occupation, employerName, motherMaidenName, levelOfEducation, placeOfIdIssued, idExpiryDate, alertType, residentialStatus, signatureImageUrl, riskLevel.levelName, enableSmsAlert, and "email alert" which wrongly shows `enableSmsAlert`). Columns: Surname, Othernames, Email, Mobile, Registration Date, Type of Id, ID Number, Edit -> `editInvestor(investor)`, Delete -> `deleteInvestor(investor)` with JS confirm.
   - Form mode: Surname*, Othernames*, Email* (all required), Registration Date, Birth Date, Verified Date, Verified By, Gender <- `commonOptions.genderList`, Marital Status <- `commonOptions.maritalStatusList`, Postal Address, Residential Address, Annual Income <- `commonOptions.annualIncomeList`, Other source of income, Mobile, Residential Phone, Nationality / Residential Country <- `commonOptions.countryList`, Occupation, Employer Name, Mother Maiden Name, Education Level <- `commonOptions.educationList`, Id Type <- `commonOptions.idTypeList`, ID number (mislabelled "Id Type"), Place of issued Id, Id expiry Date (plain inputText on a date), Enable SMS / Email Alert checkboxes, Signature Image Url, Alert Type <- `commonOptions.alertTypeList`, Residential Status <- `commonOptions.residentialStatusList`, Risk Level <- `commonOptions.riskLevelList`. Save -> `saveInvestor()`, Clear -> `clearInvestor()`, Close -> `resetPage()`.
5. Same bean methods as investors.xhtml.
6. Role checks: none.
7. Unusual: only place in the module that uses `commonOptions.alertTypeList` and `investor.alertType` / `signatureImageUrl` inputs; no investor type, first name, corporate fields, verification flags or profile image. Do not migrate.

---

### Beans in scope (all read in full)

| Bean class | @Named | Scope | Used by |
|---|---|---|---|
| `jsf/accounts/AccountController` | accountController | Session | account.xhtml, account_2.xhtml |
| `jsf/accounts/AccountInvestorController` | accountInvestorController | Session | account-investor.xhtml |
| `jsf/accounts/AccountOverviewController` | accountOverviewController | Session | account-overview.xhtml |
| `jsf/accounts/AccountPortfolioController` | accountPortfolioController | Session | account-portfolio.xhtml |
| `jsf/accounts/AccountUtilitiesController` | accountUtilitiesController | Session | account-utilities.xhtml |
| `jsf/accounts/BeneficiaryController` | beneficiaryController | Session | beneficiary.xhtml |
| `jsf/accounts/IncompleteInvestorKycController` | incompleteInvestorKycController | Session | incomplete-kycs.xhtml |
| `jsf/accounts/InvestorController` | investorController | Session | investors.xhtml, investors_1.xhtml |
| `jsf/accounts/InvestorRiskAssessmentController` | investorRiskAssessmentController | Session | investor-risks-assessments.xhtml |
| `jsf/accounts/InvestorUploadController` | investorUploadController | View | investor-upload.xhtml |
| `jsf/accounts/InvestorVerificationController` | investorVerificationController | Session | investor-verification.xhtml |
| `jsf/accounts/InvestorSearch` | investorSearch | Session | `brokerage:investorSearch` (account, account-utilities, beneficiary, investor-risks-assessments) |
| `jsf/AccountSearch` | accountSearch | Session | `brokerage:accountSearch` (account-portfolio, account-overview) |

Services touched (read only as far as the called methods): `services/AccountService` (@Stateless: `accountReferences`, `deleteBlockedBy`, `deleteAccount`, `initPrincipal`, `deleteInvestor`), `services/SingletonIdService` (EJB @Singleton: `initAccountId`, `initInvestorId`), `services/PortfolioService` (@Stateless: `getPortfolio`, `investmentPendingOut`, `cashBlance`), `services/InvestorFileService.saveImages`, `services/notification/NotificationServiceImpl.sendPlatformWelcomeMessage`, `reports/BrokerageReportManager` (`generateAccountTradesReport`, `generatePortflio`, `generateInvestorReport`), `reports/FixedIncomeReportService` (`printCashTransactions`, `printAccountTransactions`, `printEquityTransactions`).

`commonOptions` properties used by this module: `stockExchangesList`, `accountTypeList`, `investorAccountTypeList`, `investorsList`, `accountsList`, `buySellList`, `stocksList`, `investorTypes`, `genderList`, `maritalStatusList`, `countryList`, `educationList`, `residentialStatusList`, `idTypeList`, `annualIncomeList`, `riskLevelList`, `alertTypeList` (dead page only). `userSession` and `navHelper` are not used by any page in this module.

---

## Module: equities

Scope: 12 pages under `secured/equities/`, all read in full, plus their 12 backing beans (all read in full) and the services they call (`EquitiesService`, `EquityOrderService`, `SingletonIdService`, `DataLoadingService`, `model/ExecutionOrderGroup` read in full; `BrokerageReportManager` method signatures only; `model/PendingExecutionDay` and `entities/detail/TradeOrderModel` fields only).

Common facts for every page in this module
- All are full pages using `template="./../appTemplate.xhtml"` (defines `pageTitle`, `pageSubTitle`, `pageActions`, `pageContent`). The template does NOT wrap `pageContent` in a form; each page declares its own `h:form`s.
- None is included by another page (`ui:include` grep: no hits). None is a dialog/composite.
- Menu: `secured/menus/app-menues.xhtml` (the menu the template includes) links 11 of the 12 under "Equities", with no `rendered` condition. `execution_uploads.xhtml` is NOT in the menu (see its section). `app-menues-old.xhtml` is not included anywhere.
- Role/permission checks: NONE in any of the 12 pages or 12 beans. No `userSession`, `navHelper`, role or user-type expression is used. Only status-driven `rendered`/`disabled` conditions exist (listed per page).
- 11 of the 12 beans are `@SessionScoped`, so list data, search filters, the "selected" record and the list/detail view switch all live in the HTTP session and survive navigation away and back. Only `StockOrderUploadController` is `@ViewScoped`.
- List/detail switching is done in-page by `rendered="#{bean.x == null}"` on a session field, not by navigation. All action methods return void (no outcome strings, no flash, no view params).
- Data access is almost entirely `QryBuilder.get(crudService.getEm(), X.class)...` directly in the bean, plus `crudService.save/delete/find`. Summary tiles and footer totals are computed by Java loops in bean getters (re-run on every render).
- No polling, push, or timers anywhere in the module.
- Shared beans used: `commonOptions` (`stocksList`, `buySellList`, `orderStatusList`, `transactionStatusList`, `timeInForceList`, `orderTypeList`, `execTypesList`); `accountSearch` (via the `brokerage:accountSearch` composite on trade-order only: `searchText`, `searchField`, `searchAccount()`, `accountsList`, `selectedAccount`, `deleteAccount(account)`); `msg` bundle; `application.contextPath`.
- Composite components used: `brokerage:stats`, `brokerage:statTile`, `brokerage:steps`, `brokerage:step`, `brokerage:accountSearch`, `brokerage:equityOrder`, `stately:dateDisplay`, `stately:doubleDisplay`.

---

### secured/equities/bonus.xhtml

1. Kind: full page, `appTemplate.xhtml`. In menu ("Bonus Shares").
2. Bean: `BonusController`, `@Named("bonusController")`, `@SessionScoped`.
3. Purpose: capture/edit/delete bonus share issues declared on a stock (status DECLARED until processed elsewhere).
4. Actions
   - Page actions (only when `bonus == null`): "Load" -> `loadBonus()` (non-ajax); "Add new Bonus Issue" -> `newBonus()`.
   - Summary tiles: Bonus Issues `totalCount` (click runs JS `stFilterBonus('')` to clear the search), Unprocessed `declaredCount`, Processed `processedCount`.
   - Table `bonusList` (client-side global filter on stock symbol/name via `filteredBonus`, 10 rows, sortable): Stock (symbol + name), Ratio (`bonus.ratio`, sorted by `bonusShares`), Declare Date, Qualification Date, Crediting Date, Status pill (`statusStyleOf(bonus)`), Action.
   - Header shows `shownCount` of `totalCount`.
   - Row actions: Edit (pencil) -> `editBonus(bonus)`, rendered only when `isUnprocessed(bonus)`; Delete (trash) -> `deleteBonus(bonus)` behind a global `p:confirmDialog`.
   - Capture form (when `bonus != null`): Stock `p:selectOneMenu` (required, filterable, source `commonOptions.stocksList`), Bonus Shares and Qualification Shares (`p:inputNumber`, 0 decimals), Declare/Qualification/Crediting date pickers. Read-out "1 bonus share for every {qualificationShares / bonusShares} held" shown when both > 0.
   - Buttons: Close -> `resetPage()` (immediate); Clear -> `clearBonus()` (immediate, non-ajax); Save -> `saveBonus()`.
5. Data/logic
   - `loadBonus()` (`@PostConstruct`): `QryBuilder Bonus orderByDesc(declareDate)`.
   - `saveBonus()`: `crudService.save(bonus)`. IN-BEAN LOGIC: validation (stock required; bonusShares and qualificationShares > 0) and status transition (always forces `BonusStatus.DECLARED` on save, including on edit).
   - `deleteBonus()`: `crudService.delete`. IN-BEAN RULE: refuses when status is EXECUTED.
   - `getDeclaredCount()/getProcessedCount()`: `QryBuilder Bonus addObjectParam(status).count()` - one DB count per render per tile.
6. Permissions: none. Edit hidden for EXECUTED; Delete button is shown for all rows and only blocked in the bean.
7. Unusual
   - Editing an unprocessed bonus whose status is RECORDED resets it to DECLARED.
   - The read-out divides qualification by bonus shares using EL arithmetic (display only).
   - `Collections.EMPTY_LIST` is assigned on load failure; later `remove`/add on it would throw.
   - Not dead.

### secured/equities/bonus-processing.xhtml

1. Kind: full page, `appTemplate.xhtml`. In menu ("Bonus Processing").
2. Bean: `BonusProcessingController`, `@Named("bonusProcessingController")`, `@SessionScoped`. Inner class `EntitlementRow` (account, heldShares, bonusShares, accountName).
3. Purpose: list unprocessed bonus issues, preview per-account entitlements, and "process" them (create payout rows, mark EXECUTED).
4. Actions
   - Page actions: "Load" -> `loadUnprocessedBonus()`; "Process All" -> `processAll()` with confirm, `disabled` when `unprocessedCount == 0`.
   - Tiles: Unprocessed `unprocessedCount`, Processed `processedCount`.
   - Preview card (when `selectedBonus != null`): tiles for `entitlementRows.size()`, `previewTotalShares`, `selectedBonus.ratio`; table of `entitlementRows` (Account name, Account No `account.accountCode`, Shares Held, Bonus Shares). Buttons: Close -> `clearPreview()`; "Process This Bonus" -> `processBonus(selectedBonus)`.
   - Table `unprocessedBonus` (global filter on stock symbol/name via `filteredBonus`): Stock, Ratio, Declare/Qualification/Crediting dates, Status, Action.
   - Row actions: Preview -> `previewPayouts(bonus)`; Process -> `processBonus(bonus)` with confirm.
5. Data/logic - ALL BUSINESS LOGIC IS IN THE BEAN
   - `loadUnprocessedBonus()`: `QryBuilder Bonus addInParam(status, [DECLARED, RECORDED]) orderByDesc(declareDate)`.
   - `entitlementsOf(bonus)`: loads every `EquityTransaction` for the stock ordered by valueDate, nets BUY minus SELL quantity per account in a Java map, drops accounts with holdings <= 0, computes `bonusShares = held * bonus.bonusShares / bonus.qualificationShares` (long integer division, fractions truncated).
   - `processBonus(bonus)`: loops entitlement rows, `System.out.println`s the credit, persists a `BonusPayout` (bonus, account, sharesCredited, valueDate = creditingDate or today) per row via `crudService.save`, then sets `BonusStatus.EXECUTED` and saves the bonus. Not in one transaction (each save is separate; a failed payout save is silently skipped but the bonus is still marked EXECUTED).
   - `processAll()`: loops `processBonus` over a copy of the list.
   - `getProcessedCount()`: count query on status EXECUTED.
6. Permissions: none. No maker/checker.
7. Unusual / apparent bugs
   - The preview card's two `p:commandButton`s (Close, Process This Bonus) are NOT inside any `h:form` (the card sits directly in `mainContent`, and the template has no wrapping form), so they will not submit.
   - Entitlement ignores the qualification date entirely: every trade ever booked counts, including trades after the qualification date. It also ignores previous bonus payouts, and whether the trade is authorised.
   - No holdings are actually credited: the code comment says crediting "is printed for now"; only `BonusPayout` rows are written.
   - `stFilterBonus` JS is defined but nothing on this page calls it.
   - Not dead.

### secured/equities/dividend.xhtml

1. Kind: full page, `appTemplate.xhtml`. In menu ("Dividends").
2. Bean: `DividendController`, `@Named("dividendController")`, `@SessionScoped`. Structurally a copy of `BonusController` (verified by diff: only the validation and messages differ).
3. Purpose: capture/edit/delete cash dividends declared on a stock.
4. Actions
   - Page actions (when `dividend == null`): "Load" -> `loadDividends()`; "Add new Dividend" -> `newDividend()`.
   - Tiles: `totalCount` (click -> JS `stFilterDividends('')`), `declaredCount`, `processedCount`.
   - Table `dividendsList` (global filter via `filteredDividends`): Stock, Amount Per Share, Declare Date, Ex Date, Payment Date (the three dates are output with no converter), Status pill (`statusStyleOf`), Action. Header: `shownCount` of `totalCount`.
   - Row actions: Edit -> `editDividend(dividend)` (rendered when `isUnprocessed`); Delete -> `deleteDividend(dividend)` with confirm.
   - Capture form: Stock select (required, `commonOptions.stocksList`), Amount Per Share (`p:inputNumber`, 2 decimals), Declare/Ex/Payment date pickers.
   - Buttons: Close -> `resetPage()`; Clear -> `clearDividend()`; Save -> `saveDividend()`.
5. Data/logic
   - `loadDividends()` (`@PostConstruct`): `QryBuilder Dividend orderByDesc(declareDate)`.
   - `saveDividend()`: IN-BEAN validation (stock required, `amountPerShare > 0`) and forced `DividendStatus.DECLARED`; `crudService.save`.
   - `deleteDividend()`: blocked in bean when EXECUTED; `crudService.delete`.
   - Tile counts: count queries by status.
6. Permissions: none. Edit hidden when EXECUTED.
7. Unusual: same as bonus.xhtml (status reset to DECLARED on edit; delete shown for all rows). Amount is limited to 2 decimals in the UI. Not dead.

### secured/equities/dividend-processing.xhtml

1. Kind: full page, `appTemplate.xhtml`. In menu ("Dividend Processing").
2. Bean: `DividendProcessingController`, `@Named("dividendProcessingController")`, `@SessionScoped`. Inner class `EntitlementRow` (account, shares, grossAmount, accountName).
3. Purpose: list unprocessed dividends, preview per-account payouts, process them.
4. Actions
   - Page actions: "Load" -> `loadUnprocessedDividends()`; "Process All" -> `processAll()` (confirm; disabled when `unprocessedCount == 0`).
   - Tiles: `unprocessedCount`, `processedCount`.
   - Preview card (when `selectedDividend != null`): `entitlementRows.size()`, `previewTotal`, `selectedDividend.amountPerShare`; table (Account name, Account No, Shares Held, Gross Amount). Buttons: Close -> `clearPreview()`; "Process This Dividend" -> `processDividend(selectedDividend)`.
   - Table `unprocessedDividends` (global filter via `filteredDividends`): Stock, Amount Per Share, Declare/Ex/Payment dates, Status, Action.
   - Row actions: Preview -> `previewPayouts(dividend)`; Process -> `processDividend(dividend)` with confirm.
5. Data/logic - ALL IN THE BEAN
   - `loadUnprocessedDividends()`: `QryBuilder Dividend addInParam(status, [DECLARED, RECORDED]) orderByDesc(declareDate)`.
   - `entitlementsOf(dividend)`: same netting of `EquityTransaction` BUY/SELL per account as the bonus bean; `grossAmount = amountPerShare * shares` (double).
   - `processDividend()`: per row prints a message and saves a `DividendPayout` (dividend, account, grossAmount, valueDate = paymentDate or today); then sets `DividendStatus.EXECUTED` and saves. Not transactional.
   - `processAll()`: loop.
6. Permissions: none.
7. Unusual / apparent bugs
   - Same form problem as bonus-processing: the preview card's Close and "Process This Dividend" buttons are outside any `h:form`.
   - Ex-date is ignored when working out who is entitled. No withholding tax, no net amount, no cash posting (comment: payment "is printed for now"); only `DividendPayout` rows are created.
   - Not dead.

### secured/equities/equity-order-batching.xhtml

1. Kind: full page, `appTemplate.xhtml`. In menu ("Order Batching"). Old Bootstrap-style layout (not restyled like the others).
2. Bean: `EquityOrderBatchController`, `@Named("equityOrderBatchController")`, `@SessionScoped`.
3. Purpose: group all un-batched PENDING equity orders into an `EquityOrderBatch`, view/export/delete batches.
4. Actions
   - `p:tabView` bound to `selectedTabIndex`, `p:ajax event="tabChange"` -> `onTabChange` (stores active tab index in session).
   - Tab "Pending Orders": "refresh" -> `loadPendingTradeOrdersList()`; "Batch Pending Orders" -> `batchPendingOrders()` (non-ajax). Table `pendingTradeOrdersList`: row toggler (expansion shows id), Date, Order No, Account Name, Stock Name, Order Quantity, Order Price, Qty Sold, Qty Left, Estimated Cost, Status, Batch ("View Batch" link -> `viewEquityOrderBatch(tradeOrder.equityOrderBatch)`, rendered when the order has a batch).
   - Tab "Equity Order Batches": "refresh" -> `loadEquityOrderBatchesList()`. Table `equityOrderBatchesList`: Date (`batchDate`), Batch Tag (`batchTags`), Orders (`totalOrdersCount`), Estimated Buy Cost, Estimated Sell Cost, Estimated Comms, Actions `p:menuButton`: View -> `viewEquityOrderBatch(batch)`; export -> `generateExportData(batch)` (non-ajax file download); Delete -> `deleteEquityOrderBatch(batch)` (an `h:commandLink` nested inside a `p:menuitem`, JS `confirm('Delete?')`).
   - Batch detail (when `equityOrderBatch` not empty): header panel (Batch Date, Batch Tag, Total Orders, Estimated Cost BUY/SELL, Estimated Comms) and table `batchedTradeOrdersList` with the same order columns plus "Manage" -> `editTradeOrder(tradeOrder)` and "remove" -> `removeOrderFromBatch(tradeOrder)` (JS confirm). "Close" -> `resetPage()`.
   - Export: Excel `.xls` built with `ExcelExporter("BatchExport.xls")` from `TradeOrderModel` rows, sent as `<batchDate>.xls` via `Faces.sendFile`. Fields populated: orderNo, orderDate, accountName, depositoryCode (actually `stock.stockCode`), symbol, quantity, orderPrice, estimatedCost, estimatedComms (`orderType` and `amount` are left empty).
5. Data/logic - IN THE BEAN
   - `loadEquityOrderBatchesList()`: `QryBuilder EquityOrderBatch` (no filter, no ordering).
   - `loadPendingTradeOrdersList()`: `QryBuilder EquityOrder addObjectParam(orderStatus, PENDING)`.
   - `batchPendingOrders()`: filters pending orders with no batch (Java stream), creates the batch with `batchDate = today`, sums `estimatedExecutionCost` for BUY and for SELL, sums `estimatedComms`, sets `totalOrdersCount`, saves the batch, then loops saving each order with the batch reference. Not transactional.
   - `viewEquityOrderBatch()`: `QryBuilder EquityOrder addObjectParam(equityOrderBatch, batch)`.
   - `removeOrderFromBatch()`: nulls the order's batch and saves.
   - `deleteEquityOrderBatch()`: loads the batch's orders, `crudService.delete(batch)`, then loops nulling each order's batch.
   - `generateExportData()`: query + mapping loop + Excel generation.
6. Permissions: none.
7. Unusual / apparent bugs
   - "Manage" calls `equityOrderBatchController.editTradeOrder(tradeOrder)` but that method does not exist in the bean - the button throws at runtime.
   - Removing an order from a batch does not recompute the batch's totals/count.
   - Delete removes the batch first and un-links orders afterwards (will fail if a foreign key constraint exists).
   - `batchTags` is displayed but never set by this bean.
   - Order status is not changed by batching (stays PENDING), so the batch is just a grouping/export aid.
   - Debug `System.out.println("am here")` calls; `initEquitBatchOrder()` is unused by the page.
   - Not dead.

### secured/equities/equity-trades-transaction.xhtml

1. Kind: full page, `appTemplate.xhtml`. In menu ("Equity Transactions").
2. Bean: `EquityTradesController`, `@Named("equityTradeTransactionController")`, `@SessionScoped`.
3. Purpose: read-only blotter of individual executions (`EquityTradeTransaction`) with a PDF print.
4. Actions
   - Page action: "Print" `h:commandLink target="_blank"` -> `printEquityTradeTransactions()` (PDF via report manager).
   - Tiles: Executions `totalCount`; Buy Consideration `buyConsideration` (+ `buyCount`); Sell Consideration `sellConsideration` (+ `sellCount`); Quantity `totalQuantity`; Unprocessed `unprocessedCount`.
   - Server filters: value date from/to (`dateRange.fromDate/toDate`), Side (`buySell`, `commonOptions.buySellList`), Stock (`stock`, `commonOptions.stocksList`, filterable), Status (`transactionStatus`, `commonOptions.transactionStatusList`); "Search" -> `loadEquityTradeTransactions()` (non-ajax). Plus a client-side global filter box ("Execution, order or stock") via `filteredEquityTradeTransactions`.
   - Table `equityTradeTransactionsList` (10/25/50/100 rows): toggler; Value Date; Execution (`executionId`); Trade order / Trade (`tradeOrder.orderNo`, and `trade.account.accountName` or "not yet booked"); Stock; Side (`sideStyle`); Quantity; Order Filled bar (`fillPercent`); Execution Price; Execution Cost; Status (`statusStyle`, `statusLabel`); Message.
   - Row expansion: Execution type, Order type, Quantity sold (`qtySold`), Quantity left (`qtyLeft`), Message.
   - No row actions, no edits.
5. Data/logic
   - `init()` (`@PostConstruct`): default range = first of current month to today.
   - `loadEquityTradeTransactions()`: `QryBuilder EquityTradeTransaction addDateRange(dateRange, valueDate)` + optional `buySell`, `stock`, `transactionStatus`; `orderByDesc(valueDate)`.
   - `printEquityTradeTransactions()`: maps to `EquityTransactionDetail` in a loop, then `BrokerageReportManager.generateEquityTransactionReport(list)`.
   - Tile figures are Java loops over the loaded list.
6. Permissions: none.
7. Unusual: the default date range is fixed at session start (not refreshed on later visits). Print uses the full loaded list, ignoring the client-side search. `trade` on an execution appears never to be set (see trade-records note), so "not yet booked" is likely always shown. Not dead.

### secured/equities/equity-working-orders.xhtml

1. Kind: full page, `appTemplate.xhtml`. In menu ("Working Orders").
2. Bean: `EquitiesWorkingOrdersListView`, `@Named("equitiesWorkingOrdersListView")`, `@SessionScoped`.
3. Purpose: blotter of working orders (PENDING/SUBMITTED/PARTIALLY_FILLED); manually book fills against an order and process them into a trade.
4. Actions
   - Page actions (when `tradeOrder == null`): "Load" -> `loadTradeOrders()`; "Print" (`target="_blank"`) -> `printTradeOrders()` (landscape PDF).
   - Tiles: `workingCount`, `quantityRemaining`, `valueAtRisk`, `expiringTodayCount`.
   - Table `tradeOrdersList` (global filter via `filteredTradeOrders`, 15 rows): toggler (expansion renders `brokerage:equityOrder value="#{tradeOrder}"`), Order No + date, Side, Account (name + code), Stock symbol, Ordered, Filled bar (`fillPercent`), Remaining (`remainingOf(tradeOrder)`), Limit (`orderPrice`), vs Market (`marketVarianceOf`, highlighted when `isWorkable`, "No price" when `marketPriceOf == 0`), Good until (`timeInForce` + "Today" pill when `isExpiringToday`), Status, Action "Manage" -> `editTradeOrder(tradeOrder)`. Footer totals: `totalOrdered`, `quantityRemaining`.
   - Fill capture view (when `tradeOrder != null`): Close -> `resetPage()`. Order strip with progress bars using `percentOf(qtyExecuted, orderQuantity)` and `percentOf(bookedQuantity, orderQuantity)`, plus `remainingToBook`.
   - "Book a fill" form: Execution date (`transaction.valueDate`, required), Execution type (`transaction.executionType`, required, `commonOptions.execTypesList`), Quantity (`transaction.quantity`, required, `p:ajax change` -> updates `fillPreview`), "fill the remainder" link -> `fillRemainder()`, Price (`transaction.executionPrice`, 4 decimals, required, `p:ajax change` -> updates `fillPreview`), Execution ID (read-only, "Generated when you book").
   - Live preview panel: `previewConsideration`, `previewFilled`, `previewRemaining`, `previewStatus`.
   - Buttons: "Book fill" -> `bookFill()` (disabled when `remainingToBook == 0`); "Clear" -> `initOrderTransaction()`.
   - "Executions booked" table `transactionsList`: Date, Execution ID, Execution type, Quantity, Price, Cost, Status (`statusStyleOf`), Delete -> `removeExecution(execution)` with confirm (rendered when `transactionStatus != 'PROCESSED'`). Footer: `bookedQuantity`, `bookedCost`. Pill: `unauthorisedCount` not authorised / "All authorised".
   - "Process trade" -> `processTrade()` with confirm; disabled when `unauthorisedCount == 0`.
5. Data/logic
   - `loadTradeOrders()`: `QryBuilder EquityOrder addInParam(orderStatus, OrderStatus.workingOrders) orderByDesc(valueDate)`, then `loadMarketPrices()`: JPQL `SELECT p FROM EquityMarketPrice p ORDER BY p.valueDate ASC` - loads the ENTIRE price history and keeps the last per stock in a map.
   - `loadTransactions()`: `QryBuilder EquityTradeTransaction addObjectParam(tradeOrder, tradeOrder)`.
   - IN-BEAN LOGIC: `marketVarianceOf` ((market - limit) / limit * 100); `isWorkable` (buy: market <= limit; sell: market >= limit); `isExpiringToday` (expiry date == today, or DAY_ORDER with valueDate == today); `remainingOf` (orderQuantity - qtyExecuted, floored at 0); `getBookedQuantity`, `getRemainingToBook`, `getValueAtRisk` (remaining * limit); `execTypeFor` (FILL if quantity >= remaining else PARTIAL_FILL - this overwrites whatever the user picked in the Execution type dropdown); preview status text.
   - `bookFill()`: IN-BEAN validation (`validateFill`: quantity > 0, price > 0, date present, quantity <= remaining to book); computes `executionCost = price * quantity`, `qtySold`, `qtyLeft`; `SingletonIdService.initExecutionId(transaction)` (format `EX` + yyMMdd + 3-digit count-of-day + 1; count-based, not concurrency safe); `crudService.save(transaction)`.
   - `processTrade()`: collects non-PROCESSED fills, calls `EquitiesService.processTrade(LocalDate.now(), tradeOrder, pending)`, then `crudService.find(EquityOrder)`, reloads.
   - `EquitiesService.processTrade` (server side, but relevant): finds or creates the `EquityTransaction` for (order, valueDate); new trades are created already `authorised = true`; deletes existing `TradeFee`s when recomputing; quantity = sum of the passed fills, consideration = sum of execution cost, tradePrice = consideration / quantity; loads ALL `ExchangeFee` rows (stock-exchange filter is commented out) and creates one `TradeFee` each (NOMINAL = flat amount, PERCENTAGE = amount% of consideration), splitting broker commission vs other charges; net = consideration + charges (BUY) or - charges (SELL); marks fills PROCESSED; `evaluateTradeOrder` sums trade quantity and sets PENDING / PARTIALLY_FILLED / COMPLETELY_FILLED.
   - `removeExecution()`: blocked in bean when PROCESSED; `crudService.delete`.
   - `printTradeOrders()`: maps to `EquityWorkingOrderDetails` and calls `BrokerageReportManager.generateWorkingOrdersReport(rows, asAt dd/MM/yyyy)`; uses the filtered list when a search is active.
6. Permissions: none. Booking and processing are done by the same user with no approval step (trades are created pre-authorised).
7. Unusual / apparent bugs
   - Processing here always uses today's date as the trade date, regardless of each fill's execution date; the Execution Processing page uses the fills' value date. The two routes can produce different trades for the same fills.
   - If an order is processed twice on the same day from this page, the existing trade for (order, today) is reused and its quantity/consideration are overwritten with only the newly pending fills (earlier fills of that day drop out of the trade figures).
   - `EquitiesService.processTrade` catches and swallows all exceptions, so the page reports success even when processing failed.
   - `initOrderTransaction()` calls `JsfUtil.resetViewRoot()`.
   - `editOrderTransaction()` exists in the bean but is not used by the page.
   - Not dead.

### secured/equities/execution_uploads.xhtml

1. Kind: full page, `appTemplate.xhtml`. Old-style layout. NOT in the menu; the only reference is a plain link in `execution-processing.xhtml` ("Execution Uploads"). Reachable but looks half-finished.
2. Bean: `EquityExecutionUploadController`, `@Named("equityExecutionUploadController")`, `@SessionScoped`.
3. Purpose: upload an Excel file of executions, match rows to orders by order number, save them as `EquityTradeTransaction`s.
4. Actions
   - File upload: `p:fileUpload mode="simple"` bound to `file`; "Upload file" -> `upload()` (non-ajax, multipart form).
   - Expected file: Excel read by `ExcelDataLoader`, first row is a header and is dropped. Columns: [0] execution date (Excel date or text `dd/MM/yyyy`), [1] order number (long), [2] quantity (long), [3] price (double).
   - `p:tabView` (`selectedTabIndex`, `tabChange` -> `onTabChange`): tab "Successful" - table `transactionsList` (toggler/id, Date, Order No, Stock Code, Account, Quantity, Price) and "Save" -> `saveUploads()`; tab "Failed" - table `failedUploads` (Date, Order No, Quantity, Price).
5. Data/logic - ALL IN THE BEAN
   - `upload()`: writes the upload to `new File(file.getFileName())` (relative path in the server working directory, client-supplied name), parses rows, per row runs `QryBuilder EquityOrder addObjectParam(orderNo, n).getSingleResult` (one query per row); unmatched rows go to `failedUploads` as `EquityTransactionDetail`; matched rows become unsaved `EquityTradeTransaction` (tradeOrder, executionPrice, quantity, valueDate only).
   - `saveUploads()`: loops `crudService.save`.
6. Permissions: none.
7. Unusual / apparent bugs
   - Saved executions have no executionCost, executionType, transactionStatus, stock, buySell or executionId. The "Awaiting Processing" list on Execution Processing only counts `executionType IN (FILL, PARTIAL_FILL)`, so these uploads never appear there, and their cost is 0 when turned into trades.
   - Nested `h:form` inside `h:form`, both with id `transactionsTable`, used twice (invalid/duplicate ids).
   - The "Failed" tab Price column binds `#{transaction.executionPrice}` (wrong row variable; should be `failedUpload`).
   - All exceptions are swallowed with empty catch blocks (a bad file gives no feedback). No quantity-vs-remaining validation, no duplicate check; clicking Save twice saves again (session-held list is not cleared).
   - Page title "Upload Execution Uploads"; panel header "Trade Order".

### secured/equities/execution-processing.xhtml

1. Kind: full page, `appTemplate.xhtml`. In menu ("Execution Processing").
2. Bean: `EquityOrderExecutionProcessingController`, `@Named("equityOrderExecutionProcessiingController")` (note the typo "Processiing"), `@SessionScoped`. Helper models `ExecutionOrderGroup`, `PendingExecutionDay`.
3. Purpose: load a day's executions grouped by order, consolidate them into one trade per order, show resulting trades and days still pending.
4. Actions
   - Page actions: Trade date picker (`valueDate`) + "Load" -> `load()`.
   - Static 4-step indicator (`brokerage:steps`), step 2 hard-coded as current.
   - Tiles: `executionCount` (for `valueDate`), `orderCount`, `pendingCount` + `pendingGroupCount`, `processedCount` + `processedGroupCount`, `executedValue`.
   - Warning notice when `unlinkedExecutions` is not empty (executions without an order are skipped).
   - Table `orderGroups` (global filter "Order no, account or stock" via `filteredOrderGroups`): toggler; Order (no, type, quantity ordered); Account; Stock; Side; Fills (`fillCount`); Quantity; Avg Price (`averagePrice`); Cost; Status (`statusLabel`: Processed / New fills / Awaiting). Footer: `orderCount`, `executionCount`, `totalQuantity`, `executedValue`.
   - Row expansion: sub-table of `group.executions` (Execution ID, Type, Quantity, Price, Cost, Processed / Not processed, Message).
   - Action bar: "Process into Trades" -> `processTrades()` with confirm; disabled when `orderGroups` is empty.
   - "Trades for {date}" card: "Trade & Settlement Report" (`target="_blank"`) -> `printTradeSettlementReport()` (PDF); plain link to `trade-records.xhtml`. Table `tradesList`: Order, Account, Stock, Side, Quantity, Trade Price, Consideration, Charges, Net; footer `tradeCount`, `tradesQuantity`, `tradesConsideration`, `tradesCharges`, `tradesNet`.
   - Right card "Awaiting Processing": table `pendingDays` (Date as link -> `selectDay(day)`, Fills, Orders), footer `pendingDaysFills`; link to `execution_uploads.xhtml`; "Process All into Trades" -> `processAllTrades()` with confirm.
5. Data/logic
   - `load()`: `QryBuilder EquityTradeTransaction addObjectParam(valueDate)`; `QryBuilder EquityTransaction addObjectParam(valueDate)`; `groupByOrder()` groups in Java and attaches the existing trade.
   - `loadPendingDays()`: aggregate query via QryBuilder - return fields `e.valueDate, COUNT(e.id), COUNT(DISTINCT e.tradeOrder)`, `executionType IN (FILL, PARTIAL_FILL)`, raw condition `(e.transactionStatus IS NULL OR e.transactionStatus <> PROCESSED)`, group by and order by valueDate desc.
   - `processTrades()` -> `EquitiesService.procesTodayTrades(valueDate)`: loads the day's executions, groups by order, calls `processTrade(valueDate, order, fills)` for each (fee logic described under working orders). Already-processed groups are recomputed (fees deleted and re-created).
   - `processAllTrades()` -> `EquitiesService.procesAllTrades()`: loads EVERY `EquityTradeTransaction` in the database, groups by order, and processes each group using the ORDER's value date as the trade date.
   - `printTradeSettlementReport()` -> `BrokerageReportManager.generateTradeReport(tradesList, new LocalDateRange(valueDate, valueDate))`.
   - In-bean: grouping, all summary figures, and the success/partial message computed from before/after trade counts.
6. Permissions: none.
7. Unusual / apparent bugs
   - "Process All into Trades" reprocesses the entire execution history every time (not just pending), and collapses all of an order's fills into one trade dated on the order date - different from per-day processing. Its confirm text says "for this day".
   - `EquitiesService` methods swallow exceptions, so the bean's "Processing failed" branch is unreachable; failures show as "0 trades booked".
   - `valueDate` defaults to the date the session bean was created, not the current day on later visits.
   - Fee computation applies every `ExchangeFee` row regardless of exchange.
   - Not dead.

### secured/equities/stock-order-upload.xhtml

1. Kind: full page, `appTemplate.xhtml`. In menu ("Upload Stock Orders"). Old-style layout; looks like a data-migration utility.
2. Bean: `StockOrderUploadController`, `@Named("stockOrderUploadController")`, `@ViewScoped`.
3. Purpose: bulk-import historical orders/trades from an Excel export, creating orders, executions and cash transactions; also bulk-delete all trades/orders.
4. Actions
   - `p:fileUpload mode="simple"` (required) bound to `file`; "Upload" -> `upload()` (non-ajax).
   - "Save" -> `save()`.
   - Preview table `ordersList` (20 rows): Order No, Date, Stock, Account, Side, Order Qty, Order Price, Trade Qty (`qtyExecuted`), Trade Price (actually `actualExecutedCost`), Trade Amount (`consideration`), Status.
   - "Delete Trades" -> `deleteTradesRecords()`; "Delete Orders" -> `deleteEquityOrders()`. No confirmation dialog on either.
   - Expected file: Excel, header row dropped. Columns used (0-based): [0] order id, [1] value date, [2] investor id, [3] side (`S` = SELL, `P` = BUY), [4] stock id, [6] quantity, [8] price, [10] message, [11] transaction type (`CANCEL` / `ORDER` / `TRADE`), [14] created date. Other columns ignored.
5. Data/logic - ALL IN THE BEAN (heavy)
   - `upload()` per row: looks up `EquityOrder` by id (`QryBuilder ... addObjectParam(id)`), else creates one and sets its id from the file (stripping `/`); looks up an `EquityTradeTransaction` by order; `cost = quantity * price`; `crudService.find(Stock, stockId)`; looks up `Account` by `principalInvestor.id` (after `StringUtil.removeTraillingZero`); sets order fields (qtyExecuted = quantity, actualExecutedCost = consideration = cost).
     - `CANCEL`: status CANCELLED, `SingletonIdService.tradeId(order)` (order number = yyMMdd + 3-digit daily count), added to `cancelledOrdersList`.
     - `ORDER`: row skipped entirely.
     - `TRADE`: status COMPLETELY_FILLED; builds an `EquityTradeTransaction` (NOT_PROCESSED, FILL, message, date, price, quantity, cost); builds a `CashTransaction` on `Portfolio.TRADING_ACCOUNT` - CREDIT "Cash Credit For Sale of {stockCode}" for a sell, DEBIT "Cash Debit For Purchase of {stockCode}" for a buy - marked paid, `PaymentStatus.PAID`, verified; generates the order number.
   - `save()`: loops `crudService.save` over orders, cancelled orders, executions, then cash transactions (cash failures are caught individually and ignored).
   - `deleteTradesRecords()` -> `DataLoadingService.deleteTrade()`: unfiltered bulk deletes of ALL `TradeFee`, `EquityTradeTransaction`, `EquityTransaction` and ALL `CashTransaction` rows.
   - `deleteEquityOrders()` -> `DataLoadingService.deleteOrders()`: bulk delete of ALL `EquityOrder` rows.
6. Permissions: none - any logged-in user who can see the menu can wipe all trades, all cash transactions and all orders with one click.
7. Unusual / apparent bugs
   - The two delete buttons are destructive, unguarded and unconfirmed; "Delete Trades" also removes every cash transaction (deposits/withdrawals included).
   - `isEquityTradeTransaction` is only set to true after the stock and side are assigned, so the created execution never gets its stock or buy/sell set.
   - Order numbers are generated from a per-day row count while nothing is saved yet, so many uploaded orders for the same date get the same number.
   - `clear()` after save resets only `ordersList`; the cancelled, execution and cash lists stay populated, so a second upload+save in the same view saves the earlier ones again.
   - No fees/commission are applied; cash is posted for gross cost only. Commented-out blocks would have created matching deposit/withdrawal cash transactions.
   - Hard-coded: `Portfolio.TRADING_ACCOUNT`, side codes `S`/`P`, type strings.
   - Null account is tolerated (order and cash transaction saved without an account).

### secured/equities/trade-order.xhtml

1. Kind: full page, `appTemplate.xhtml`. In menu ("Orders"); also linked from `secured/index.xhtml` via `h:link outcome="/secured/equities/trade-order"`.
2. Beans: `TradeOrderController`, `@Named("tradeOrderController")`, `@SessionScoped`; shared `AccountSearch` (`accountSearch`, injected into the controller and driven by the `brokerage:accountSearch` composite).
3. Purpose: equity order blotter plus an order ticket (pick account, enter order, confirm to price it, save); cancel/delete orders.
4. Actions
   - Page actions (when `tradeOrder == null`): "Print" (`target="_blank"`) -> `printTradeOrders()` (PDF); "Add new Trade Order" -> `newTradeOrder()`.
   - Tiles: `totalCount`, `workingCount`, `filledCount`, `workingValue`.
   - Server filters: Buy/Sell (`buySell`, `commonOptions.buySellList`), Order status (`orderStatus`, `commonOptions.orderStatusList`), From/To (`dateRange.fromDate/toDate`); "Search" -> `loadTradeOrders()`. Client-side global filter ("Order no, account or stock") via `filteredTradeOrders`.
   - Table `tradeOrdersList`: toggler; Date; Order No; Side; Account (name + code); Stock symbol; Order Quantity; Order Price; Filled bar (`fillPercent`); Consideration; Order Status (`statusStyle`, `statusLabel`); Action. Footer: `totalQuantity`, `totalExecuted`, `totalConsideration`.
   - Row expansion: order type label, time in force, expiry date, order quantity, qty executed, qty left, consideration, estimated execution cost, actual executed cost, estimated commission, regulatory fees, authorised date.
   - Row actions: Edit -> `editTradeOrder(tradeOrder)`; Delete -> `deleteTradeOrder(tradeOrder)` with confirm.
   - Ticket (when `tradeOrder != null`):
     - Header: status pill; "Cancel Order" -> `cancelOrder(tradeOrder)` with confirm, rendered when `tradeOrder.working and orderNo != null`.
     - Column 1 Account: if `accountSelected`, shows exchange code, name, code and "Change" -> `changeAccount()`; otherwise `brokerage:accountSearch selectAction="#{tradeOrderController.selectAccount()}" rows="8"` (search text + search-by field, results table; clicking a row sets `accountSearch.selectedAccount` then calls `selectAccount()`).
     - Column 2 Order: Side (required, `commonOptions.buySellList`), Date (`valueDate`, required), Stock (required, `commonOptions.stocksList`, filterable), Time in force (`commonOptions.timeInForceList`), Order type (required, `commonOptions.orderTypeList`), "Specify order type" textarea (`orderTypeDescription`, required, shown when `customOrderType` i.e. `OrderType.OTHER`), Order quantity (required, 0 decimals), Order price (4 decimals), Expiry date. Side, Stock, Order type, Quantity and Price each fire `p:ajax` -> `unconfirmOrder()` and re-render the confirmation panel (Order type also re-renders the form).
     - "Confirm Order" -> `confirmOrder()`.
     - Column 3 Confirmation (when `orderConfirmed`): Consideration, Broker commission (`estimatedComms`), Regulatory charges (`regulatoryFees`), total labelled by `considerationLabel` (`estimatedExecutionCost`); execution progress (for saved orders); Save button (label `saveLabel`, style `saveStyle`) -> `saveTradeOrder()`; "Clear" -> `clearTradeOrder()`.
     - "Close" -> `resetPage()`.
5. Data/logic
   - `loadTradeOrders()` (`@PostConstruct`): `QryBuilder EquityOrder addDateRange(dateRange, valueDate)` + optional `buySell`, `orderStatus`; `orderByDesc(valueDate)`. No default dates are set, so the initial load depends on how `addDateRange` treats nulls.
   - `confirmOrder()`: in-bean `validateOrder()` (account, stock, side, quantity > 0, limit order needs price > 0) then `EquityOrderService.prepareOrder(order)`: consideration = quantity * price; broker commission = 1.8% and regulatory charges = 0.7% of consideration (HARD-CODED constants `BROKER_COMMISSION_RATE`, `REGULATORY_CHARGE_RATE`), rounded to 2 dp; estimatedExecutionCost = consideration + charges (BUY) or - charges (SELL).
   - `saveTradeOrder()`: validation + must be confirmed, then `EquitiesService.saveOrder(order)`: for a new order generates the order number via `SingletonIdService.tradeId` (yyMMdd + 3-digit daily count, parsed to Long), sets qtyExecuted 0 and status PENDING, sets qtyLeft = orderQuantity while PENDING.
   - `cancelOrder()`: IN-BEAN status transition - PARTIALLY_FILLED_CANCELLED if `qtyExecuted > 0`, else CANCELLED; `crudService.save`.
   - `deleteTradeOrder()`: `crudService.delete` with no status check (relies on a database error if executions exist).
   - `newTradeOrder()`: defaults status PENDING, valueDate today, order type LIMIT_ORDER.
   - `printTradeOrders()`: maps to `TradeOrderDetails` (stock, order price, order quantity, qty left, qty sold) and calls `BrokerageReportManager.generateTradeOrderReport`.
   - Tile/footers: Java loops.
6. Permissions: none. Cancel is status-gated (`working`). No authorisation step on order entry.
7. Unusual / apparent bugs
   - `EquitiesService.saveOrder` overwrites `estimatedExecutionCost` for a NEW limit order with `price * quantity * 0.025` (hard-coded 2.5%), replacing the net figure the confirmation panel just showed.
   - Order-entry charges (flat 1.8% + 0.7%) are unrelated to the `ExchangeFee` table used when the trade is actually booked.
   - Selected account is carried through the shared session bean `accountSearch.selectedAccount`.
   - The page has two global `p:confirmDialog`s (one in the blotter form, one in the ticket).
   - Editing an existing order requires re-confirming before save; editing does not reset `orderConfirmed`, so a stale confirmation from a previous ticket can carry over within the session.
   - `getTotalCharges()` / `getShownCount()` exist but are not used by the page.
   - Not dead.

### secured/equities/trade-records.xhtml

1. Kind: full page, `appTemplate.xhtml`. In menu ("Trade Records"); also linked from execution-processing.
2. Bean: `EquityTradeController`, `@Named("equityTradeRecordsController")`, `@SessionScoped` (note class name vs bean name mismatch).
3. Purpose: read-only blotter of booked trades (`EquityTransaction`) with a detail view (fees, settlement summary, executions), contract note and trade & settlement reports.
4. Actions
   - Page actions, list mode: "Trade and Settlement Report (pdf)" (`target="_blank"`) -> `printTradeReport()`; "Trade and Settlement Report (Excel)" -> `p:dataExporter type="xls" target=":tradeTable:tradesTbl" fileName="trade_and_settlement_report"` (exports the table using each column's `exportValue`; Status and Actions columns excluded).
   - Page actions, detail mode: status pill; "Contract Note" (`target="_blank"`) -> `printContractNote(selectedTrade)`; "Back to Trade Records" -> `closeTrade()`.
   - Tiles: `totalCount`; `buyConsideration` (+ `buyCount`); `sellConsideration` (+ `sellCount`); `totalCommission` (+ `totalOtherCharges`); `pendingCount` ("Awaiting Authorisation").
   - Server filters: Side (`buySell`), Stock (`stock`), From/To (`dateRange`); "Search" -> `loadTrades()`. Client global filter via `filteredTrades`.
   - Table `tradesList` (10/25/50/100): toggler; Date; Order No; Side; Account; Stock (symbol on screen, `stockCode` in export); Quantity; Trade Price; Consideration; Charges (`totalCharges` = commission + other); Net (`netConsideration`); Status (`statusStyle`, `statusLabel`, sorted by `authorised`); Actions. Footer: `totalQuantity`, `totalConsideration`, `totalCharges`, `totalNetConsideration`.
   - Row expansion: order type, brokerage commission, other charges, in-house commission (`inhouseComms`), third-party commission (`thirdpartyComms`), authorised by / date.
   - Row actions: "View" -> `viewTrade(trade)`; "Note" -> `printContractNote(trad)`.
   - Detail view (read-only): tiles (side/stock/order type; quantity x price with order progress; consideration; net consideration with `netLabel`); Fees table `tradeFeesList` (fee name, broker commission vs other charge, basis: "% of consideration" when `applicationMode == 'PERCENTAGE'` else flat amount, fee amount; footer `feesTotal`); Settlement Summary (consideration, commission, in-house / third-party split, other charges, net, authorisation details); Executions table `executionsList` (date, execution id, quantity, price, cost, status, message; footer `executedQuantity`, `executedCost`).
5. Data/logic
   - `init()`: default range = first of month to today; `loadTrades()`: `QryBuilder EquityTransaction addDateRange(dateRange, valueDate)` + optional `buySell`, `stock`; `orderByDesc(valueDate)`.
   - `viewTrade()`: `QryBuilder TradeFee addObjectParam(trade)`; `QryBuilder EquityTradeTransaction addObjectParam(trade) orderByDesc(valueDate)`.
   - `printContractNote()`: reuses loaded fees/executions or queries them, then `BrokerageReportManager.generateContractNote(trade, fees, executions)`.
   - `printTradeReport()`: `BrokerageReportManager.generateTradeReport(tradesList, dateRange)`.
   - Totals: Java loops in getters.
6. Permissions: none. There is no authorise action on this page even though it shows "Awaiting Authorisation"; trades are created already authorised by `EquitiesService.processTrade`.
7. Unusual / apparent bugs
   - Row-level "Note" link passes `#{trad}` (typo for `trade`), which resolves to null, so the bean answers "Select a trade first"; the contract note only works from the detail view.
   - `EquityTradeTransaction.trade` is never set anywhere in brokerage-admin (no `setTrade` call on an execution found), so the detail view's Executions table (queried by `trade`) is likely always empty unless populated outside this module.
   - `authorisedBy`, `inhouseComms`, `thirdpartyComms` are displayed but not set by the processing code.
   - PDF report uses the full loaded list; Excel export uses the table (respects the client-side search).
   - `getBrokerFeesTotal()` / `getOtherFeesTotal()` exist but are unused by the page.
   - Not dead.

---

### Cross-cutting notes for the migration (equities)

Business logic that currently lives in JSF beans and must move server-side
- Corporate actions: entitlement calculation and payout creation for bonuses and dividends (`BonusProcessingController`, `DividendProcessingController`), including status transitions.
- Fill booking: validation, execution cost, qtySold/qtyLeft, execution-type derivation (`EquitiesWorkingOrdersListView.bookFill`).
- Order rules: validation, cancel status transition, unguarded delete (`TradeOrderController`).
- Batching: batch creation, totals, linking/unlinking orders, Excel export (`EquityOrderBatchController`).
- File parsing and entity creation for both uploads (`EquityExecutionUploadController`, `StockOrderUploadController`), including cash transaction generation.
- Market-price comparison, value-at-risk, expiry rules, and every summary tile/footer total (currently Java loops over session-held lists; will need paged/aggregate endpoints).

Existing server-side services already holding logic
- `EquityOrderService.prepareOrder` (order costing; also used by the REST endpoint per its comment).
- `EquitiesService.saveOrder / processTrade / procesTodayTrades / procesAllTrades / evaluateTradeOrder` (trade consolidation, fee computation, order status re-evaluation).
- `SingletonIdService.tradeId / initExecutionId` (count-based number generation).
- `DataLoadingService.deleteTrade / deleteOrders` (unfiltered bulk deletes).
- `BrokerageReportManager.generateTradeOrderReport / generateWorkingOrdersReport / generateEquityTransactionReport / generateTradeReport / generateContractNote` (PDF output streamed to a new tab).

Files that could not be read: none. Only partially read (signatures/fields, not full bodies): `reports/BrokerageReportManager.java`, `model/PendingExecutionDay.java`, `entities/detail/TradeOrderModel.java`, the entity classes, `QryBuilder`, and the composite components other than the EL in `accountSearch.xhtml` / `equityOrder.xhtml`.

---

## Module: fixed-income

All 9 xhtml pages and all backing beans below were opened and read in full. Common facts for the module:

- Every page is a full page using `template="./../appTemplate.xhtml"` (defines `pageTitle`, `pageContent`). None is included by another file (no `ui:include` hits anywhere in webapp).
- Every backing bean is `@SessionScoped` (CDI `@Named`). All page state (selected order/transaction/account, lists, upload previews, tab index) therefore lives in the HTTP session and survives navigation.
- No role/permission checks exist in any of these pages or beans (no `rendered=` on roles, no user-type checks). Only status-based `disabled=` noted per page.
- No polling/push/timers anywhere in the module.
- Persistence is almost entirely `CrudService.save/delete` + `QryBuilder.get(crudService.getEm(), X.class)` called directly from the beans (no service layer) except where noted.
- Menu: 8 of the 9 pages are linked from `secured/menus/app-menues.xhtml` ("Fixed Income" submenu, lines 65-72) and from `app-menues-old.xhtml`. `fixed-income-market-price.xhtml` is linked from nowhere.
- Shared composites used: `brokerage:accountSearch` (attrs `selectAction`, `ajax`, `update`; result read from session bean `accountSearch.getSelectedAccount()`), `brokerage:fixedIncomeSearch` (see FixedIncomeSearch below), `stately:dateDisplay`, `stately:doubleDisplay`.

### Shared bean: FixedIncomeSearch (`fixedIncomeSearch`, @SessionScoped) + composite `resources/brokerage/fixedIncomeSearch.xhtml`
- Composite attrs: `ajax` (default true), `rows` (8), `update` (@form), `selectAction`, `otherAccountAction`, `otherActionLabel`, `allowMutipleSelection` (last three unused in implementation).
- UI: one input "Security Code" bound to `fixedIncomeSearch.fixedIncomeQP.securityCode`; button Search -> `fixedIncomeSearch.searchFixedIncome()` -> `FixedIncomeService.searchFixedIncome(fixedIncomeQP, dateRange)`; result table (`fixedIncomesList`): row toggler (ID, dayCount), Security Code (commandLink that does `f:setPropertyActionListener` -> `fixedIncomeSearch.selectedFixedIncome` then calls the page's `selectAction`), Maturity Date.
- Other bean members: `clear()` (nulls selection + list, `JsfUtil.resetViewRoot()`), `dateRange`, `searchText` (unused). Oddity: setter for `fixedIncomeQP` is misnamed `FixedIncome(FixedIncome)`.
- Session-held selection: the selected security is passed to pages via this session bean.

### secured/fixed-income/fixed-income-execution_uploads.xhtml
1. Kind: full page, template `../appTemplate.xhtml`. Title "Upload Fixed Income Execution Uploads". Menu: "Execution Upload".
2. Bean: `com.statelyhub.brokerage.jsf.equities.FixedIncomeExecutionUploadController`, `@Named("fixedIncomeExecutionUploadController")`, @SessionScoped.
3. Purpose: upload an Excel file of fixed-income executions keyed by order number, preview matched/unmatched rows, save matched rows as FixedIncomeTransaction.
4. Actions:
   - `p:fileUpload` (simple mode, multipart form) bound to `file`; button "Upload file" (non-ajax) -> `upload()`.
   - Expected file: Excel read by `ExcelDataLoader.read(path).getWorkBookData()`, first row (header) discarded. Columns: A = execution date (Date cell or string `dd/MM/yyyy`), B = order no (long), C = amount (double), D = price (double).
   - `p:tabView` (`activeIndex` = `selectedTabIndex`, ajax `tabChange` -> `onTabChange`):
     - Tab "Successful": table of `transactionsList` (rows 15, paginator): row toggler (ID), Date (`valueDate`), Order No (`fixedIncomeTradeOrder.orderNo`), Asset sub class (`fixedIncomeTradeOrder.subClass.label`), Account (`...account.accountName`), Amount (`fixedIncomeTradeOrder.amount`). Button Save (non-ajax) -> `saveUploads()`.
     - Tab "Failed": table of `failedUploads` (`FixedIncomeTransactionDetail`): toggler, Date, Order No, Amount, Price.
5. Logic / data access (ALL in the bean - must move server-side):
   - `upload()`: writes the upload to `new File(file.getFileName())` (relative path in server working dir), parses Excel, for each row looks up `QryBuilder.get(em, FixedIncomeTradeOrder.class).addObjectParam(_orderNo, orderNo).getSingleResult(...)`. Not found -> adds a `FixedIncomeTransactionDetail` (date, orderNo, amount, price) to `failedUploads`. Found -> new `FixedIncomeTransaction` with only `fixedIncomeTradeOrder` and `valueDate` set (amount and price from the file are DISCARDED - the setters are commented out).
   - `saveUploads()`: loop `crudService.save(tx)` per row, then `JsfMsg.successSave()`.
   - `parseDate(Object)` static helper (Date cast or `DateTimeUtils.parseDate(str,"dd/MM/yyyy")`).
6. Roles: none.
7. Unusual / bugs: nested `<h:form id="transactionsTable">` inside another form with the same id, twice (invalid, duplicate ids). Failed tab's Price column binds `#{transaction.price}` (wrong var - should be `failedUpload.price`), so it is always blank. All exceptions swallowed silently (empty catch) - a bad file gives no feedback. Uploaded amount/price never persisted. Saved transactions get no executionType/status/cost, so Execution Processing would sum zeros for them. Preview held in session; re-clicking Save re-saves same objects. Not dead (in menu) but looks half-finished.

### secured/fixed-income/fixed-income-execution-processing.xhtml
1. Kind: full page, template `../appTemplate.xhtml`. Title "Fixed Income Execution Processing". Menu: "Execution Processing".
2. Beans: `com.statelyhub.brokerage.jsf.FixedIncomeExecutionProcessingController` (`fixedIncomeExecutionProcessingController`, @SessionScoped); also calls `equitiesWorkingOrdersListView` (`jsf.equities.EquitiesWorkingOrdersListView`, @SessionScoped) for the row Edit button.
3. Purpose: for a chosen value date, list fixed-income executions, roll them up into authorised trades per order ("Process into Trades"), and show resulting trades plus a per-date count of unprocessed fills.
4. Actions:
   - Date picker `valueDate` (default today) + button "Load" (non-ajax) -> `init()` (= `load()` + `loadNotProcesed()`).
   - Table 1 `transactionsList` (rows 10): toggler (ID), Date (`valueDate`), Execution ID, Execution Type, Account (`fixedIncomeTradeOrder.account.accountName`), Cost, Action: button Edit (non-ajax) -> `equitiesWorkingOrdersListView.editOrderTransaction(transaction)`.
   - Button "Process into Trades" (non-ajax) -> `processTrades()`.
   - Table 2 `tradesList` (rows 10): toggler (ID, Notes, Execution ID), Trade Order (`fixedIncomeTradeOrder.orderNo`), Instrument (`fixedIncome.name`), Market, Asset Sub Class, Execution Type, Face Value, Price, Cost, Market Value, Maturity Value, Interest Rate (%), YTM (%), Maturity Date, Redemption Date, Transferred Date, Valuation Date, Status (`transactionStatus`), Interest Paid.
   - Side table `dataItemsList` (label = date, value = count of unprocessed).
5. Data access / logic:
   - `load()`: `transactionsList` = QryBuilder FixedIncomeTransaction where `valueDate = :valueDate`; `tradesList` = same plus `authorised = true` (declared as `List<EquityTransaction>` but actually holds FixedIncomeTransaction - raw-type misuse).
   - `loadNotProcesed()`: QryBuilder returning `e.valueDate, COUNT(e.id)` where `executionType IN ExecType.fills` and `valueDate = :valueDate` GROUP BY valueDate -> `DataItem(label,value)`.
   - `processTrades()` -> `FixedIncomeService.procesTodayTrades(valueDate)`: loads all FixedIncomeTransaction for the date, groups by `fixedIncomeTradeOrder`, per order finds-or-creates one trade FixedIncomeTransaction (account, valuationDate, maturityDate, isin, fixedIncome, subClass from the order; `authorised=true`, `authDate=now`; faceValue = sum, cost = sum, price = cost/faceValue), marks each execution `TransactionStatus.PROCESSED`, sets order `OrderStatus.COMPLETELY_FILLED`. (Service-side already, but status transition logic to be preserved.)
6. Roles: none.
7. Unusual / bugs: the Edit button calls the EQUITIES bean method `editOrderTransaction(EquityTradeTransaction)` with a `FixedIncomeTransaction` argument - type mismatch, will fail at runtime (EL method-not-found / ClassCast); it also does not navigate anywhere. Commented-out Delete column (also pointing at the equities bean). `processTrades()` does not reload lists afterwards (user must click Load). `groupingBy(getFixedIncomeTradeOrder)` will NPE for transactions with no order (e.g. simple transactions) - swallowed by catch. `@PostConstruct init()` runs once per session.

### secured/fixed-income/fixed-income-market-price.xhtml
1. Kind: full page (wrapped in `<html>` then `ui:composition template="./../appTemplate.xhtml"`). Title "Fixed Income Market Prices". DEAD/UNLINKED: no menu entry, include, or navigation outcome references it anywhere in `src/main/webapp` or `src/main/java` (reachable only by typing the URL).
2. Bean: `com.statelyhub.brokerage.jsf.FixedIncomeMarketPriceController` (`fixedIncomeMarketPriceController`, @SessionScoped). Injects `CrudService`, `StatelyMarketDataApiService`, `UserSession` (unused), `FixedIncomeSearch` (unused).
3. Purpose: load fixed-income market prices/yields either from an Excel upload or from the external Stately market-data repository, preview, and save them.
4. Actions:
   - Tab "Upload Data": `p:fileUpload` (`file`, simple) + button Upload (non-ajax) -> `upload()`. Table `fixedIncomeMarketPriceList` (getter returns `uploadedPricesList`; rows 10): Value Date (`secMktPrice.valueDate`), Security code (`fixedIncome.securityCode`), ISIN (`fixedIncome.isin`), Security id (`fixedIncome.securityId`), Market price (`marketPrice`), YTM (`secMktPrice.ytm`), Edit button (non-ajax) -> `editSecurity(secMktPrice)` (`update=":securityMarketForm"` - no such form exists on the page), Delete button (confirm JS) -> `deleteSecurity(secMktPrice)`. Buttons Save -> `saveUpload()`, Clear (non-ajax) -> `clearUploads()`.
   - Tab "Fetch Data": From/To date pickers (`fromDate`, `toDate`, pattern dd/MM/yyyy), Security Code (`securityCode`), ISIN (`isin`), button "Fetch From Repository" (non-ajax) -> `fetchData()`.
   - Static panel "Excel Headers": A = Date, B = ISIN | CSD_ID | System ID, C = Market Price, D = YTM.
5. Logic / data access (in the bean - move server-side):
   - `upload()`: writes file to `ExcelExporter.TEMP_DIR`, `ExcelDataLoader.read(...).getWorkBookData()`, drops header row. Per row: col B string -> lookup `FixedIncome` by `_isinCode`, fallback by `_securityCode`; rows with no match are silently skipped. Col A -> `ObjectValue.getLocalDate`; find existing `FixedIncomeMarketPrice` by (`marketDate`, `fixedIncome`) else new (upsert). Normalisation: `if (ytm <= 1) ytm *= 100; if (marketPx <= 1) marketPx *= 100;` then both rounded to 5 dp via `NumberFormattingUtils.formatDoubleNum`; sets `marketPrice`, `yield`.
   - `saveUpload()`: loop `crudService.save` per price.
   - `fetchData()`: validates date range (`dateRange.validRangeSet()` else "Select Date Range"), `StatelyMarketDataApiService.fixedIncomeMarketPrices(dateRange, securityCode, isin)` -> HTTP GET to HARD-CODED `http://65.21.3.38:8080/marketdata/api/v1/market-prices/fixed-income-prices?fromDate&toDate&securityCode&isin`, JSON mapped to FixedIncomeMarketPrice list (replaces `uploadedPricesList`; user then presses Save on the other tab).
   - `deleteSecurity()`: `crudService.delete`, removes from list. `editSecurity()`: just sets `fixedIncomeMarketPrice`.
   - Unused by this page: `loadMarketPrice()` (QryBuilder by `marketDate` range desc), `saveSecurity()`, `clearSecurity()`, `loadMarketPriceForSelectedFI()`, `selectedSecurityPricesList`, `selectedDate`.
6. Roles: none.
7. Unusual / bugs: table columns reference properties that do not exist on the entities as read: `FixedIncomeMarketPrice` has `marketDate`/`yield`/`isin` but no `valueDate` or `ytm` getter; `FixedIncome` has `isinCode`/`securityCode` but no `isin` or `securityId` getter (not verified against the library superclass `UniqueEntityModel`) - likely PropertyNotFoundException as soon as the table has rows. Edit button has no edit form to populate. Save is ajax with no `update`. Hard-coded external IP URL. Page appears to be a port from another product (`// import com.statelyhub.prime.jsf.am.FixedIncomeSearch`).

### secured/fixed-income/fixed-income-order-batching.xhtml
1. Kind: full page, template `../appTemplate.xhtml`. Title "Fixed Income Order Batches". Menu: "Order Batching".
2. Bean: `com.statelyhub.brokerage.jsf.equities.FixedIncomeOrderBatchController` (`fixedIncomeOrderBatchController`, @SessionScoped).
3. Purpose: group all un-batched PENDING fixed-income trade orders into a batch, browse/view/delete batches, remove orders from a batch.
4. Actions (list mode, rendered when `fixedIncomeOrderBatch == null`): `p:tabView` (`selectedTabIndex`, ajax `tabChange` -> `onTabChange`).
   - Tab "Pending Orders": buttons "refresh" (ajax) -> `loadPendingTradeOrdersList()`; "Batch Pending Orders" (non-ajax) -> `batchPendingOrders()`. Table `pendingTradeOrdersList` (rows 10): toggler (ID), Date (`valueDate`), Order No, Account name, Asset sub class (`subClass.label`), Amount, Qty sold (`amountSold`), Qty left (`amountLeft`), Batch: commandLink "View Batch" (rendered when `tradeOrder.fixedIncomeOrderBatch` not empty) -> `viewFixedIncomeOrderBatch(tradeOrder.fixedIncomeOrderBatch)`.
   - Tab "Fixed Income Order Batches": button "refresh" -> `loadFixedIncomeOrderBatchesList()`. Table `fixedIncomeOrderBatchesList`: toggler (ID), Date (`batchDate`), Batch tag (`batchTags`), Orders (`totalOrdersCount`), Estimated buy cost, Estimated sell cost, Estimated comms, Actions `p:menuButton`: View -> `viewFixedIncomeOrderBatch(batch)`; "export" (non-ajax) -> `generateExportData(batch)`; Delete (h:commandLink, JS confirm 'Delete?') -> `deleteFixedIncomeOrderBatch(batch)`.
   - Detail mode (rendered when `fixedIncomeOrderBatch` not empty): read-only header (Batch Date, Batch Tag, Total Orders, Estimated Cost BUY/SELL, Estimated Comms); table `batchedTradeOrdersList` (same columns as pending) with row button "remove" (JS confirm) -> `removeOrderFromBatch(tradeOrder)`; button Close (immediate, ajax) -> `resetPage()`.
5. Logic / data access (all in bean - move server-side):
   - `@PostConstruct init()`: `loadPendingTradeOrdersList()` (QryBuilder FixedIncomeTradeOrder where `orderStatus = OrderStatus.PENDING`) + `loadFixedIncomeOrderBatchesList()` (all FixedIncomeOrderBatch, no filter/order).
   - `batchPendingOrders()`: reload pending; filter those with `fixedIncomeOrderBatch == null`; if none -> info "All Pending Orders Have Been Batched". Else new `FixedIncomeOrderBatch`: `batchDate = today`, `estimatedBuyCost` = sum(amount where buySell==BUY), `estimatedSellCost` = sum(amount where SELL), `estimatedComms` = sum(estimatedComms), `totalOrdersCount`; `crudService.save(batch)` then loop: set batch on each order and `crudService.save(order)` (non-transactional loop). Leaves page in detail mode showing the new batch.
   - `viewFixedIncomeOrderBatch()`: QryBuilder FixedIncomeTradeOrder where `fixedIncomeOrderBatch = :batch`.
   - `removeOrderFromBatch()`: sets order batch null, save; batch totals/count are NOT recalculated.
   - `deleteFixedIncomeOrderBatch()`: loads batch orders, `crudService.delete(batch)`, then loop un-links each order and saves (delete happens BEFORE un-linking - FK risk).
   - `generateExportData()`: builds `List<TradeOrderModel>` (accountName, estimatedComms, estimatedCost, orderDate, amount, orderNo) and then does nothing - comment `//call api to export to broker api`. The "export" menu item is a no-op stub.
6. Roles: none. No status condition on Delete/Remove.
7. Unusual: variable/method names copied from equities (`equityOrder`, `initEquitBatchOrder` unused). Order status is not changed by batching (stays PENDING). `batchTags` never set. Session-held `fixedIncomeOrderBatch` keeps the page in detail mode across visits. Debug `System.out.println("am here")`.

### secured/fixed-income/fixed-income-redemption.xhtml
1. Kind: full page, template `../appTemplate.xhtml`. Title "Fixed Income Redemption". Menu: "Fixed Income Redemption".
2. Bean: `com.statelyhub.brokerage.jsf.equities.FixedIncomeRedemptionController` (`fixedIncomeRedemptionController`, @SessionScoped). Uses shared `accountSearch` (`getSelectedAccount()`).
3. Purpose: pick an account, list its fixed-income holdings, and record an unscheduled (early) redemption of principal plus computed interest.
4. Actions:
   - Left: `brokerage:accountSearch` (`selectAction` = `selectAccount()`, `ajax=false`, update `:mainContent`).
   - List mode (rendered when `selectedFixedIncomeTransaction` empty): From/To date pickers (`tradesDateRange.fromDate/toDate`); button "load" (ajax) -> `loadFixedIncomeTransactionsList()` (NOTE: these inputs/button sit outside any `h:form`, so they cannot submit). Table `fixedIncomeTransactionsList` (rows 10): toggler (ID), Type (`assetSubClass.label`), Trans date (`valueDate`), Interest rate, Face value, Maturity value, Maturity date, Action button "Redeem" (non-ajax) -> `redeemTransaction(trade)`.
   - Redeem mode (rendered when selected): read-only summary (transDate, account name, market, cost, faceValue, maturityDate, maturityValue); inputs Redemption Date (`redemptionDate`), Amount (`amount`), button "calculate interest" (ajax, update @form) -> `calculateInterest()`, output Interest (`interestAmount`); buttons Save (ajax) -> `saveRedemption()`, Close -> `resetRedemptionPage()`. Table `fixedIncomeRedemptionsList`: toggler (ID), Redemption Date (`valueDate`), Corporate Action Type (label), Redemption Type (label), Amount, Redemption Status (label), Delete button (JS confirm) -> `deleteRedemption(redemption)`.
5. Logic / data access (bean - move server-side):
   - `selectAccount()`: resets page, reads `accountSearch.selectedAccount`, loads list.
   - `loadFixedIncomeTransactionsList()`: requires account ("Select Account"); QryBuilder FixedIncomeTransaction where `account = :acc` + date range on `valueDate`, order asc.
   - `redeemTransaction()`: selects, zeroes inputs, loads `FixedIncomeRedemption` where `fixedIncomeInvestment = :tx`.
   - `calculateInterest()`: `rate = tx.getRate()` (interestRate for simple transactions, else from the security); `FixedIncomeService.calculateInterest(amount, rate, tx.valueDate, redemptionDate)` = `amount * rate/100 * days/365` (simple interest, ACT/365).
   - `saveRedemption()`: validations (redemptionDate not null "Select Valid Redemption Date"; amount > 0 "Input Valid Amount"). Generates `batchId = crudService.generateId()`; creates and saves TWO `FixedIncomeRedemption` rows sharing the batch: PRINCIPAL_REDEMPTION (amount) and INTEREST_PAYMENT (interestAmount), both `RedemptionType.UN_SCHEDULED`, `authorised = true` (auto-authorised, no maker-checker), transDate = valueDate = redemptionDate, account + investment from the transaction.
   - `deleteRedemption()`: `crudService.deleteAll(FixedIncomeRedemption._batch, batch, FixedIncomeRedemption.class)` - deletes both rows of the batch.
6. Roles: none. No check that amount <= outstanding face value, that redemption date >= value date, or that interest was actually calculated before Save (stale/zero interest is saved as-is). No cash/ledger posting visible in the bean.
7. Unusual: filter inputs outside a form (dead controls); stray `>` text after the ID output in both row expansions; interest row saved even when 0. Session-held selected account/transaction.

### secured/fixed-income/fixed-income-trade-order.xhtml
1. Kind: full page, template `../appTemplate.xhtml`. Title "Trade Orders". Menu: "Orders".
2. Bean: `com.statelyhub.brokerage.jsf.FixedIncomeTradeOrderController` (`fixedIncomeTradeOrderController`, @SessionScoped). Injects `CrudService`, `SingletonIdService`, `FixedIncomeReportService`, `AccountSearch`.
3. Purpose: list fixed-income trade orders by date range, create/edit/delete an order (account, date, asset sub-class, amount), print the order list.
4. Actions:
   - List mode (`tradeOrder == null`): From/To (`dateRange.fromDate/toDate`); button Search -> `loadTradeOrders()` (attribute typo `ajax="fales"`); h:commandLink Print (`target=_blank`) -> `printTradeOrders()`; button "Add new Trade order" (non-ajax) -> `clearTradeOrder()`.
   - Table `tradeOrdersList` (rows 10): toggler (ID), Date (`valueDate`), Order No, Account name, Asset sub class (`subClass.label`), Amount, Qty sold (`amountSold`), Qty left (`amountLeft`), Edit (non-ajax) -> `editTradeOrder(tradeOrder)`, Delete (JS confirm) -> `deleteTradeOrder(tradeOrder)`.
   - Form mode (`tradeOrder` not empty): left `brokerage:accountSearch` (`selectAction` = `selectAccount()`, ajax); form `tradeOrderForm`: Account (read-only name), Date (`tradeOrder.valueDate`, required), Asset sub class (`p:selectOneMenu` filter, source `commonOptions.assetSubClassList`), Amount (`tradeOrder.amount`). Buttons Save (non-ajax) -> `saveTradeOrder()`, Clear -> `clearTradeOrder()`, Close (immediate) -> `resetPage()`.
5. Logic / data access (bean - move server-side):
   - `@PostConstruct loadTradeOrders()`: QryBuilder FixedIncomeTradeOrder with date range on `valueDate`, order desc (empty range on first load => all orders).
   - `clearTradeOrder()`: new order with `OrderStatus.PENDING`.
   - `validateOrder()`: account required; valueDate required; subClass required; amount > 0; buySell required ("Choose buy or sell"); maturityDate not before valueDate.
   - `confirmOrder()` / `orderConfirmed` flag / `unconfirmOrder()`: confirm step computes `maturityValue = amount + projectedInterest`; `getProjectedInterest()` = `amount * yield/100 * daysToMaturity/365` (simple interest); `getDaysToMaturity()`; `selectSecurity()` copies ISIN, maturityDate, assetSubClass and defaults yield from coupon; `changeAccount()`, `isAccountSelected()`, `getSaveLabel()`/`getSaveStyle()` (BUY/SELL dependent); `loadSelectedAccountTradeOrders()`.
   - `saveTradeOrder()`: validate; requires `orderConfirmed` ("Confirm the order before saving it"); if no orderNo -> `SingletonIdService.tradeId(order)` (NUMBER GENERATION: `yyMMdd` of valueDate + 3-digit zero-padded (count of orders on that date + 1), parsed to Long - race-prone); if new: `amountLeft = amount`, `amountSold = 0`; `crudService.save`; then `resetPage()`.
   - `deleteTradeOrder()`: `crudService.delete` (no status check - a working/filled order can be deleted).
   - `printTradeOrders()`: `FixedIncomeReportService.orders(tradeOrdersList)` (PDF report in new tab); error "Please load some orders!" if list null.
6. Roles: none.
7. Unusual / APPARENT BUG: the bean has been rewritten for a richer "ticket" flow (buy/sell, security, yield, maturity, confirm step) that this xhtml does not implement. The page has no Buy/Sell input and no Confirm button, so `saveTradeOrder()` always fails here ("Choose buy or sell", or "Confirm the order before saving it"). No other xhtml in the webapp references `fixedIncomeTradeOrderController` (grep), so the confirm/projection/selectSecurity methods are currently unused by any view - the intended UI is either missing or not yet committed. Commented-out account dropdown (`commonOptions.accountsList`). Session-held `tradeOrder` keeps the form open across navigation.

### secured/fixed-income/fixed-income-transactions.xhtml
1. Kind: full page, template `../appTemplate.xhtml`. Title "Fixed Income Transactions". Menu: "Trade".
2. Bean: `com.statelyhub.brokerage.jsf.FixedIncomeTransactionController` (`fixedIncomeTransactionController`, @SessionScoped). Uses `accountSearch`, `fixedIncomeSearch`, `commonOptions`.
3. Purpose: direct capture of fixed-income transactions (purchases) for a chosen transaction date: pick account + security, enter market/currency/cost etc., save.
4. Actions:
   - Step 0 (rendered when `selectedDate` empty): date picker `selectedDate` + button "Capture Transaction" (non-ajax) -> `initiateTransaction()`.
   - List mode (`fixedIncomeTransaction == null`): button "Add new Fixed Income Transaction" -> `resetFixedIncome()`. Table `fixedIncomeTransactionsList` (no paginator): Trans date, Account name, Security code (commandLink -> `selectFixedIncomeTransaction(transaction)`, `disabled="#{transaction.authorised}"`), Market, Cost, Face value, Maturity date (`fixedIncome.maturityDate`), Maturity value, Select link (non-ajax, NOT disabled when authorised) -> `selectFixedIncomeTransaction`, Delete link (JS confirm, `disabled` when authorised) -> `deleteFixedIncomeTransaction(transaction)`.
   - Form mode (`fixedIncomeTransaction` not empty): `p:tabView id="transactionTabView"` (`activeIndex`, ajax `tabChange` -> `onTabChange`), single tab "Fixed Income":
     - Button "Search Accounts ....." opening `p:overlayPanel` with `brokerage:accountSearch` (`selectAction` = `selectAccount()`).
     - `brokerage:fixedIncomeSearch` (`selectAction` = `selectFixedIncome()`).
     - Form `fixedIncomeInputForm`: read-only Account, Security code, Transaction date, Issue date (`fixedIncome.valueDate`); Market (required; `commonOptions.fiMarketTypeList`; `p:ajax` re-renders form to toggle conditional fields); Currency (required; `commonOptions.currencyEnumsList`); Face value, YTM, Price (required) - all three rendered only when `fixedIncomeTransaction.secondaryTransaction` (market == SECONDARY); Transfer date - rendered only when `transferredTransaction` (market == TRANSFER); Cost (required); Scheduled Redemption Interest Amount; Investment cert no. Buttons Save (non-ajax) -> `saveFixedIncomeTransaction()`, Clear (immediate) -> `resetFixedIncome()`.
     - Table `selectedAccountTransactionsList` (same columns minus Account; Delete without confirm).
     - h:commandButton Close -> `closePage()`.
   - h:commandButton "Reset Page" -> `resetPage()` (clears `selectedDate` + list).
5. Logic / data access (bean):
   - `initiateTransaction()`: QryBuilder FixedIncomeTransaction where `transDate = :selectedDate`.
   - `selectAccount()`: `accountSearch.selectedAccount` -> `resetFixedIncome()`, set account, `loadSelectedAccountTransactions()` (QryBuilder by `account` + `transDate`).
   - `resetFixedIncome()`: new transaction with `transDate = selectedDate`, `JsfUtil.resetViewRoot()`.
   - `selectFixedIncome()`: sets `fixedIncome` from `fixedIncomeSearch.selectedFixedIncome`.
   - `saveFixedIncomeTransaction()`: only validation is account != null ("Select Account"); FORCES `valueDate = LocalDate.now()`; plain `crudService.save` - the proper `FixedIncomeService.saveFixedIncomeTransaction(...)` call (which validates, builds description/counterparty etc.) is COMMENTED OUT, so service-side business rules are bypassed.
   - `deleteFixedIncomeTransaction()`: `crudService.delete`, no server-side authorised check (only the link's `disabled`).
6. Roles: none. Status-tied: security-code link and Delete link `disabled="#{transaction.authorised}"`; "Select" link is not disabled, so authorised transactions can still be opened and re-saved.
7. Unusual / bugs: list-mode table's `update` targets `:transactionTabView:...` which is not rendered in list mode; duplicate form id `fixedIncomeTransactionsList` (list mode + inside tab); `selectAccount()` NPEs in its trailing `System.out.println` if no account is selected; security not required on save; Close (`closePage`) calls `resetFixedIncome()` which creates a new transaction, so it never returns to list mode - only "Reset Page" does (and that leaves `fixedIncomeTransaction` set). Commented-out fund/user-fund scoping (`userSession.getFundUR()`) - ported from an asset-management product. Session-held date/account/transaction.

### secured/fixed-income/fixed-income-working-orders.xhtml
1. Kind: full page, template `../appTemplate.xhtml`. Title "Working Orders". Menu: "Working Transactions".
2. Bean: `com.statelyhub.brokerage.jsf.FixedIncomeWorkingOrdersListView` (`fixedIncomeWorkingOrdersListView`, @SessionScoped). Uses `fixedIncomeSearch`, `commonOptions`.
3. Purpose: list working (open) fixed-income orders and record execution transactions (fills) against a selected order; print the order's transactions.
4. Actions:
   - List mode (`tradeOrder` empty): a toolbar form with `rendered="false"` (Load -> `loadTradeOrders()`, Print -> `printTradeOrders()` [empty stub], Add new -> `clearTradeOrder()`) - permanently hidden. Table `tradeOrdersList` (rows 10): toggler (ID), Date, Order No, Account name, Asset sub class, Amount, Amount Left, Amount Sold, Status (`orderStatus`), button Manage (non-ajax) -> `editTradeOrder(tradeOrder)`. Delete column inside `ui:remove`.
   - Manage mode (`tradeOrder` not empty): panel "Select Fixed Income" with `brokerage:fixedIncomeSearch` (`selectAction` = `selectFixedIncome()`); form `tradeOrderForm` "Create Fixed Income Transaction": read-only Order No / Account / Amount (from `transaction.fixedIncomeTradeOrder`), Security code, Transaction date (`transaction.valueDate`, required), Issue date; Market (required, `commonOptions.fiMarketTypeList`, ajax re-render of `:mainContent`); Currency (required, `commonOptions.currencyEnumsList`); Execution type (required, `commonOptions.execTypesList`); Cost; Face value / YTM / Price (required) rendered when `transaction.secondaryTransaction`; Transfer date rendered when `transferredTransaction` (uses `msg.date_pattern`, others use `date_pattern_1`). `ui:remove`d: Scheduled Redemption Interest Amount, Investment cert no. Buttons Save (non-ajax) -> `saveOrderTransaction()`, Clear -> `initOrderTransaction()`.
   - h:commandLink "Print Transactions" (`target=_blank`) -> `printFixedIncomeTransaction()`.
   - Table `transactionsList` (rows 10): toggler (ID), Date, Security code, Market, Face value, Cost, Maturity date, Maturity value, Execution ID, Execution type, Edit (non-ajax) -> `editOrderTransaction(transaction)`. Delete column `ui:remove`d.
   - Close (immediate) -> `resetPage()`.
5. Logic / data access (bean):
   - `loadTradeOrders()`: QryBuilder FixedIncomeTradeOrder where `orderStatus IN OrderStatus.workingOrders`. Called from the GETTER `getTradeOrdersList()` - i.e. a DB query on every EL evaluation/render pass.
   - `editTradeOrder()` -> `initOrderTransaction()`: `resetOrderTransaction()` (new FixedIncomeTransaction: order, `buySell` from order, `valueDate` from order, `TransactionStatus.NOT_PROCESSED`, `BondValuationMethod.NO_AMORTISATION`) + QryBuilder FixedIncomeTransaction where `fixedIncomeTradeOrder = :order`.
   - `saveOrderTransaction()`: plain `crudService.save(transaction)` - no validation (security not required, cost not validated, no check against order amount), does NOT set the transaction's account, does NOT update order `amountLeft`/`amountSold`/status, no executionId generation. (Service call commented out.)
   - `printFixedIncomeTransaction()`: `FixedIncomeReportService.transactions(transactionsList)` (PDF).
   - `deleteTradeOrder(FixedIncomeTransaction)` exists (misnamed; deletes a transaction) but is unreachable (ui:remove).
6. Roles: none.
7. Unusual / bugs: `saveOrderTransaction()` shows BOTH success and failure messages on success (falls through to `JsfMsg.failedSave()` because the `return` is commented out). Query-in-getter. Hidden toolbar. Session-held `tradeOrder`/`transaction`.

### secured/fixed-income/simple-transaction.xhtml
1. Kind: full page, template `../appTemplate.xhtml`. Title "Trades". Menu: "Simple Transaction".
2. Bean: `com.statelyhub.brokerage.jsf.equities.SimpleFixedIncomeTransactionController` (`simpleFixedIncomeTransactionController`, @SessionScoped). Uses `accountSearch`, `commonOptions`, `userSession.getUserUR().getEmailAddress()`.
3. Purpose: capture "simple" fixed-income placements (no security master record): account, asset type, amount, rate, start date, tenor -> maturity date; list/edit/delete/print them per account.
4. Actions:
   - Left panel: `brokerage:accountSearch` (`selectAction` = `selectAccount()`, ajax); From/To date pickers (`dateRange.fromDate/toDate`) - no explicit Load button; they apply only when an account is (re)selected.
   - Form `tradeForm`: Account (read-only `selectedAccount.accountName`); Asset Type (`trade.assetSubClass`, source `commonOptions.assetSubClassList`, filterable); Authorised checkbox (`trade.authorised` - user can self-authorise); Amount (bound to `trade.cost`); Interest rate (`trade.interestRate`); Start Date (`trade.valueDate`, `p:ajax event="dateSelect"` -> `onStartDateChange`, updates `maturityDate`); Tenor (`trade.tenor`, source `commonOptions.fixedIncomeTenorList`, `p:ajax` -> `onTenorSelected`, updates `maturityDate`); Maturity date (`trade.maturityDate`, editable). Buttons Save (non-ajax) -> `saveTrade()`, Clear -> `clearTrade()`.
   - Table form `tradeTable`: Print link (`target=_blank`) -> `printTradeReport()`; table `tradesList` (rows 10): toggler (ID), Type (`assetSubClass.label`), Trans date (`valueDate`), Interest rate, Face value, Maturity value, Maturity date, Edit (non-ajax) -> `editTrade(trade)`, Delete (JS confirm) -> `deleteTrade(trade)`.
5. Logic / data access:
   - `selectAccount()`: reads `accountSearch.selectedAccount`, `loadTrades()` (QryBuilder FixedIncomeTransaction where `account = :acc` + date range on `valueDate`, asc - not restricted to simple transactions), `clearTrade()`.
   - `clearTrade()` (bean): new transaction with `simpleTransaction = true`, `market = FIMarketType.PRIMARY`, account, `inputBy = userSession.getUserUR().getEmailAddress()`; error "Select An Account" if none.
   - `updateMaturityDate()` (bean calc): `maturityDate = valueDate.plusDays(tenor.getNumberOfDays())`.
   - `saveTrade()`: `transDate = valueDate`; `FixedIncomeService.saveFixedIncomeTransaction(trade)` (service-side validation: account, transDate; builds description `tenor + subclass @ rate`; etc.); prints the ProcessingMessage.
   - `deleteTrade()`: bean-side rule "Cannot Delete An Authorised Transaction", else `crudService.delete`.
   - `printTradeReport()`: `FixedIncomeReportService.transactions(tradesList)` (PDF); "No records to print" if null.
6. Roles: none. Status rule: delete blocked for authorised (in bean only; Edit of an authorised trade is still allowed). Authorised flag is a plain checkbox on the entry form.
7. Unusual: stray `>` after ID in row expansion; on success two success messages (service message + `successSave`); the bean's `trade` is initialised without `simpleTransaction`/account until an account is picked, so saving before selecting an account relies on the service's "Please select Account" error. Session-held account and trade.

## Module: support

Both pages and both controllers were read in full. Both are full pages on `../appTemplate.xhtml`, defining `pageTitle`, `pageSubTitle`, `pageActions`, `pageContent`. Both are newer-style pages (`st-*` design-system classes, `p:messages`, ajax everywhere) and are linked from `app-menues.xhtml` "Client Care" submenu (lines 110-111). Both beans are @SessionScoped. Neither page has role checks.

### secured/support/cases.xhtml
1. Kind: full page, template `../appTemplate.xhtml`. Title "Client Care". Three mutually exclusive views inside one page: Register (list), Log a case (create), Desk (work a case). Also linked twice from the dashboard `secured/index.xhtml` (`h:link outcome="/secured/support/cases"` for "Cases past their target" and "Cases with no owner" - no filter/params carried, just a plain link).
2. Bean: `com.statelyhub.brokerage.jsf.support.CaseController` (`caseController`, @SessionScoped). Injects `CrudService`, `CaseService`, `CaseAttachmentStore`, `UserSession`, `InvestorSearch`, `BrokerageReportManager`. Shared: `commonOptions` (`caseStatusList`, `caseTypeList`, `casePriorityList`, `caseTeamList`, `caseCategoryList`, `caseChannelList`, `caseResolutionCodeList`, `caseVisibilityList`, `userAccountList`), `userSession` (`getUserUR()`, `getAccountName()`), `investorSearch.getSelectedInvestor()` via `brokerage:investorSearch`.
3. Purpose: complaints/queries/service-request register with SLA tracking, plus a case desk for acknowledging, assigning, replying, escalating, resolving, closing and reopening cases.
4. Actions:
   - Header actions (form `caseHeadActions`; first four rendered when `not deskOpen and not creating`): Refresh -> `loadCases()`; "My queue" -> `showMyQueue()`; "Print register" (non-ajax, PDF) -> `printRegister()`; "Log a case" -> `newCase()`; "Back to register" (rendered when `deskOpen or creating`) -> `closeDesk()`.
   - REGISTER view:
     - Six stat tiles: `openCount` (of `totalCount`), `unassignedCount`, `breachedCount`, `atRiskCount`, `escalatedCount`, `complaintCount`.
     - Filters (form `caseFilterForm`): From/To (`fromDate`, `toDate`; default last 3 months), Status (`filterStatus` <- `commonOptions.caseStatusList`), Type (`filterType` <- `caseTypeList`), Priority (`filterPriority` <- `casePriorityList`), Team (`filterTeam` <- `caseTeamList`, entity `CaseTeam.teamName`), checkboxes "Past target" (`breachedOnly`) and "Assigned to me" (`mineOnly`); Apply -> `loadCases()`; Reset -> `clearFilters()`.
     - Table `casesTbl` (widgetVar `casesTable`, `filteredValue=filteredCases`, `globalFilterOnly`, rows 15): client-side global search box (keyup -> `PF('casesTable').filter()`; "Search reference, client or subject"), "Showing shownCount of totalCount". Columns: Reference (sortable; commandLink -> `openCase(row)`; sub = `caseType.label`), Client (`investor.displayName`; sub = `account.accountCode` or "No account linked"), Subject (sub = `category.fullName` or "Uncategorised" + "via `channel.label`"), Priority pill (`priorityStyle`), Status pill (`statusStyle`; "Escalated" sub when `row.escalated`), Owner (`owner.accountName` or "Unassigned"; sub team), Reported (`reportedAt` dd/MM/yyyy HH:mm), Target (when `row.open`: `slaLabel` + progress bar width `slaPercentUsed`% styled `slaStyle`; else "Settled"), Action button -> `openCase(row)`.
   - LOG A CASE view (rendered when `creating`):
     - Client card: `brokerage:investorSearch` (`selectAction` = `pickInvestor()`) when `not investorSelected`; else picked-client chip (initials, displayName, investorCode, emailAddress) with "Change" -> `clearInvestor()` and Account dropdown (`supportCase.account` <- `caseController.clientAccounts`, label `accountCode - accountName`, "Not about one account" null option).
     - Form `caseCreateForm`: Type* (`caseTypeList`), Category* (`caseCategoryList`, label `fullName`; `p:ajax valueChange` -> `categoryChanged()`), Channel* (`caseChannelList`), Priority (`casePriorityList`; `p:ajax valueChange` -> `categoryChanged()`), Subject* (max 250), Description* (textarea), Team (`caseTeamList`, null = "Route by category"), read-only "Acknowledge by" (`ackDueAt`) and "Resolve by" (`resolveDueAt`). Buttons Cancel (immediate) -> `closeDesk()`; "Raise case" -> `saveNewCase()`.
   - DESK view (rendered when `deskOpen`):
     - Header: reference, subject, client name/email, account code, reported time + channel, `ageHours`, `messageCount`; pills for status, priority, type, Escalated, "Acknowledgement missed" (`ackBreached`), "Resolution missed" (`resolveBreached`); SLA box (`slaLabel`/"Settled", bar, due time); Owner box (owner/team).
     - Action bar (form `caseDeskActions`), each ajax updating `:mainContent`: Acknowledge (rendered `canAcknowledge`) -> `acknowledgeCase()`; "Take this case" (rendered `not mine and supportCase.open`) -> `takeCase()`; "Wait on client" (rendered `open`) -> `awaitClient()`; Escalate (rendered `open and not escalated`) -> `escalateCase()`; Resolve (rendered `canResolve`) -> `startResolution()`; Close (rendered `canClose`) -> `closeCase()`; Reopen (rendered `canReopen`) -> `reopenCase()`; free-text `actionNote` ("Note for the trail (optional)") used by awaitClient/escalate/close/reopen.
     - Resolution card (rendered when `resolution` not empty; form `caseResolutionForm`): Outcome* (`resolution.resolutionCode` <- `commonOptions.caseResolutionCodeList`), Compensation paid (`p:inputNumber`, 2 dp, `compensationAmount`), Root cause* (max 250), What was done (`remedy`); all `disabled="#{not supportCase.open}"`; button "Record resolution" (rendered when open) -> `resolveCase()`.
     - Conversation: `ui:repeat` over `thread` (CaseMessage: `fromClient`, `internal`, `authorName`, `sentAt`, `body`); composer form `caseComposerForm` (multipart): textarea `replyBody`, visibility dropdown (`replyVisibility` <- `caseVisibilityList`; default CLIENT), channel dropdown (`replyChannel` <- `caseChannelList`; default PORTAL), `p:fileUpload` simple (`uploadFile`), Send (non-ajax) -> `sendReply()`.
     - Routing card (form `caseAssignForm`): Owner (`assignTo` <- `commonOptions.userAccountList`, "Unassigned" null), Team (`assignTeam` <- `caseTeamList`), Category (`supportCase.category`), Priority (`supportCase.priority`); buttons Reclassify -> `reclassifyCase()`; Assign -> `assignCase()`.
     - Attachments card: `ui:repeat` over `attachments` (fileName, readableSize) - display only, NO download link.
     - Audit trail: `ui:repeat` over `history` (CaseEvent: `eventType.label`, `occurredAt`, `actor`, `note`).
5. Services / logic:
   - `@PostConstruct loadCases()`: QryBuilder SupportCase with optional equality params `caseStatus`, `caseType`, `priority`, `team`, `owner = userSession.getUserUR()` (when mineOnly), `orderByDesc(reportedAt)`; then IN-MEMORY filtering in the bean (`applyLocalFilters`): date window on `reportedAt` [from 00:00, to+1day) and `breachedOnly` (ackBreached or resolveBreached). Whole table is loaded then filtered in Java - must become a server-side paged query.
   - Stat getters computed in the bean by looping `casesList` on every render: open, unassigned (open & no owner), breached (open & ack/resolve breached), at-risk (open, not resolve-breached, `slaPercentUsed >= 75`), escalated (open & escalated), complaints (`caseType == COMPLAINT`, any status).
   - `newCase()` defaults: channel PHONE, type COMPLAINT, priority MEDIUM, `reportedAt = now`.
   - `pickInvestor()`: QryBuilder Account where `principalInvestor = :investor`; auto-selects the account when exactly one. `getClientAccounts()` runs the same query in a getter (per render).
   - `categoryChanged()`: for unsaved cases copies `category.defaultPriority` and `category.team` onto the case (note: the Priority dropdown's ajax also calls this, so changing priority manually is overwritten back to the category default when a category is selected), then `CaseService.applySlaTargets(case)` (computes ackDueAt/resolveDueAt).
   - `saveNewCase()`: bean validation (investor required; subject required - description and category are marked * in the UI but NOT validated), `CaseService.raiseCase(case, actorName())` (reference generated server-side by `SingletonIdService.initCaseReference`, format `CS-yyMMdd-NNN`), then opens the desk.
   - Desk: `refreshDesk()` -> `CaseService.thread(case, true)`, `.history(case)`, `.attachments(case)`, `.resolutionOf(case)`.
   - Transitions (all via CaseService, already server-side): `acknowledge(case, user)`, `assign(case, owner, team, actor)` (takeCase assigns current user keeping team; assignCase requires owner or team), `reclassify(case, category, priority, actor)`, `addStaffMessage(case, user, body, visibility, channel)`, `awaitClient(case, actor, note)` (pauses clock), `escalate(...)`, `resolve(case, resolution, user)` (bean validates resolutionCode and rootCause), `close(...)`, `reopen(...)`.
   - Attachment upload: `CaseAttachmentStore.store(case, message, fileName, contentType, size, inputStream, actor)` (extension allow-list, 10 MB; stored on disk under configured folder or `~/brokerage-attachments`), then `CaseService.writeEvent(case, ATTACHMENT_ADDED, null, status, actor, fileName)`.
   - View-state rules in bean: `deskOpen = supportCase != null && !creating`; `canAcknowledge = acknowledgedAt == null`; `canResolve = open`; `canClose = status == RESOLVED`; `canReopen = !open`; `mine = owner equals current user`; `ageHours` = hours from reportedAt to resolvedAt-or-now; `actorName()` = user accountName / session accountName / "Back office".
   - SLA presentation logic lives on the ENTITY `SupportCase` (transient getters `isOpen`, `getStatusStyle`, `getPriorityStyle`, `getSlaPercentUsed`, `getSlaLabel` ("5h 12m left"/"over"), `getSlaStyle`, `getMinutesToResolve`) - must be reproduced in the API DTO or the Angular client. Breach flags are set by `CaseService.sweepSlaBreaches()` (scheduled elsewhere).
   - `printRegister()` (PDF): builds `ComplaintRegisterDetails` rows in the bean from the currently filtered list (reference, reported date, client, type, category, priority, status, owner, hoursToAcknowledge, hoursToResolve net of `pausedMinutes`, SLA outcome Open/Met/Missed, outcome label via `caseService.resolutionOf` per row = N+1 queries) and calls `BrokerageReportManager.generateComplaintsRegisterReport(rows, "from to to")`. `hoursBetween` rounds to 1 dp.
6. Roles: none (any back-office user can assign, resolve, close, reopen, see internal notes). Only state-based rendering as listed (`canAcknowledge`, `canResolve`, `canClose`, `canReopen`, `mine`, `open`, `escalated`) and `disabled="#{not supportCase.open}"` on resolution fields.
7. Unusual / bugs: audit-trail `ui:repeat` uses `var="trail"` but two expressions reference `event` (`event.eventType eq 'RESOLVED'`, `rendered="#{not empty event.note}"`) - the note is therefore never shown and the 'is-ok' class never applied. Attachments cannot be downloaded from this page (store has `read()`/`pathOf()` but no UI). Reclassify uses the live-bound `supportCase.category/priority` (already mutated on the session entity before the service call). Global search only filters client-side over the loaded page set. Session-scoped: the open case/desk persists across navigation; `interactions.xhtml` reuses `caseController.casesList` for its "Linked case" dropdown (so it reflects whatever filters were last applied here). Dashboard links carry no state (do not pre-apply "breached"/"unassigned" filters). No polling.

### secured/support/interactions.xhtml
1. Kind: full page, template `../appTemplate.xhtml`. Title "Client Contact Log". Menu: Client Care > "Contact Log". List view and form view toggled by `interactionController.interaction == null`.
2. Bean: `com.statelyhub.brokerage.jsf.support.InteractionController` (`interactionController`, @SessionScoped). Also reads `caseController.casesList` (session bean, for the Linked-case dropdown), `commonOptions.interactionTypeList`, `commonOptions.interactionDirectionList`, `investorSearch.getSelectedInvestor()`, `userSession.getUserUR()`.
3. Purpose: log and browse client contacts (calls, emails, meetings, visits), optionally linked to a support case.
4. Actions:
   - Header (rendered in list view): Refresh -> `loadInteractions()`; "Record contact" -> `newInteraction()`.
   - Filters (form `interactionFilterForm`): From/To (`fromDate`, `toDate`; default last month), Kind (`filterType` <- `commonOptions.interactionTypeList`), Apply -> `loadInteractions()`.
   - Table `interactionsTbl` (widgetVar `interactionsTable`, `filteredValue=filteredInteractions`, `globalFilterOnly`, rows 15): client-side global search ("Search client or subject"), "Showing shownCount of totalCount". Columns: When (`occurredAt`, sortable), Client (`investor.displayName` + `investorCode`; filterBy), Kind (`interactionType.label` + `direction.label`; sortable), Subject (+ `summary`; filterBy), Case (`supportCase.caseReference` or em-dash), Recorded by (`recordedBy.accountName`), Action: Edit -> `editInteraction(row)`; Delete -> `deleteInteraction(row)` with `p:confirm` + global `p:confirmDialog` (Close/Delete).
   - Form view: client card - `brokerage:investorSearch` (`selectAction` = `pickInvestor()`) when `not investorSelected`, else chip (initials, displayName, emailAddress) + Change -> `clearInvestor()`. Form `interactionForm`: Kind* (`interaction.interactionType` <- `interactionTypeList`), Direction (`interactionDirectionList`), When* (`occurredAt`, date+time picker), Linked case (`interaction.supportCase` <- `caseController.casesList`, label `caseReference - subject`, null = "Not linked to a case"), Subject* (max 250), Summary (textarea). Buttons Close (immediate) -> `resetPage()`; Save -> `saveInteraction()`.
5. Logic / data access (bean - move server-side):
   - `@PostConstruct loadInteractions()`: QryBuilder ClientInteraction optional `interactionType = :filterType`, `orderByDesc(occurredAt)`; then in-memory date-window filter `withinWindow` ([from 00:00, to+1 day); rows with null `occurredAt` always kept). Loads the whole table.
   - `newInteraction()`: `occurredAt = now`, `recordedBy = userSession.getUserUR()`.
   - `saveInteraction()`: validation investor required ("Select the client this contact was with."), subject required; defaults `recordedBy`; `crudService.save`.
   - `deleteInteraction()`: `crudService.delete` (hard delete, no ownership check).
   - `interactionsOf(Investor)`: QryBuilder by investor desc - not used by this page (intended for a desk side panel; no xhtml references it).
6. Roles: none - any user can edit/delete anyone's contact record.
7. Unusual: Linked-case dropdown is fed from the other session bean's currently-filtered register (cases outside the Cases page's active filters/date window cannot be linked, and the list is not restricted to the selected client's cases). Kind/When marked required in UI but not validated in the bean. Session-held `interaction` keeps the form open across navigation. No polling.

---

## Module: sysadmin

Scope: all 23 `.xhtml` files actually present in `src/main/webapp/secured/sysadmin/` (the brief said 25; the directory listing shows 23, no sub-directories). Every page and every existing backing bean was read in full. Two beans referenced by pages do not exist anywhere in the source tree (see `issuers.xhtml`, `security-issuer.xhtml`).

### Module-wide facts (apply to every page below unless stated)

- **Template**: every page is a full page: `ui:composition template="./../appTemplate.xhtml"` (`secured/appTemplate.xhtml`), filling `pageTitle`, optionally `pageSubTitle` / `pageActions`, and `pageContent`. No page in this folder is included by another page (`grep ui:include` for these file names: no hits) and none is a composite component.
- **Menu**: `appTemplate.xhtml:56` includes `menus/app-menues.xhtml` only. `menus/app-menues-old.xhtml` is not included anywhere (unused). All pages except `change-password.xhtml` are linked from the "System Admin" section of `app-menues.xhtml` (lines 134-221). No Java navigation-outcome string points at any sysadmin page.
- **Role / permission checks: none.** There is no `rendered=` or `disabled=` on a role or user type in any of these pages, and the System Admin menu block in `app-menues.xhtml` has no `rendered` conditions at all. `web.xml` has no security constraints. The only gate is `jsf/listeners/BrokeragePhaseListener`, which redirects to login when the viewId contains "secured" and `userSession.userUR == null`. Any logged-in back-office user can open every page, including User Accounts.
- **Scope**: every backing bean here is `@SessionScoped` `@Named`. Lists are loaded once in `@PostConstruct` and cached for the whole session (session timeout 600 min in web.xml); the "Load"/"Refresh" buttons exist to re-query. The "currently edited" entity is also session state, so list-vs-form mode (`bean.entity == null`) survives navigation away and back.
- **Persistence**: beans inject `CrudService` directly and call `crudService.save(entity)`, `crudService.delete(entity)`, `crudService.findAll(Class)`, and `QryBuilder.get(crudService.getEm(), X.class)...buildQry().getResultList()` (query built in the bean, not in a service). There is no service layer for the simple CRUD pages. `CollectionHelper.checkAdd(list, entity)` keeps the cached list in sync after save.
- **Messages**: `JsfMsg.successSave()/failedSave()/successDelete()/failedDelete()/error()/info()`.
- **No** polling, push, timers, PDF/Jasper exports in this module. Only one export exists (Excel on `issuers.xhtml`, which is broken).
- Recurring typo: `ajax="fales"` on many "Load" buttons (evaluates to non-ajax full postback).
- `commonOptions` properties used across the module (bean covered elsewhere): `stockExchangesList`, `industriesList`, `registrarsList`, `stocksList`, `feesList`, `applicationModeList`, `assetSubClassList`, `ratePolicyList`, `currencyEnumsList`, `fixedIncomeTenorList`, `fixedIncomeDayCountList`, `securityIssuerList`, `assetClassList`, `countryList`, `activeInactiveStatusList`, `casePriorityList`, `caseTeamList`, `userAccountList`, and `issuerList` (**does not exist** in `CommonOptions`). `userSession.userUR.emailAddress` used by change-password. `navHelper` is not used by any page here.

---

### secured/sysadmin/bank-account.xhtml
1. Full page, `appTemplate.xhtml`. Newer "st-" styled list/form layout.
2. `com.statelyhub.brokerage.jsf.BankAccountController`, `@Named("bankAccountController")`, `@SessionScoped`.
3. CRUD for the firm's bank accounts (bank name + account name) used for client money/settlement.
4. Actions:
   - Page actions (list mode only): **Load** -> `loadBankAccounts()`; **Add new Bank Account** -> `newBankAccount()`.
   - List: client-side global search box (`PF('bankAccountsTable').filter()`, `globalFilterOnly`, `filteredValue=filteredBankAccounts`), "Showing `shownCount` of `totalCount`". Columns: bank name (sortable), account name (sortable), active status pill, actions. 10 rows/page.
   - Row: **Edit** (pencil) -> `editBankAccount(bankAccount)`; **Delete** (trash) -> `deleteBankAccount(bankAccount)` behind global `p:confirmDialog` ("Delete <bank> <account>?").
   - Form (when `bankAccount != null`): Bank name* (text), Account name* (text), Active (checkbox). Buttons: **Close** -> `resetPage()` (immediate); **Clear** -> `clearBankAccount()`; **Save** -> `saveBankAccount()`.
5. `QryBuilder.get(em, BankAccount.class).orderByAsc(BankAccount._bankName)`; `CrudService.save`, `CrudService.delete`. No business logic beyond CRUD. Delete failure message assumes FK constraint ("may still be in use").
6. None.
7. Session-held edit state. Referenced from `app-menues.xhtml:195` (and the unused old menu). Not dead.

### secured/sysadmin/bank-branches.xhtml
1. Full page, `appTemplate.xhtml`. Old-style form above table.
2. `jsf.sysadmin.BankBranchController`, `@Named("bankBranchController")`, `@SessionScoped`.
3. CRUD for bank branches.
4. Actions:
   - Form: Bank (filterable `p:selectOneMenu` fed by `bankBranchController.banksList`), Branch name, Sort code, SWIFT code, Active (checkbox). **Save** -> `saveBankBranch()`; **Clear** -> `clear()`.
   - Table (15 rows/page): sort code, SWIFT code, branch name (column filter + sort), bank name (column filter + sort), active (read-only checkbox). Row links: **Select** -> `selectBankBranch(bankBranch)`; **Delete** -> `deleteBankBranch(bankBranch)`.
5. `CrudService.findAll(BankBranch.class)`; `getBanksList()` runs `QryBuilder.get(em, Bank.class).printQryInfo()` **on every getter call** (query per render pass); `CrudService.save/delete`. No validation (no required fields).
6. None.
7. Bugs: delete link uses `onclick="confirm('Delete?')"` without `return`, so the delete fires even when the user cancels. Stray `System.out.println("palsndkandlsakn")` in save. No Load/refresh button. Referenced from `app-menues.xhtml:197`. Not dead.

### secured/sysadmin/bank.xhtml
1. Full page, `appTemplate.xhtml`.
2. `jsf.sysadmin.BankController`, `@Named("bankController")`, `@SessionScoped`.
3. CRUD for banks.
4. Form: Name, Sort code, SWIFT code, View order, Active (checkbox). **Save** -> `saveBank()`; **Clear** -> `clear()`. Table (15 rows): bank name (column filter), sort code, SWIFT, active, view order; row **Select** -> `selectBank(bank)`; **Delete** -> `deleteBank(bank)`.
5. `QryBuilder.get(em, Bank.class).printQryInfo()` (no ordering, `viewOrder` is not used to sort); `CrudService.save/delete`. No validation.
6. None.
7. Same broken confirm as bank-branches (`onclick="confirm('Delete?')"` without `return`). Delete failure shows `JsfMsg.failedSave()` (wrong message). Referenced from `app-menues.xhtml:196`. Not dead.

### secured/sysadmin/case-categories.xhtml
1. Full page, `appTemplate.xhtml`. Newer list/form layout.
2. `jsf.support.CaseCategoryController`, `@Named("caseCategoryController")`, `@SessionScoped`.
3. Maintains the support-case category tree together with its SLA targets (acknowledge/resolve hours), default priority and team routing.
4. Actions:
   - Page actions (list mode): **Load** -> `loadCaseCategories()`; **Load standard set** (rendered only when `totalCount eq 0`) -> `loadStandardSet()`; **Add category** -> `newCaseCategory()`.
   - List (15 rows): global search (code or name), shown/total count. Columns: code, category name with "under <parent>" / "Top level", default priority (`cat.defaultPriority.label`), acknowledge hours, resolve hours, routes to (team + "escalates to <team>" / "Unrouted"), flags (Restricted / Inactive pills), actions.
   - Row: **Edit** -> `editCaseCategory(cat)`; **Delete** -> `deleteCaseCategory(cat)` via confirm dialog.
   - Form: Code*, Category name*, Sits under (dropdown from `caseCategoryController.parentOptions`, label `pc.fullName`, "Top level" = null), Active (checkbox), Restricted (checkbox - hidden from client portal, visible only to owning team), Acknowledge within hours* (`p:inputNumber`, 0 dp), Resolve within hours*, Default priority (`commonOptions.casePriorityList`, label `pr.label`), Routes to (`commonOptions.caseTeamList`, "Unrouted" = null), Escalates to (`commonOptions.caseTeamList`, "Nowhere" = null). Buttons: **Close** -> `resetPage()`; **Clear** -> `clearCaseCategory()`; **Save** -> `saveCaseCategory()`.
5. `QryBuilder.get(em, CaseCategory.class).orderByAsc(CaseCategory._categoryName)`; `CaseService.seedReferenceData()` (server-side: refuses when any category exists, otherwise creates 5 teams CS/OPS/TRD/FIN/CMP and a hard-coded category tree with SLA hours); `CrudService.save/delete`.
   **Logic in the bean**: self-parent check `caseCategory.getParent() == caseCategory` (identity comparison only, does not detect deeper cycles); `getParentOptions()` builds the parent list minus the row being edited. UI text states "critical halves them, high takes three quarters, low doubles them" - that priority scaling lives elsewhere (case service), not here.
6. None on roles. "Load standard set" is conditional on an empty table.
7. Session-held edit state. The "*" required markers on the two hour fields are cosmetic (no `required="true"`). Referenced from `app-menues.xhtml:139` only (not in old menu). Not dead.

### secured/sysadmin/case-teams.xhtml
1. Full page, `appTemplate.xhtml`. Newer list/form layout.
2. `jsf.support.CaseTeamController`, `@Named("caseTeamController")`, `@SessionScoped`.
3. CRUD for the teams (desks) support cases are routed to.
4. Page actions: **Load** -> `loadCaseTeams()`; **Add team** -> `newCaseTeam()`. List (10 rows): global search, shown/total; columns code, team name, default assignee (`accountName` or "Nobody"), team lead, status pill, actions. Row **Edit** -> `editCaseTeam(team)`; **Delete** -> `deleteCaseTeam(team)` via confirm dialog. Form: Code*, Team name*, Default assignee (`commonOptions.userAccountList`, label `u.accountName`), Team lead (same source), Active (checkbox). **Close** -> `resetPage()`; **Clear** -> `clearCaseTeam()`; **Save** -> `saveCaseTeam()`.
5. `QryBuilder.get(em, CaseTeam.class).orderByAsc(CaseTeam._teamName)`; `CrudService.save/delete`. No bean logic.
6. None.
7. Referenced from `app-menues.xhtml:140` only. Not dead.

### secured/sysadmin/change-password.xhtml
1. Full page, `appTemplate.xhtml`.
2. `jsf.sysadmin.ChangePasswordController`, `@Named("changePasswordController")`, `@SessionScoped`; injects `UserSession`.
3. Logged-in back-office user changes their own password.
4. Shows `userSession.userUR.emailAddress` (read-only). Fields: Current password, New password, Retype password (all `h:inputSecret`). Button **Change** -> `updateUserPassword()`.
5. `CrudService.save(userSession.getUserUR())`.
   **Business logic in the bean (must move server-side)**: empty checks, new == retype check, hashing with `SecurityHash.getInstance().shaHash(...)` and comparison with the hash held on the session's `UserAccount`, then setting the new hash. `shaHash` (shared jar `stately-common-jakarta`) uses `MessageDigest.getInstance("SHA")`, i.e. **unsalted SHA-1**.
6. None (acts on the session user only).
7. Security: unsalted SHA-1; no password-strength rule; current-password check is against the session-cached hash rather than a fresh DB read; the three password strings stay in a session-scoped bean and are never cleared after success. Not in any menu: the only reference is `appTemplate.xhtml:95`, a topbar dropdown link with a **relative** href `sysadmin/change-password.xhtml`, which resolves correctly only from pages directly under `/secured/` and breaks from sub-folder pages. Not dead.

### secured/sysadmin/country.xhtml
1. Full page, `appTemplate.xhtml`.
2. `jsf.CountryController`, `@Named("countryController")`, `@SessionScoped`.
3. Maintain the country / currency reference list, including a bulk Excel replace.
4. Actions:
   - **Upload Countries List** panel: `p:fileUpload` (simple mode, required) bound to `countryController.file`; **Upload And Save** -> `uploadAndSaveList()`.
   - **Edit Country** form: Country code, Country name (required), Currency, Currency code. **Save** -> `saveCountry()`; **Clear** -> `clearCountry()`.
   - **Refresh** -> `loadCountries()`.
   - Table (20 rows): country code, country, currency, currency code (all with column filters). Row **Edit** -> `editCountry(country)`; **Delete** -> `deleCountry(country)` (no confirmation).
5. `CrudService.findAll(Country.class)`, `CrudService.save/delete`, `CrudService.generateId()`.
   **Business logic in the bean**: `uploadAndSaveList()` first runs `QryBuilder.get(em, Country.class).delete()` (**bulk-deletes every country**), writes the upload to `ExcelExporter.TEMP_DIR/<client file name>`, reads it with `ExcelDataLoader`, drops the header row, then loops rows (cols A-D = code, name, currency, currency code), generating an id and saving each one individually.
6. None.
7. Bugs/risks: the delete-all happens before the file is parsed and outside one transaction, so a bad file leaves the table empty (and countries are FK targets, e.g. `SecurityIssuer.country`); the temp file name comes from the client (path traversal risk) and is never deleted; no success/failure message after upload; `saveCountry()` always `add`s to the list (duplicate row after an edit) and shows `failedDelete()` on save failure; delete has no confirm. Referenced from `app-menues.xhtml:136`. Not dead.

### secured/sysadmin/equity-market-price.xhtml
1. Full page, `appTemplate.xhtml`. (File modified today.)
2. `jsf.equities.EquityMarketPriceController`, `@Named("equityMarketPriceController")`, `@SessionScoped`.
3. Maintain daily equity market prices manually or by Excel upload.
4. Actions:
   - List mode (`equityMarketPrice == null`): **Load** -> `loadEquityMarketPrices()`; **Add new Market Price** -> `clearEquityMarketPrice()` (creates a new instance, which switches to form mode). Table (10 rows): value date, equity (`equity.stockName`), market price. Row **Edit** -> `editEquityMarketPrice(row)`; **Delete** -> `deleteEquityMarketPrice(row)` with JS `confirm('Are You Sure ?')`.
   - **Prices Upload** panel: `p:fileUpload` (simple, xls/xlsx) -> `file`; **Upload** -> `upload()` (parses into a preview). Preview table of `uploadedMarketPriceList` (value date, equity, market price). **Save** -> `saveUpload()`; **Clear** -> `clearUploads()`. Side panel documents the sheet: A Symbol, B Date, C Market Price.
   - Form mode: Value date* (`p:datePicker`), Equity (filterable dropdown from `commonOptions.stocksList`), Market price*. **Save** -> `saveEquityMarketPrice()`; **Clear** -> `clearEquityMarketPrice()`; **Close** -> `resetPage()`.
5. `QryBuilder.get(em, EquityMarketPrice.class).orderByDesc(EquityMarketPrice._valueDate)` (loads the whole table, no date filter); `CrudService.save/delete`.
   **Business logic in the bean**: `upload()` writes the file to `ExcelExporter.TEMP_DIR/<client name>`, skips the header, and per row looks up `Stock` by `_stockSymbol` then falls back to `_stockCode` (one or two queries per row), skips rows with unknown stock or no date, looks up an existing `EquityMarketPrice` by (`_valueDate`, `_equity`) to upsert, and builds the preview. `saveUpload()` loops and saves each price individually (not one transaction), then reloads.
6. None.
7. Typo in `allowTypes="/(\.|\/)(xls|xlsx)$"` (missing closing slash, so the type filter is not a valid regex literal); Equity is marked required visually but has no `required`; unmatched rows are skipped silently with no report; client file name used for the temp path; preview list held in session. Referenced from `app-menues.xhtml:154` only. Not dead.

### secured/sysadmin/exchange-fee.xhtml
1. Full page, `appTemplate.xhtml`. Form (left) and table (right) always visible.
2. `jsf.equities.ExchangeFeeController`, `@Named("exchangeFeeController")`, `@SessionScoped`.
3. Configure the fees charged per stock exchange (fee type, application mode, amount).
4. Form: Stock exchange (`commonOptions.stockExchangesList`), Fee (`commonOptions.feesList`), Application mode (`commonOptions.applicationModeList`, enum `ApplicationMode`), Amount, Broker commission (checkbox), Adjustable (checkbox), Fees active (checkbox). **Save** -> `saveExchangeFee()`; **Clear** -> `clearExchangeFee()`. **Load** -> `loadExchangeFees()`. Table (10 rows): exchange name, fee name, application mode, amount (money format), broker commission, fees active, adjustable. Row **Edit** -> `editExchangeFee(row)`; **Delete** -> `deleteExchangeFee(row)` with JS confirm.
5. `QryBuilder.get(em, ExchangeFee.class)`; `CrudService.save/delete`. No validation at all (all "required" markers are cosmetic).
6. None.
7. `ui:remove`d blocks: a Close button (`resetPage()`), a Print link (`printExchangeFees()`, which is only a `System.out.println` stub) and an "Add new" button, plus a row-expansion showing the id. These fees drive trade charge calculation elsewhere, so edits here have financial effect. Referenced from `app-menues.xhtml:156`. Not dead.

### secured/sysadmin/fee-type.xhtml
1. Full page, `appTemplate.xhtml`.
2. `jsf.equities.FeeTypeController`, `@Named("feeTypeController")`, `@SessionScoped`.
3. CRUD for fee types (name, broker-commission flag, active flag).
4. Form: Fee name, Broker commission (checkbox), Fees active (checkbox). **Save** -> `saveFeeType()`; **Clear** -> `clearFeeType()`. **Load** -> `loadFeeTypes()`. Table (10 rows) with row toggler/expansion showing the id; columns fee name, broker commission, fees active. Row **Edit** -> `editFeeType(row)`; **Delete** -> `deleteFeeType(row)` with JS confirm.
5. `QryBuilder.get(em, FeeType.class)`; `CrudService.save/delete`. No validation.
6. None.
7. `ui:remove`d Close / Print (`printFeeTypes()` stub) / Add-new blocks. The row expansion is live here because the `ui:remove` around it was turned into an HTML comment. Referenced from `app-menues.xhtml:155`. Not dead.

### secured/sysadmin/fixed-income-prices.xhtml
1. Full page, `appTemplate.xhtml`.
2. `jsf.equities.FixedIncomePriceFetchController`, `@Named("fixedIncomePriceFetchController")`, `@SessionScoped`.
3. Fetch fixed-income market prices for a date from the external Stately market-data API, preview them, and save them.
4. Market date* (`p:datePicker`, defaults to today) and **Fetch** -> `fetchPrices()`. Preview table (rendered when `hasFetchedPrices`, 10 rows): market date, ISIN, issuer code, maturity date, market price, yield. **Save Prices** -> `savePrices()` with JS `confirm('Save all fetched prices ?')`.
5. **External API call made directly from the bean**: `java.net.http.HttpClient` GET to hard-coded `http://65.21.3.38:8080/marketdata/api/v1/market-prices/fixed-income-prices?marketDate=<ISO date>` (30 s connect / 60 s request timeout, `Accept: application/json`); `parsePrices()` accepts either a raw JSON array or an object with a `data` array and maps to `FixedIncomePrice` via `JsonUtils`.
   **Business logic in the bean**: `savePrices()` loops the fetched prices, looks up `FixedIncomeMarketPrice` by (`_marketDate` = the bean's selected date, `_isin`) to upsert, copies issue date / maturity date / issuer code / price / yield, links a `FixedIncome` via `findFixedIncome()` (match `FixedIncome._isinCode` = ISIN, else `FixedIncome._securityCode` = issuer code) and copies its `assetSubClass`, then `CrudService.save` per row (not one transaction) and counts successes.
6. None.
7. Hard-coded IP over plain HTTP with no auth (a commented-out localhost alternative sits beside it); `System.out.println` of the URL and the full response body; upsert lookup uses the selected `marketDate` while new rows store `price.getMarketDate()`, so a mismatch between the two creates duplicates on repeat saves; the `rendered` attribute on the plain `<center>` tag is ignored, so the Save button is always shown. A separate `services/StatelyMarketDataApiService` also builds a `/fixed-income-prices?` call, so this bean duplicates a service that already exists. Referenced from `app-menues.xhtml:171` only. Not dead.

### secured/sysadmin/fixed-income.xhtml
1. Full page, `appTemplate.xhtml`. Three views in one page: register, step 1 (terms), step 2 (schedule review).
2. `jsf.FixedIncomeController`, `@Named("fixedIncomeController")`, `@SessionScoped`; injects `CrudService` and `FixedIncomeService` (`@Stateless`).
3. Register of fixed-income securities; a two-step wizard creates/edits a security and generates its coupon / principal corporate-action schedule.
4. Actions:
   - Page action (register view): **Add new Security** -> `initiateSecurityCreation()` (new entity, issue date = today).
   - Summary tiles: On the register (`totalCount`), Active (`activeCount`), Maturing in 90 days (`maturingCount`), Matured (`maturedCount`).
   - Filter bar: Issued from / Issued to (`dateRange.fromDate/toDate`), Asset subclass (`filterSubClass`, `commonOptions.assetSubClassList`), Rate policy (`filterRatePolicy`, `commonOptions.ratePolicyList`), client-side global search (security code, ISIN, issuer). **Search** -> `viewSecurity()`.
   - Table (10 rows) with row toggler; expansion shows security code, ISIN, rate policy, day count, interest interval, number of interest payments, leap-year adjustment, currency, country. Columns: security (code + ISIN), issuer (`securityIssuer.issuer.issuerName`), subclass, coupon %, issue date, maturity, tenor, payments, status pill (`fixedIncome.status` / `statusStyle`), actions.
   - Row: **Edit** -> `editFixedIncome(row)`; **Delete** -> `deleteFixedIncome(row)` via confirm dialog ("Delete <code> and its whole coupon schedule?").
   - Step 1 form: Asset subclass* (ajax refresh of the derived panel), Security issuer* (`commonOptions.securityIssuerList`), Issue date* (ajax `dateSelect` -> `suggestMaturityDate()`), Maturity date*, Currency (`commonOptions.currencyEnumsList`), Country (free text), ISIN, Security code (read-only `securityCodePreview`), Rate policy* (ajax), Coupon* (`p:inputNumber`, 4 dp, ajax on change), Tenor* (`commonOptions.fixedIncomeTenorList`, ajax -> `suggestMaturityDate()`), Day count* (`commonOptions.fixedIncomeDayCountList`), Interest payment interval (days, "defaults to 182"), No. of interest payments (disabled unless `ratePolicy == 'FLOATING_RATE'`), Leap year adjustment (checkbox). "Derived" panel: tenor days, `derivedPaymentCount`, `couponPerPayment`, security code preview. Buttons: **Close** -> `resetPage()`; **Generate schedule** -> `generateSchedule()`.
   - Step 2 (read-only): terms summary and Corporate Action Schedule table (`corporateActionsList`, 15 rows: #, value date, type label, days, coupon %). Buttons: **Back to terms** -> `back()`; **Close** -> `resetPage()`; **Save Security** -> `saveFixedIncome()`.
5. Calls:
   - `viewSecurity()` (also the `@PostConstruct`): `QryBuilder.get(em, FixedIncome.class).addDateRange(dateRange, FixedIncome._issueDate)` plus optional `addObjectParam(_assetSubClass)` / `addObjectParam(_ratePolicy)`, `orderByDesc(_issueDate)` - query built in the bean.
   - `FixedIncomeService.generateSecurityCode(fi)` (keeps an existing code; else `<subclass code>-<tenor code>-<issue date ddMMyy>`), called from the `securityCodePreview` getter on every render.
   - `FixedIncomeService.createCoporateActions(fi)`: number of payments = tenor days / interval (or the entered count for floating rate), one INTEREST_PAYMENT per interval, then a final interest payment and a PRINCIPAL_REDEMPTION on the maturity date; floating-rate rows after the first get rate 0.
   - `FixedIncomeService.saveFixedIncome(fi, actions)`: sets the code, rejects a duplicate code for new securities (`isFixedIncomeExist` count query), saves the security and each corporate action in one EJB transaction.
   - `deleteFixedIncome`: `QryBuilder.get(em, FiCorporateAction.class).addObjectParam("fixedIncome", fi).delete()` then `CrudService.delete(fi)`.
   **Business logic in the bean (must move)**: `suggestMaturityDate()` (issue date + tenor days); `generateSchedule()` validation (tenor and issue date present); the tile counters loop the list comparing `FixedIncome.getStatus()` strings; the bulk delete of the schedule followed by a separate delete of the security (two separate transactions from the bean); `applySecondaryMarketCalc(fi)` and static `isSoverignSecurity(fi)` helpers (sovereign subclass + tenor <= 1 year rules) which nothing else in `src/main/java` calls.
   **Logic in the entity used by the page**: `FixedIncome.getStatus()` (Undated / Matured / Maturing within `MATURING_SOON_DAYS = 90` / Active, computed from today's date), `getStatusStyle()`, `getTenorDays()`, `getDerivedPaymentCount()`, `getCouponPerPayment()` (coupon / (365 / interval)).
6. None on roles. "No. of interest payments" is disabled unless the rate policy is floating.
7. Notes and apparent bugs:
   - `fixedIncome.securityIssuer.issuer.issuerName` is used for the Issuer column and the step-2 summary, but the `SecurityIssuer` entity has no `issuer` property (it carries `issuerName` directly), so this EL should fail for any row with an issuer. Needs runtime confirmation.
   - Editing an existing security and saving regenerates and saves a new schedule without removing the old `FiCorporateAction` rows (the service only inserts), so an edit appears to duplicate the schedule.
   - Delete removes the schedule first; if the security delete then fails (trades exist), the schedule is already gone.
   - The date range starts empty, so the register initially loads every security; the list is session-cached.
   - The interval's "defaults to 182" comes from the entity field initialiser (`FixedIncome.interestPaymentInterval = 182`), not from the bean.
   - Step 3 "Saved" in the stepper has no view of its own; save returns to the register.
   - Referenced from `app-menues.xhtml:170` and from the dashboard `secured/index.xhtml:215` (`h:link outcome="/secured/sysadmin/fixed-income"`, "Corporate actions this week" tile, carries no state). Not dead.

### secured/sysadmin/funds.xhtml
1. Full page, `appTemplate.xhtml`.
2. No backing bean.
3. Placeholder: renders only the word "Funds".
4. No actions.
5. None.
6. None.
7. Stub page (16 lines). Still linked from `app-menues.xhtml:183` under "Mutual Funds". Functionally dead: nothing to migrate.

### secured/sysadmin/industry.xhtml
1. Full page, `appTemplate.xhtml`. Newer list/form layout.
2. `jsf.IndustryController`, `@Named("industryController")`, `@SessionScoped`.
3. CRUD for industries (sectors) used to classify stocks.
4. Page actions: **Load** -> `loadIndustries()`; **Add new Industry** -> `newIndustry()`. List (10 rows): global search, shown/total; columns industry code, industry name (both sortable), actions. Row **Edit** -> `editIndustry(industry)`; **Delete** -> `deleteIndustry(industry)` via confirm dialog. Form: Industry code*, Industry name*. **Close** -> `resetPage()`; **Clear** -> `clearIndustry()`; **Save** -> `saveIndustry()`.
5. `QryBuilder.get(em, Industry.class).orderByAsc(Industry._industryName)`; `CrudService.save/delete`. No bean logic; no uniqueness check on code.
6. None.
7. Referenced from `app-menues.xhtml:138` only. Not dead.

### secured/sysadmin/issuers.xhtml
1. Full page, `appTemplate.xhtml`.
2. EL bean name `issuersController`. **No such class exists**: no `IssuersController` (or any `@Named("issuersController")`) anywhere in `src/main/java`, and the shared jars do not contain one. There is also no `Issuer` entity; only `SecurityIssuer`.
3. Intended: CRUD for fixed-income issuers, with Excel export.
4. As written: form with Issuer code (disabled once non-empty), Issuer name (required), Active, Initials, Address, Contact person; **Save** -> `issuersController.saveIssuer()`; **Clear** -> `clearIssuer()`. Table (20 rows): issuer code and name (column filters), initials, address, contact person; **Export Data** (`p:dataExporter` type `xls`, file name "Issuers", rendered when `issuersList != null`); **Refresh** -> `init()`; row **Edit** -> `editIssuer(issuer)`; **Delete** -> `deleteIssuer(issuer)` with JS confirm.
5. Nothing to trace; the bean is missing.
6. None.
7. **Broken page**: with the bean unresolved, the table renders empty and any button click fails with a target-unreachable error. The fields on this form match the columns of the `SecurityIssuer` entity (issuerCode, issuerName, initials, address, contactPerson, active), which suggests the Issuer and SecurityIssuer concepts were merged and this page was left behind. Still linked from `app-menues.xhtml:168`. Treat as dead.

### secured/sysadmin/messaging-templates.xhtml
1. Full page, `appTemplate.xhtml`. Uses the composite `stately:formControl` from the shared jar `stately-jsf-jakarta` (`META-INF/resources/stately/formControl.xhtml`), which renders a Save button only when `formControlManager.enableSaveButton` is true (bean in the shared jar).
2. `jsf.sysadmin.MessagingTemplateController`, `@Named("messagingTemplateController")`, `@SessionScoped`; injects `CrudService`, `ConfigurationService`.
3. Edit the email (rich text) and SMS text template for each `MessagingTemplateType`.
4. Template type dropdown (`messagingTemplateTypeList` = `MessagingTemplateType.values()`), ajax `change` -> `loadEmailTemplate()` updating both editors. Email template (`p:textEditor`, `secure="false"`), SMS template (`p:inputTextarea`). Save (via `stately:formControl saveButtonAction`) -> `saveEmailTemplate()`. Right column: read-only grid of `emailVariableList` (`EmailVariables.EMAIL_VARIABLESES`: label and variable name) as a placeholder reference.
5. `ConfigurationService.get(templateType)` (`QryBuilder.get(em, MessagingTemplate.class).addObjectParam(MessagingTemplate._messagingTemplateType, type).getSingleResult`); `CrudService.save(messagingTemplate)`. Bean logic: when no template exists for the type, a new one is created with that type.
6. None (apart from the shared `formControlManager.enableSaveButton` gate on the Save button).
7. `p:textEditor secure="false"` turns off HTML sanitisation, so arbitrary HTML is stored and later sent in emails. After save the bean resets to a blank template while the dropdown keeps its selection, so a second Save without re-selecting would store a template with no type. Debug `System.out.println`s. Referenced from `app-menues.xhtml:221`. Not dead.

### secured/sysadmin/registrar.xhtml
1. Full page, `appTemplate.xhtml`. Newer list/form layout.
2. `jsf.RegistrarController`, `@Named("registrarController")`, `@SessionScoped`.
3. CRUD for share registrars.
4. Page actions: **Load** -> `loadRegistrars()`; **Add new Registrar** -> `newRegistrar()`. List (10 rows): global search, shown/total; columns registrar code, registrar name, actions. Row **Edit** -> `editRegistrar(registrar)`; **Delete** -> `deleteRegistrar(registrar)` via confirm dialog. Form: Registrar code*, Registrar name*. **Close** -> `resetPage()`; **Clear** -> `clearRegistrar()`; **Save** -> `saveRegistrar()`.
5. `QryBuilder.get(em, Registrar.class).orderByAsc(Registrar._registrarName)`; `CrudService.save/delete`. No bean logic.
6. None.
7. Referenced from `app-menues.xhtml:137` only. Not dead.

### secured/sysadmin/risk-assessment-question.xhtml
1. Full page, `appTemplate.xhtml`. Two modes: question list, and "manage" mode for one question's answers.
2. `jsf.sysadmin.RiskAssessmentQuestionController`, `@Named("riskAssessmentQuestionController")`, `@SessionScoped`.
3. Maintain the investor risk-assessment questionnaire: ordered questions, each with answers carrying a risk score.
4. Actions:
   - Question mode (`manageQuestion == false`): Assessment question (textarea); **Save** -> `saveRiskAssessmentQuestion()`; **Clear** -> `clearRiskAssessmentQuestion()`; **Load** -> `loadRiskAssessmentQuestions()`; **Add new Question** -> `clearRiskAssessmentQuestion()`. Table (10 rows, `draggableRows="true"`): question text; ajax `rowReorder` -> `onRowReorder`. Row **Edit** -> `editRiskAssessmentQuestion(q)`; **Manage** -> `manageRiskAssessmentQuestion(q)`; **Delete** -> `deleteRiskAssessmentQuestion(q)` with JS confirm.
   - Manage mode: question text shown read-only. Answer form: Answer description, Risk score; **Save** -> `saveRiskAssessmentAnswer()`; **Clear** -> `clearRiskAssessmentAnswer()`. **Load** -> `loadRiskAssessmentAnswers()`. Answers table (10 rows): description, risk score; row **Edit** -> `editRiskAssessmentAnswer(a)`; **Delete** -> `deleteRiskAssessmentAnswer(a)` with JS confirm. **Close** -> `resetPage()` (back to the question list).
5. `QryBuilder.get(em, RiskAssessmentQuestion.class).orderByAsc(RiskAssessmentQuestion._viewOrder)`; `QryBuilder.get(em, RiskAssessmentAnswer.class).addObjectParam(RiskAssessmentAnswer._assessmentQuestion, question)`; `CrudService.save/delete`.
   **Business logic in the bean**: view-order numbering - a new question has `viewOrder = -1` and gets `list.size()` on save; `reOrderItems()` loops the whole list after a drag, sets `viewOrder = index` and saves every question one by one (N saves, not transactional).
6. None.
7. Deleting a question does not delete its answers in the bean (relies on DB cascade or FK error) and does not renumber. Answers have no ordering. No validation on empty question, empty answer, or non-numeric score. Dragging on a paginated table. `ui:remove`d Print stub. The questions are also served to the client app by `api/endpoint/RiskAssessmentQuestionEndpoint` (`v1/risk-assessment-questions`). Referenced from `app-menues.xhtml:209`. Not dead.

### secured/sysadmin/risk-level.xhtml
1. Full page, `appTemplate.xhtml`. List/form toggle on `riskLevel == null`.
2. `jsf.sysadmin.RiskLevelController`, `@Named("riskLevelController")`, `@SessionScoped`.
3. CRUD for risk levels: name, level value and the risk-score band (from/to) that maps a questionnaire score to a level.
4. List mode: **Load** -> `loadRiskLevels()`; **Add new Risk Level** -> `clearRiskLevel()`. Table (10 rows): level name, level value, risk score from, risk score to. Row **Edit** -> `editRiskLevel(row)`; **Delete** -> `deleteRiskLevel(row)` with JS confirm. Form mode: Level name*, Level value*, Risk score from*, Risk score to* (all `required`). **Save** -> `saveRiskLevel()`; **Clear** -> `clearRiskLevel()`; **Close** -> `resetPage()`.
5. `QryBuilder.get(em, RiskLevel.class)` (no ordering); `CrudService.save/delete`. No bean logic: nothing checks from <= to or overlapping/gapped bands.
6. None.
7. `printRiskLevels()` is a stub. Risk levels are also exposed by `RiskLevelEndpoint` (`v1/risk-levels`) and `LookupEndpoint` (`/risk-level`). Referenced from `app-menues.xhtml:135`. Not dead.

### secured/sysadmin/security-issuer.xhtml
1. Full page, `appTemplate.xhtml`.
2. EL bean name `securityIssuerController`. **No such class exists** in `src/main/java` or the shared jars. Only `entities/SecurityIssuer.java` and `jsf/convertors/SecurityIssuerConverter.java` exist.
3. Intended: CRUD linking an issuer to an asset class, country and operator/counterparty.
4. As written: form with Issuer (dropdown from `commonOptions.issuerList`, **a property that does not exist**), Asset class (required, `commonOptions.assetClassList`), Active, Country (`commonOptions.countryList`), Operator/Counterparty (`commonOptions.securityIssuerList`); **Save** -> `securityIssuerController.saveSecurityIssuer()`; **Clear** -> `clearIssuer()`. Table (10 rows): security issuer code, asset class (filter), country, issuer name (filter, `security.issuer.issuerName`), operator; row **Edit** -> `editSecurityIssuer(security)`; **Delete** -> `deleteSecurityIssuer(security)` with JS confirm.
5. Nothing to trace; the bean is missing. The `SecurityIssuer` entity has `active`, `issuerCode`, `issuerName`, `initials`, `address`, `contactPerson`, `assetClass`, `country`, `securityIssuerCode` and no `issuer` or `operator` property, so the page does not match the current entity either.
6. None.
7. **Broken page** (missing bean, missing `commonOptions.issuerList`, properties that no longer exist on the entity). Consequence: there is currently **no working UI to create or edit `SecurityIssuer` records**, yet `fixed-income.xhtml` requires one (`commonOptions.securityIssuerList`). Still linked from `app-menues.xhtml:169`. Treat as dead, but the function needs to be rebuilt in the new app.

### secured/sysadmin/stock-exchange.xhtml
1. Full page, `appTemplate.xhtml`. Form above table, both always visible.
2. `jsf.equities.StockExchangeController`, `@Named("stockExchangeController")`, `@SessionScoped`.
3. CRUD for stock exchanges (code, name, settlement period).
4. Form: Exchange code, Exchange name (required), Settlement period. **Save** -> `saveStockExchange()`; **Clear** -> `clearStockExchange()`. **Load** -> `loadStockExchanges()`. Table (10 rows): exchange code, name, settlement period. Row **Edit** -> `editStockExchange(row)`; **Delete** -> `deleteStockExchange(row)` with JS confirm.
5. `QryBuilder.get(em, StockExchange.class)`; `CrudService.save/delete`. No bean logic.
6. None.
7. `ui:remove`d Close / Print (`printStockExchanges()` stub) / Add-new blocks and id row expansion. Settlement period (T+n) feeds trade settlement elsewhere. Also exposed by `StockExchangeEndpoint` (`v1/stock-exchanges`). Referenced from `app-menues.xhtml:152`. Not dead.

### secured/sysadmin/stocks.xhtml
1. Full page, `appTemplate.xhtml`, containing a modal dialog (`p:dialog widgetVar="stockUploadDialog"`) for bulk upload. (File modified today.)
2. `jsf.equities.StockController`, `@Named("stockController")`, `@SessionScoped` (with inner DTO class `UploadRow`).
3. Register of listed stocks with share capital, plus a read / preview / confirm Excel bulk upload.
4. Actions:
   - Page actions (list mode): **Load** -> `loadStocks()`; **Upload Stock** -> opens the dialog client-side (`PF('stockUploadDialog').show()`, no bean call); **Add new Stock** -> `newStock()`.
   - Summary tiles: Listed stocks (`totalCount`; clicking clears the search through the JS function `stFilterStocks('')`), Exchanges (`exchangeCount`), Issued shares (`totalIssuedShares`), Missing share data (`missingShareDataCount`).
   - List (10 rows): global search (symbol, code, company name), shown/total. Row toggler with expansion (symbol, code, name, exchange, industry, registrar, authorised shares, issued shares). Columns: stock (symbol / name / code), exchange, industry tag or "Not set", authorised shares, issued shares, "Issued" meter (`stock.issuedPercent`, or a "missing" pill when < 0), actions.
   - Row: **Edit** -> `editStock(stock)`; **Delete** -> `deleteStock(stock)` via confirm dialog.
   - Form: Stock symbol*, Stock code (defaults to the symbol), Stock name*, Stock exchange* (`commonOptions.stockExchangesList`), Industry (`commonOptions.industriesList`), Registrar (`commonOptions.registrarsList`), Authorised shares, Issued shares (`p:inputNumber`, 0 dp), read-only "issued as a share of authorised" bar. **Close** -> `resetPage()`; **Clear** -> `clearStock()`; **Save** -> `saveStock()`.
   - Upload dialog: Stock exchange* (`uploadStockExchange`), Registrar* (`uploadRegistrar`), file (`p:fileUpload` simple, xls/xlsx -> `uploadFile`); **Read file** -> `readUploadFile()`. "Expected columns" help: A Company, B Symbol, C Authorised shares, D Issued shares; first row is a header. Preview (when `previewRows != null`): tiles `createCount`, `skipCount`, `duplicateCount`, `rowsRead`; table of row number, company, symbol, authorised, issued, outcome pill (`outcomeStyleOf(row)`) and reason. **Close** hides the dialog client-side; **Create N stock(s)** -> `confirmUpload()` (disabled when there is no preview or `createCount == 0`).
5. `QryBuilder.get(em, Stock.class).orderByAsc(Stock._stockName)`; `CrudService.save/delete`; `QryBuilder.get(em, X.class).addObjectParam("stock", stock).count()` for `EquityOrder`, `EquityTransaction`, `EquityTradeTransaction`.
   **Business logic in the bean (must move)**:
   - `saveStock()`: rejects issued > authorised (when authorised > 0); defaults the stock code to the symbol.
   - `deleteStock()` / `deleteBlockedBy()`: three count queries and a "still has N order(s), N transaction(s), N trade(s)" refusal.
   - `readUploadFile()`: temp file, Excel parse, header removal, per-row validation (skip on no company / no symbol / bad share count), duplicate detection against symbols earlier in the sheet and against the session-cached stock list (case-insensitive), outcome classification Create / Skipped / Already listed.
   - `confirmUpload()`: loops the preview, builds `Stock` (code = symbol, exchange and registrar from the dialog) and saves each one individually (not one transaction).
   - Tile aggregates (`exchangeCount`, `totalIssuedShares`, `missingShareDataCount`) are loops over the cached list.
   **Logic in the entity**: `Stock.getIssuedPercent()` (`round(issued * 1000 / authorised) / 10`, -1 when authorised <= 0) and `isMissingShareData()`.
6. None on roles. The "Create" button is disabled until a preview with at least one creatable row exists.
7. Notes and apparent bugs:
   - Undocumented column: `readUploadFile()` also reads **column E (index 4) as the stock ID**, strips "/" from it, and `confirmUpload()` sets it as the new entity's primary key (`newStock.setId(row.getId())`). The on-screen "Expected columns" help lists only A-D. A supplied id that already exists would overwrite that stock rather than create one.
   - Registrar is marked required in the dialog but is never checked in the bean.
   - `startUpload()` is only called after a successful confirm, so a stale preview and the previous exchange/registrar selection persist in the session when the dialog is reopened.
   - "Read file" is a non-ajax postback, so the dialog closes on submit and the user must reopen it to see the preview.
   - Duplicate detection uses the session-cached list, not a fresh query.
   - `printStocks()` is a stub.
   - Referenced from `app-menues.xhtml:153`. Not dead.

### secured/sysadmin/user-accounts.xhtml
1. Full page, `appTemplate.xhtml`.
2. `jsf.sysadmin.UserAccountController`, `@Named("userAccountController")`, `@SessionScoped`.
3. Manage back-office user accounts and set their passwords.
4. Actions:
   - Account form: Account name, Email address (required), Phone no, Account status (required; `commonOptions.activeInactiveStatusList`, enum `ActiveInactiveStatus`). **Save** -> `saveUserAccount()`; **Clear** -> `clearAccount()`.
   - "User Password" panel: shows the selected account's email, Password (`h:inputSecret` -> `userPassword`); **Update** -> `updateUserPassword()`.
   - Table (10 rows) with row toggler (expansion shows account status): account name, email (column filter), phone, account status. Row **Edit** -> `editUserAccount(account)`; **Delete** -> `deleteUserAccount(account)` with JS confirm.
5. `QryBuilder.get(em, UserAccount.class)`; `CrudService.save/delete`.
   **Business logic in the bean (must move)**: `updateUserPassword()` hashes with `SecurityHash.getInstance().shaHash()` (unsalted SHA-1, as in change-password), sets it on the account and saves.
6. **None.** No role, user-type or self-protection check: any logged-in user can create, edit and delete accounts and reset anyone's password, including deleting their own account.
7. Security and bugs:
   - No roles or permissions are captured on this form at all (the topbar shows `userSession.userCategory`, but nothing here sets a category).
   - A new account is saved with no password; setting one is a separate step, and saving clears the selection, so the admin must re-select the account first.
   - The password panel's `rendered="#{not empty userAccountController.userAccount}"` is always true because the bean always holds a non-null instance; pressing Update with no account selected would save a brand-new account containing only a password hash.
   - No email-uniqueness check, no password policy, no confirmation field; the success message is the truncated text "Password ".
   - The typed password stays in the session bean after use.
   - The email column has `filterBy=" #{account.emailAddress}"` with a leading space.
   - Referenced from `app-menues.xhtml:134`. Not dead.

---

### Summary for the migration

- **Dead / nothing to migrate as-is**: `funds.xhtml` (placeholder), `issuers.xhtml` and `security-issuer.xhtml` (backing beans do not exist). All three are still linked from the live menu. Security-issuer maintenance has to be rebuilt because fixed-income depends on it.
- **Not in the menu**: `change-password.xhtml` (linked only from the topbar dropdown in `appTemplate.xhtml`).
- **Business logic sitting in beans that needs a server-side home**: password hashing and verification (`ChangePasswordController`, `UserAccountController`); Excel parsing and row-by-row persistence (`StockController`, `EquityMarketPriceController`, `CountryController`, the last with a delete-all first); the external market-data HTTP fetch and upsert (`FixedIncomePriceFetchController`); stock validation and delete guards (`StockController`); maturity suggestion, register query, tile counts and the two-step delete (`FixedIncomeController`); question re-ordering (`RiskAssessmentQuestionController`); self-parent check (`CaseCategoryController`).
- **Already server-side and reusable**: `FixedIncomeService.generateSecurityCode / createCoporateActions / saveFixedIncome`, `CaseService.seedReferenceData`, `ConfigurationService.get`.

---

# Cross-module findings to carry into the migration plan

Counts (81 xhtml): root 2 (login, error); composite components 10; template 1; menus 2 (1 dead); dashboard 2 (index, dashboard3 orphan); accounts 13 (4 dead); cash 1; transactions 3; report 1; equities 12; fixed-income 9 (1 orphan); support 2; sysadmin 23 (2 broken for lack of a bean, 1 stub).

Destructive actions found (confirmed by reading the source lines; none were executed):
- `InvestorUploadController.upload()` line 68: `QryBuilder.get(em, Investor.class).delete()` - deletes ALL investors before parsing the uploaded file.
- `CountryController` line 56: deletes ALL countries before parsing the uploaded file.
- `equities/stock-order-upload.xhtml` lines 92-96: "Delete Trades" / "Delete Orders" buttons -> `StockOrderUploadController.deleteTradesRecords()` / `deleteEquityOrders()` -> `DataLoadingService.deleteTrade()` / `deleteOrders()`, no confirmation.
These look like data-loading/test utilities left on menu-linked pages. Decide explicitly whether to port, gate or drop them.

Security baseline to replace, not port: no roles, no container security, phase-listener guard on render only, unsalted SHA password hashes, inactive users can log in, 10-hour session, any user can manage user accounts.

All bug observations in this document come from reading code; nothing was run.
