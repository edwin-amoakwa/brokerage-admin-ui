# brokerage-admin: non-UI backend inventory

Source root: `/Users/edwin/development/projects/stately/brokerage-system/brokerage/brokerage-admin`
Java root (below "J/"): `src/main/java/com/statelyhub/brokerage`
Scope: everything except the `jsf` package (only its wiring is noted). Read-only analysis; nothing was built or run.

Legend: **[verified]** = read in source. **[inferred]** = deduced, not proven. **[unknown]** = could not determine.

---

## 1. Tech stack, build, deploy

### pom.xml (`brokerage-admin/pom.xml`, parent `../pom.xml` = `com.statelyhub:brokerage:1.0`, single module)
| Item | Value |
|---|---|
| Packaging | `war` (`brokerage-admin-1.0.war`) |
| Java | Conflicting: properties say `maven.compiler.source/target=21`; `maven-compiler-plugin` config overrides to **17**; NetBeans hint JDK_21; Docker runtime image is JDK **25** |
| Platform API | `jakarta.platform:jakarta.jakartaee-api:10.0.0` (provided). All code uses `jakarta.*` namespaces. Descriptors (`web.xml` 4.0, `beans.xml` 2.0, `faces-config` 2.2, `persistence.xml` 2.2) still carry old `xmlns.jcp.org` schemas |
| App server | **Payara Server Full `7.2026.5-jdk25`** (dockerfile). `glassfish-web.xml` sets `<class-loader delegate="false"/>` |
| JPA provider | **EclipseLink** (Payara default; `eclipselink.ddl-generation=create-or-extend-tables`, output-mode `database`) - schema is auto-created/extended at deploy |
| UI libs | PrimeFaces **15.0.0** (`jakarta` classifier, bundled), OmniFaces **4.2** (bundled) |
| In-house libs | `com.statelyhub.modules:stately-common-jakarta:1.0` and `com.statelyhub.modules:stately-jsf-jakarta:1.0` (both bundled, compile scope). Java packages are `com.stately.common.*` and `com.stately.modules.web.jsf.*`. Source for common is at `/Users/edwin/development/projects/stately/stately-common-jakarta` |
| Reporting | `net.sf.jasperreports:jasperreports:7.0.3` - scope **provided**; the jar is injected into the WAR by Jenkins (see below) |
| Other (all `provided`) | commons-lang3 3.17.0, commons-io 2.6, guava 23.0, gson 2.8.2, commons-email 1.5 |
| DB driver | MySQL (`com.mysql.cj.jdbc.MysqlDataSource`); the `mysql-connector-j` dependency is commented out in the pom, so it also arrives through the Jenkins "jakarta-dependency" bundle [inferred] |
| Tests | None. No `src/test`. |
| Swagger/OpenAPI | Commented out. No API docs. |

### What the in-house `stately-common-jakarta` supplies (used by non-UI code)
`ApiResponse`, `ErrorModel`, `Pager`, `MessageResolvable` (api/data); `CrudController`, `QryBuilder`, `UniqueEntityModel`, `EntityModel`, `DateRecord`, `Enviroment` (jpa); `SecurityHash`; `EmailProcessor`, `EmailSetupConfig`; `HttpConnectionUtils`, `HttpConResponse`; `JsonUtils`, `JsonObject`; `JasperReportManager`, `ReportData`, `ReportOutput*`; `ExcelDataLoader`, `ExcelExporter`; `MappingResult`; `LocalDateRange`, `DateRange`; `NumberFormattingUtils`, `DateTimeUtils`, `StringUtil`, `ProcessingMessage`; `marketdata.MarketPrice/FixedIncomePrice/MarketDataApi`; `portfolio.StockReturnsValuator/StockTrade/StockPosition`; shared enums `DebitCredit, Gender, MaritalStatus, IdType, Title, CurrencyEnum, Relationship`.
A new backend must either keep depending on this jar or re-implement these.

### persistence.xml (`src/main/resources/META-INF/persistence.xml`)
- One unit: `brokeragePU`, JTA, `<jta-data-source>jdbc/brokerage</jta-data-source>`, `exclude-unlisted-classes=false`, `shared-cache-mode=ENABLE_SELECTIVE` (no entity is annotated `@Cacheable`, so the L2 cache is effectively off).
- `src/main/payara/domain.xml` defines pool `mysql_brokerage__pm_pool` and resource **`jdbc/brokerage__pm`** only. The app looks up `jdbc/brokerage`. [unknown] whether Payara resolves this through the GlassFish `__pm` convention or whether the name mismatch is a latent bug - not verified by running.
- Pool properties come from env vars substituted by `docker-entrypoint.sh`: `DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD` (all required). `useSSL=false`, `serverTimezone=UTC`, `createDatabaseIfNotExist=true`, steady 8 / max 32.
- EJB timer pool is the default embedded H2 (`jdbc/__TimerPool`); the only timer is non-persistent anyway.

### Config / properties
- There is **no** application properties file and no MicroProfile Config. Configuration is hard-coded in Java (see section 8 "hard-coded values").
- Only JVM system property read: `brokerage.attachments.dir` (case attachments; default `${user.home}/brokerage-attachments`). `java.io.tmpdir` is used for report temp files.
- `web.xml`: Faces servlet on `*.xhtml`, welcome `login.xhtml`, session timeout **600 minutes**, `PROJECT_STAGE=Production`, `FACELETS_BUFFER_SIZE=1048576`, error page `/error.xhtml` for Throwable and 500.
- `beans.xml`: `bean-discovery-mode="all"`.
- `faces-config.xml`: resource bundle `com.statelyhub.brokerage.resources.messages` as `msg`; phase listener `jsf.listeners.BrokeragePhaseListener`.

### dockerfile
- `FROM payara/server-full:7.2026.5-jdk25`; args `APP_WAR=brokerage-admin-1.0.war`, `APP_NAME=brokerage-admin`; env **`CONTEXT_ROOT=/laurus-africa`** (overridable per tenant at run time).
- Copies `domain.xml`, `pre-boot-commands.asadmin` (JMX on localhost), `post-boot-commands.asadmin` (empty), `docker-entrypoint.sh` (sed-substitutes DB env vars into domain.xml, appends `deploy --contextroot $CONTEXT_ROOT --name $APP_NAME /opt/payara/apps/$APP_WAR`). Exposes 8080/8181/4848. Entrypoint `tini`.
- So production REST base URL is `<host>/<CONTEXT_ROOT>/api/v1/...` (default `/laurus-africa/api/v1`).

### jenkinsfile
- Checks out four repos: `statelytech/stately-common`, `stately-jsf`, `jakarta-dependency`, `brokerage` (all `main`).
- `mvn clean install -DskipTests` for the two libs, `mvn clean package -DskipTests` for brokerage.
- Copies every jar (and unzipped zip contents) from `jakarta-dependency` into `target/jakarta-libs`, then `jar uf` them into the WAR's `WEB-INF/lib`, and asserts `jasperreports` is present.
- Docker image **`registry.statelyhub.com/laurus-api`** tagged `${BUILD_NUMBER}` and `latest`, pushed with credential `Stately-Registry`.
- The "Update Kubernetes Manifests" stage (kustomize in `statelytech/platform-deployments`, overlay `apps/laurus-api/overlays/production`) is **commented out** - deployment after push is manual or handled elsewhere [unknown].
- Note the image name `laurus-api`: this one WAR is both the admin UI and the client API.

### README / docs
- `../README.md` contains only `# brokerage`.
- `../docs/`: `client-care-guide.md/.html/.pdf` (functional guide for the complaints/case module, including a "who can see what" and "how it is built" section) and `docs/diagrams/{architecture,case-intake,case-lifecycle}.svg`. No other documentation.

---

## 2. REST layer

### JAX-RS configuration
- `J/api/JAXRSConfiguration.java`: `@ApplicationPath("api")`, empty `Application` subclass (classpath scanning). Every resource class uses a `v1/...` prefix, so effective base is **`/api/v1`**.
- Resource classes are plain POJOs with only `@Path` (CDI dependent beans because of discovery-mode `all`); two are `@Stateless` (`LookupEndpoint`, `EquitiesLookupEndpoint`). Resource methods therefore are **not transactional**; each `crudService.*` call is its own EJB transaction.
- Almost none declare `@Consumes`; most declare `@Produces(APPLICATION_JSON)`.

### Authentication / authorisation: there is none [verified]
- No `ContainerRequestFilter`, no `@RolesAllowed`, no `SecurityContext`, no `@HeaderParam`, no JWT, no token validation anywhere in the non-JSF code (grep for authorization/bearer/jwt/HeaderParam/ContainerRequestFilter finds only the CORS header list).
- Login returns `InvestorLoginResponse` whose `sessionId` is simply **the investor's id**. No server-side session/token is created or checked. `LoginSession` entity exists but is unused by the API.
- The client app's interceptor (`laurus-web-app/src/app/request-interceptor.ts`) has the `Authorization: Bearer` header code **commented out**; it sends nothing.
- "Ownership" is enforced only by the caller supplying ids (e.g. `SupportEndpoint.ownedCase(investorId, caseId)` compares the supplied investorId to the case's investor). Any caller who knows an id can read/modify any investor, account, order, wallet or cash transaction, and can call `GET /investors/list`.

### CORS (`J/api/CORSFilter.java`, `@Provider ContainerResponseFilter`)
`Access-Control-Allow-Origin: *`, `Allow-Headers: origin, content-type, accept, authorization`, `Allow-Credentials: true`, `Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, HEAD`, `Max-Age: 1209600`. (No explicit OPTIONS preflight handler.)

### Providers (`J/api/providers`, `J/api/convertors`)
| Class | Role |
|---|---|
| `ValidationExceptionMapper` | `@Provider ExceptionMapper<ConstraintViolationException>` -> `ApiResponse.error(List<ErrorModel>)` (HTTP 400). Only exception mapper. `field` is not populated (commented out). |
| `CheckValidation` | Static helper that runs Bean Validation manually and returns `List<ErrorModel>`. |
| `LocalDateParamConverterProvider` + `LocalDateConverter` | `@Provider` param converter for `LocalDate` (ISO). |
| `DateConvertor` | Static String<->LocalDate helper. |
| `api/models/Credential` | email + userPassword; used by back-office `UserService.login`. Its `toString()` prints the password. |
| `api/models/LookupItem` | `{id, itemLabel}`; `setup(Enum...)` maps `name()` -> id and `toString()` -> label. |

There is no generic exception mapper; endpoints catch `Exception`, `printStackTrace()`, and return a generic `ApiResponse.error(...)`.

### Response envelope: `com.stately.common.api.ApiResponse` (from stately-common-jakarta)
Shape (serialised with Gson via `toJson()`, entity is a JSON **string**):
```
{ success: boolean, statusCode: int, message: string, data: any, meta: any,
  pager: { pageSize, totalPages, pageNo, totalRecords }, errors: [ { field, message, invalidValue, severity } ] }
```
Factory conventions used by the endpoints:
- `ok(obj)` / `ok(msg)` / `ok(msg,obj)` -> 200, `success=true`.
- `created(obj)` -> 201 (client interceptor shows "Data Saved" toast on 201).
- `error()` / `error(msg)` / `error(List<ErrorModel>)` / `badRequest(msg)` -> **400**, `success=false`.
- `cantFind(id, entity)` -> 400 "Data not found !!!"; `findResult(obj)` -> 200 or 400.
- `updatedResult(bool)` -> always 200 with `success` flag; `delete(bool)` -> 200/400.
- `fail(status,msg)`, `internalServerError(msg)` exist but are not used here.
- Quirk in `ApiResponse.build()`: with more than one error the body is the bare errors array, not the envelope.
- There is no 401/403/404 usage; "not found" is 400.
- Date serialisation format is whatever `JsonUtils`/`ApiResponse.getGson()` configure - [unknown], not inspected in detail.

### DTO / convertor pattern
- DTOs are hand-written POJOs in `J/api/dto` (+ `dto/investment`, `dto/paystack`); a few carry Bean Validation (`@NotNull`, `@Email`, `@Size`) activated by `@Valid` on some resource methods.
- Entity -> DTO: static methods in **`J/api/endpoint/ModelConvertor.java`** (575 lines; `convertToXxxDto`, `toDto`). Some endpoints keep private `toDto`/`toEntity` methods instead (`SupportEndpoint`, `PaymentWalletEndpoint`, `FixedIncomeTradeOrderEndpoint`, `TradeOrderEndpoint`).
- DTO -> entity: inline `saveXxx(dto, entity)` methods in the endpoint, or `MappingResult<T>` (`toEntity`) that accumulates error strings. Investor mapping lives in `InvestorService` (which, unusually, returns JAX-RS `Response`).
- Enum lookups are returned as `LookupItem{id,itemLabel}`.

DTO list: `AccountDto, AccountTransactionDto, BeneficiaryDto, CaseCategoryDto, CaseMessageDto, CaseReplyRequestDto, CashTransactionDto, CountryDto, EquityOrderDto, EquityTradeDto, FixedIncomeTradeOrderDto, InvestorDto (1054 lines, full KYC), InvestorLoginResponse, InvestorOnboardDto, InvestorRiskAssessmentDto, LoginReqest (emailPhone, userPassword), NewCaseRequestDto, PaymentWalletDto, RiskAssessmentAnswerDto, RiskAssessmentQuestionDto, RiskLevelDto, StockDto, StockExchangeDto, SupportCaseDto`; `dto/investment`: `Portfolio, PortfolioDistribution, CashBalance, EquityHolding, FixedIncomeHolding, MutualFundHolding`; `dto/paystack`: `InitTransaction, PaymentResponse, WebhookEvents, PayStackConstants, ApiUtils`.

### Endpoint catalogue (all paths relative to `/api`)
"Client uses" = called by `laurus-web-app/src/app/services/*.ts` (verified by grep on `environment.baseApi`).

**1. `BrokerageApiEndpoint` - `v1`**
- GET `/v1` -> plain text "ping".

**2. `AuthInvestorEndpoint` - `v1/auth`** (services: `AuthInvestorService`, `LoginOtpService`, `NotificationServiceImpl`, `CrudService`). Client uses all but logout.
- POST `/login` - body `LoginReqest{emailPhone,userPassword}` (`@Valid`); checks password, sends 6-digit OTP (email+SMS); returns `data = investorId`. Cooldown / limit messages.
- POST `/login/verify` - raw JSON `{investorId, otp}` -> `InvestorLoginResponse` (investorId, names, email, mobile, `sessionId` = investor id, bioDataCompleted, biodataVerified, active, accountsList[{id,accountName}]).
- POST `/forgot-password` - `{emailMobilePhone}` -> sends OTP, returns investorId.
- POST `/forgot-password/verify` - `{investorId, resetPasswordToken}` -> investorId.
- PUT `/reset-password` - `{investorId,newPassword,passwordConfirmation}`. **Does not re-check the OTP** - anyone with an investorId can reset the password.
- POST `/logout/{sessionId}` -> records logout in `UserLogin`.

**3. `InvestorEndpoint` - `v1/investors`** (services: `InvestorService`, `AccountService`, `AuthInvestorService`, `PendingRegistrationService`, `InvestorFileService`, `SingletonIdService`, `NotificationServiceImpl`, `ActivityService`)
- GET `/list` -> all investors as `InvestorDto[]` (client uses).
- GET `/{id}` -> `InvestorDto` incl. base64 profile image and signature (client uses).
- POST `/onboard` - `InvestorOnboardDto` (`@Valid`: email, mobilePhone, firstName, surname, userPassword) -> creates/updates `PendingRegistration`, sends OTP, 201 with pending id (client uses).
- POST `/onboard/resend` - `{investorId}` (actually the pending id).
- PUT `/activate` - `{investorId, resetPasswordToken}` -> verifies OTP, creates `Investor`, default `Account` (`AccountService.initPrincipal`), welcome message, returns `InvestorLoginResponse` (client uses).
- PUT `/complete` - `InvestorDto` -> marks bioDataCompleted, `InvestorService.saveInvestor` (client uses).
- PUT `/edit` - `InvestorDto`.
- PUT `/edit/{section}` - section in `PERSONAL_INFO | IDENTIFICATION | FINANCIAL_PROFILE | BENEFICIARY_DETAILS | PEP_ASSESSMENT | TAX_COMPLIANCE | TRADING_ACCOUNT` -> matching `InvestorService.saveXxx` (client uses).
- DELETE `/{id}` -> `AccountService.deleteInvestor` (cascading bulk deletes).
- GET `/{id}/beneficiaries`, GET `/{id}/beneficiaries/{bid}`, POST `/{id}/beneficiaries/create`, PUT `/{id}/beneficiaries/edit`, DELETE `/{id}/beneficiaries/{bid}` - `BeneficiaryDto`.

**4. `AccountEndpoint` - `v1/accounts`** (`CrudService`, `ActivityService`)
- GET `/` all accounts; GET `/{id}`; POST `/create` (`AccountDto`); PUT `/edit`; DELETE `/{id}`.
- GET `/{id}/equity-orders` -> `EquityOrderDto[]` (client uses).
- GET `/{id}/fixed-income-orders` -> `FixedIncomeTradeOrderDto[]` (duplicates endpoint 5's path).
- GET `/{id}/payment-wallet` (client uses).

**5. `AccountFixedIncomeTradeOrderEndpoint` - `v1/accounts/{accountId}/fixed-income-orders`**
- GET `/` (client uses), GET `/{id}`, POST `/create`, PUT `/edit`, DELETE `/{id}` - `FixedIncomeTradeOrderDto`.

**6. `AccountTransactionEndpoint` - `v1/accounts/{accountId}/account-transactions`**
- GET `/` (client uses - "activity"), GET `/{id}`, POST `/create`, PUT `/edit`, DELETE `/{id}` - `AccountTransactionDto`. (Lets a caller write ledger rows directly.)

**7. `AccountStatementEndpoint` - `v1/accounts/{accountId}/statement`** (`CrudService`, `ReportManager`)
- GET `?from=YYYY-MM-DD&to=YYYY-MM-DD` -> **`application/pdf`** attachment (Jasper `account_statement.jasper`, opening balance + running balance computed in the endpoint). Client uses. This is the only report exposed over REST.

**8. `PaymentWalletEndpoint` - `v1/accounts/wallets`** (`CrudService`, `ActivityService`)
- GET `/list/{accountId}`, GET `/{id}`, POST `/create` (`@Valid PaymentWalletDto`), PUT `/edit`, DELETE `/{id}`. Client uses list/create/edit/delete.

**9. `CashTransactionEndpoint` - `v1/cash-transactions`** (`PaystackService`, `NotificationServiceImpl`, `ActivityService`, `CrudService`)
- GET `/` - broken: reads `@PathParam("accountId")` that is not in the path, so always "Account Record Not Found".
- GET `/{id}`; GET `/trans-ref-no/{tranRefNo}` (client uses).
- POST `/init` - `CashTransactionDto{accountId, amount, debitCredit, paymentWalletId, portfolio}` -> creates PENDING `CashTransaction`; for CREDIT calls Paystack initialise and returns `paymentUrl`; sends notification (client uses).
- POST `/verifypayment/{id}` -> `PaystackService.verifty`, sets PAID/verified (client uses).
- POST `/updatepayment/{id}?status=bool` -> sets `paid` flag directly (no verification, no auth).
- POST `/create`, PUT `/edit`, DELETE `/{id}` - edit/delete also depend on the missing `accountId` path param (broken).

**10. `PayStackWebhook` - `v1/paystack`**
- POST `/events` - raw Paystack event body; handles `charge.success`: finds `CashTransaction` by `tranRefNo`, sets PAID. **No signature (`x-paystack-signature`) check, and the modified entity is never saved**, so the webhook has no effect; the failure branch repeats the success condition (dead code).

**11. `TradeOrderEndpoint` - `v1/equities/order`** (`EquityOrderService`, `EquitiesService`, `MarketPriceService`, `PortfolioService`, `SingletonIdService`, `ActivityService`)
- GET `/` all equity orders (desc by created).
- GET `/stock-info/{stockCode}` -> `{stockCode,currentPrice,upperLimitPrice,lowerLimitPrice}` (+/-20% band) (client uses).
- GET `/{id}` (client uses).
- POST `/confirm` - `@Valid EquityOrderDto` -> computes consideration, commission (1.8%), regulatory fee (0.7%), cash balance; does not persist (client uses).
- POST `/create` -> persists with status PENDING, 201 with id (client uses).
- POST `/{id}/cancel` -> CANCELLED / PARTIALLY_FILLED_CANCELLED (client uses).
- DELETE `/{id}/delete` -> only EXPIRED or CANCELLED (client uses).
- Client also calls PUT `/equities/order/edit` - **no such server method** (would 405/404).

**12. `FixedIncomeTradeOrderEndpoint` - `v1/fixed-income/orders`** (`SingletonIdService`, `PortfolioService`, `CrudService`)
- GET `/`, GET `/{id}`, POST `/confirm` (`@Valid FixedIncomeTradeOrderDto`; maturity value = amount + yield*days/365), POST `/create` (status PENDING, always BUY, security resolved from latest `FixedIncomeMarketPrice` by ISIN), DELETE `/{id}`. Client uses confirm/create/delete and also PUT `/edit` which **does not exist** here.

**13. `TradeEndpoint` - `v1/trades`** - CRUD on `EquityTransaction` via `EquityTradeDto`: GET `/`, GET `/{id}`, POST `/create`, PUT `/edit`, DELETE `/{id}`. Not used by the client app.

**14. `PortfolioEndPoint` - `v1/portfolio`** (`PortfolioService`) - GET `/{accountId}` -> `Portfolio`; GET `/cashbalance/{accountId}` -> `CashBalance`; GET `/equities/{accountId}` -> `EquityHolding[]`. Client uses all three.

**15. `MarketDataEndpoint` - `v1/market-data`** - GET `/active-fixed-income?subClass=` -> `FixedIncomePrice[]` (isin, issuerCode, yield, marketPrice, maturityDate) for the previous business day; `subClass` filter is a no-op; yield 0 is replaced with a hard-coded 5.5. Client uses.

**16. `LookupEndpoint` (`@Stateless`) - `v1/data`** - GET `/titles, /gender, /marital-status, /education, /id-type, /alert-type, /annual-income, /payment-type, /debit-credit, /portfolios, /relationships, /country, /bank, /bank-branch, /risk-level` -> `LookupItem[]` or simple lists. Client uses most.

**17. `EquitiesLookupEndpoint` (`@Stateless`) - `v1/equities/data`** - GET `/buysell, /order-type, /time-in-force, /asset-sub-class, /stock`. Client uses `/stock`.

**18. `SupportEndpoint` - `v1/support`** (`CaseService`, `CrudService`) - client uses all.
- GET `/categories` (active, non-restricted) -> `CaseCategoryDto[]`.
- GET `/cases/list/{investorId}?openOnly=` -> `SupportCaseDto[]`.
- GET `/cases/{investorId}/{caseId}` -> `SupportCaseDto` with client-visible thread.
- POST `/cases/create` - `@Valid NewCaseRequestDto{investorId, subject, description, caseType, accountId, categoryId, relatedType, relatedId, relatedSummary}`.
- POST `/cases/reply`, `/cases/accept`, `/cases/satisfaction` - `@Valid CaseReplyRequestDto{investorId, caseId, body, rating}`.
- No attachment upload/download over REST.

**19-23. Reference-data CRUD (same 5-method shape: GET `/`, GET `/{id}`, POST `/create`, PUT `/edit`, DELETE `/{id}`; `CrudService` only)**
- `CountryEndpoint` - `v1/countries` (`CountryDto`) - client reads the list.
- `RiskLevelEndpoint` - `v1/risk-levels` (`RiskLevelDto`).
- `StockExchangeEndpoint` - `v1/stock-exchanges` (`StockExchangeDto`).
- `RiskAssessmentQuestionEndpoint` - `v1/risk-assessment-questions` (`RiskAssessmentQuestionDto`) plus nested `/{id}/answers`, `/{id}/answers/{aid}`, `/{id}/answers/create`, `/{id}/answers/edit`, DELETE `/{id}/answers/{id}` (the nested ones reuse `@PathParam("id")` for both ids - bug).
- `RiskAssessmentAnswerEndpoint` - `v1/risk-assessment-answers` (`RiskAssessmentAnswerDto`).

**24. `InvestorRiskAssessmentEndpoint` - `v1/investor-risk-assessments`** - same 5-method CRUD with `InvestorRiskAssessmentDto`.

Total: 24 resource classes (+ `ModelConvertor` helper in the same package).

### Consumer confirmation
- `laurus-web-app/proxyconfig.json` proxies `/api/**` to `http://localhost:8080/brokerage-admin`; `environment.ts` baseApi `http://localhost:8080/brokerage-admin/api/v1`; prod `baseApi: 'api'` with `src/_redirects` -> `http://65.21.3.38:8080/brokerage/api/v1/:splat`.
- Every path the client calls maps to the classes above; conversely nothing in the JSF admin calls these endpoints.
- `PayStackWebhook` is consumed by Paystack (server-to-server).

---

## 3. Admin-facing vs client-facing endpoints

- **There are no back-office endpoints.** All 24 resources are investor/portal-facing (or webhook / ping). Nothing authenticates a `UserAccount` over REST; `UserService.login(Credential)` is used only by the JSF `LoginController`.
- Several resources are *admin-shaped* (unscoped CRUD on reference data and global lists) but they are unauthenticated and were generated for the portal, not designed as an admin API: Country, RiskLevel, StockExchange, RiskAssessmentQuestion/Answer, InvestorRiskAssessment, Trade, `GET /investors/list`, `GET /accounts`, `GET /equities/order`, `GET /fixed-income/orders`, `DELETE /investors/{id}`. They could be reused as a starting point, but only after an auth layer exists, and they cover a small fraction of the back-office functions.
- None of the back-office workflows exist over REST: order batching/dispatch, execution upload and processing, trade authorisation, contract notes, cash transaction approval, KYC verification, corporate actions (dividends/bonus/FI redemptions), market price upload/fetch, fixed-income security maintenance, fees, case desk actions (acknowledge/assign/escalate/resolve/internal notes/attachments), contact log, user administration, messaging templates, dashboards, and all reports except the account statement.

---

## 4. Services (`J/services/**`)

How JSF beans obtain services: plain CDI **`@Inject`** (142 injections, no `@EJB`, no JNDI). Beans are overwhelmingly `@SessionScoped` `@Named` (61), a few `@ViewScoped`/`@RequestScoped`. Most beans inject `CrudService` and build `QryBuilder` queries directly against `crudService.getEm()` - a great deal of query and business logic lives in the JSF controllers, not in services.

| Class | Type | Purpose / key public methods | Notes |
|---|---|---|---|
| `CrudService` | `@Stateless` extends `CrudController` | Generic persistence facade over `@PersistenceContext` EM: `save, update, delete(Class,id), find, findAll, findBySingleField, count, generateId, getEm`, bulk `deleteAll`. | Used by everything. `EntityModel` has soft-delete `deleted` flag and `lastModifiedBy`; `setCurrentUserID` is never called here. |
| `IdService` | `@Stateless` | UUID ids. | |
| `SingletonIdService` | `@Singleton` (EJB) | Human-readable codes: `initAccountId` (yyMMdd+NNN), `initInvestorId`, `initExecutionId` (EXyyMMddNNN), `tradeId(EquityOrder / FixedIncomeTradeOrder)` (orderNo), `initCaseReference` (CS-yyMMdd-NNN). | Count-based; relies on singleton write lock for uniqueness (single node only). |
| `AccountService` | `@Stateless` | `initPrincipal(investor)` (create default account; sets bioDataVerified if completed), `accountReferences`, `deleteBlockedBy`, `deleteAccount`, `deleteInvestor` (bulk cascade). | |
| `InvestorService` | `@Stateless` | KYC save per section: `saveInvestor, savePersonalInformation, saveIdentification, saveFinancialProfile, saveBeneficiaryDetails, savePepAssessment, saveTaxCompliance, saveTradingAccount`. | Returns JAX-RS `Response`; sends bio-data-complete notification; stores images via `InvestorFileService`. |
| `InvestorFileService` | `@Stateless` | `saveImages`, `addImagesTo(dto)` - profile image and signature as BLOBs in `investor_files`. | |
| `InvestorImageCodec` | static util | base64 decode/encode; JPEG/PNG magic-byte check; max 5 MB. | |
| `PendingRegistrationService` | `@Stateless` | `findByEmailOrPhone, find, deleteAllFor`. | Own `@PersistenceContext`. |
| `AuthInvestorService` | `@Named` CDI bean | `loginInvesor(loginId,password)`, `prepLoginResponse`, `hashPassword`, `generateRandomPin` (SecureRandom), `setupInvestorOTP`, `setupOtp(pending)`, `otpExpired` (5 min), `performLogout`, `sendResetLink` (unused link flow). | Investor passwords and OTPs hashed with `SecurityHash.shaHash`. |
| `LoginOtpService` | `@Stateless` | `send(investor)` (cooldown, window, max sends), `verify(investor, otp)` (max attempts, expiry, constant-time compare). | Limits are constants on `LoginOtp`. |
| `UserService` | `@Stateless` | **Back-office** `login(Credential)` (email + SHA hash match); `emailPhone(email)` password reset that sets a new random 6-char password but **never sends the email** (leftover "Breath" app code). | |
| `AuditTrailUserAccountService` | `@Stateless` | `@Asynchronous recordLogin(investor, sessionId)`, `recordLogout(sessionId)` -> `UserLogin`. | Investor logins only. |
| `ActivityService` | `@Stateless` | 16 `@Asynchronous record*Activity` methods + `recordLogin/Logout` -> `AccountActivitiy` rows (`ActivityType`). | Client-activity feed, called from REST endpoints. |
| `EquityOrderService` | `@Stateless` | `prepareOrder` (consideration, 1.8% commission, 0.7% regulatory), `totalChargesOf`. | Rates are constants, not `ExchangeFee`. |
| `EquitiesService` | `@Stateless` | `saveOrder`, `procesTodayTrades(date)`, `procesAllTrades`, `processTrade` (aggregate executions into `EquityTransaction`, compute `TradeFee`s from `ExchangeFee`, mark executions PROCESSED), `evaluateTradeOrder` (PENDING / PARTIALLY_FILLED / COMPLETELY_FILLED). | Core trade-processing logic; invoked from JSF. |
| `OrderService` | `@Stateless` | Stub (`getWorkingOrders` returns empty container). | |
| `MarketPriceService` | `@Stateless` | `getStock`, `getInfo(stockCode)` (price and +/-20% limits). | |
| `StatelyMarketDataApiService` | `@Stateless` | `marketPrices(date)`, `fixedIncomeMarketPrices(range, securityCode, isin)` - HTTP GET to the Stately market-data service. | **External HTTP**, plain http, hard-coded IPs. |
| `FixedIncomeService` | `@Stateless` (1431 lines) | FI securities, transactions, corporate actions, redemptions, interest/accrual/amortisation, valuation (`evaluateFixedIncome` uses injected `ManagedExecutorService.invokeAll` - parallel), `saveFixedIncome`, `saveFixedIncomeTransaction`, `createCoporateActions`, `createRedemptionsList`, `executeEodCorporateAction`, `procesTodayTrades`, `processFixedIncomeTrade`, `evaluateFixedIncomeTradeOrder`. | Largest piece of domain logic. Depends on `jsf.AssetValuation`. |
| `ValuationService` | `@Stateless` | `runValuation(date)` -> values running FI positions, upserts `Eod.fixedIncomeHolding`. | Manually triggered; not scheduled. |
| `PortfolioService` | `@Stateless` | `getPortfolio(account,date)`, `cashBlance`, `investmentPendingOut`, `equityHoldingList`, `equitiesOverview`, `marketPriceOf`, `getCashbalance`, `getFixedIncomeHolding`. | Feeds REST and JSF. |
| `PaystackService` | `@Named` CDI bean | `initialise(cashTransaction)` (POST `api.paystack.co/transaction/initialize`), `verifty(cashTransaction)` (GET `/transaction/verify/{ref}`). | **External HTTP**; hard-coded secret key and callback URL. |
| `CaseService` | `@Stateless` (761 lines) | Case lifecycle: `raiseCase, applySlaTargets, acknowledge, assign, reclassify, addStaffMessage, addClientMessage, awaitClient, escalate, resolve, close, reopen, recordSatisfaction, thread, history, attachments, resolutionOf, findByReference, casesOf, sweepSlaBreaches, seedReferenceData, writeEvent`. | All transitions write `CaseEvent`. Default SLA 8h ack / 40h resolve, scaled by priority factor. |
| `SlaSweeper` | `@Singleton @Startup` | `@Schedule(hour="*", minute="*/15", persistent=false) sweep()` -> `caseService.sweepSlaBreaches()` (flags breaches, auto-escalates). | **The only scheduled job.** |
| `CaseAttachmentStore` | `@Stateless` | `store(...)`, `pathOf`, `read`, `isAllowed`. | **File storage** on local disk; see section 8. |
| `ConfigurationService` | `@Stateless` | `get(MessagingTemplateType[, MessageType])` -> template text. | |
| `DataLoadingService` | `@Stateless` | `deleteTrade()`, `deleteOrders()` - wipe trades / cash transactions / orders. | Dangerous maintenance utility reachable from the UI [inferred]. |
| `PhoneNumberService` | static util | `sanitize`, `desanitize` (Ghana numbers). | |
| `SendSms` | static util | `mnotify(key, sender, phone, msg)` -> POST `api.mnotify.com/api/sms/quick`; legacy unused senders for smsgh and bulksms with embedded credentials. | **External HTTP.** |
| `notification/NotificationService` | interface | welcome, bio-data-complete, platform-welcome, cash-transaction, reset-link, OTP (x2). | |
| `notification/NotificationServiceEmailImpl` | `@Named @RequestScoped` | SMTP via `EmailProcessor` (commons-email); `getEmailSetup()` returns hard-coded SMTP host/account/password (SSL 465). | The `EmailConfiguration` entity is **not** used. |
| `notification/NotificationServiceSmsImpl` | `@Named` | mNotify SMS; hard-coded sender id and API key. | Welcome and platform-welcome SMS are composed but not sent. |
| `notification/NotificationServiceImpl` | `@Stateless` | Fan-out to email + SMS; all 7 methods `@Asynchronous`. | The one callers inject. |
| `notification/CaseNotificationService` | `@Stateless` | `@Asynchronous caseLogged, caseAcknowledged, caseReply, caseResolved` -> email + SMS to the client. | |
| `notification/MessageCompositionService` | `@RequestScoped` | Fills `MessagingTemplate` text with `{PLACEHOLDER}` variables; built-in default texts for case messages. | |

Root package: `SpsException` (checked exception, effectively unused), `CollectionHelper.checkAdd`.
`config/DbInitService` - see section 8.

### Summary of side-effecting behaviour
- **Scheduled**: `SlaSweeper.sweep` every 15 minutes (non-persistent EJB timer). Nothing else: no EOD job, no order expiry, no price fetch - those are button-driven from JSF.
- **Async**: `ActivityService` (16), `AuditTrailUserAccountService` (2), `NotificationServiceImpl` (7), `CaseNotificationService` (4); `FixedIncomeService` uses `ManagedExecutorService`.
- **Email**: SMTP via commons-email, hard-coded config.
- **SMS**: mNotify HTTP API.
- **Payments**: Paystack initialise + verify + (ineffective) webhook.
- **Market data**: Stately marketdata REST (`/market-prices`, `/market-prices/fixed-income-prices`); additionally `jsf/equities/FixedIncomePriceFetchController` makes its own `java.net.http.HttpClient` call (JSF package - flag to whoever covers it).
- **CSD / exchange / bank integrations**: none in code. Orders go to the exchange via Excel batch export and executions come back by Excel upload (JSF controllers). Investor has `csdCode`, `depAccountNo`, `gsdNumber` fields but no integration.
- **File storage**: case attachments on local disk; investor images as DB BLOBs; Excel uploads to `ExcelExporter.TEMP_DIR`; report temp files in `${java.io.tmpdir}/brokerage`.

---

## 5. Entities and enums

Base classes (stately-common): `EntityModel` (`createdDate`, `lastModifiedDate`, `lastModifiedBy`, `updated`, `deleted`; `@PrePersist/@PreUpdate`), `UniqueEntityModel` (String `id`), `DateRecord` (adds `valueDate` and derived month/week/quarter/year codes). All ids are application-generated strings. Static `_fieldName` constants on entities are used for `QryBuilder` queries.

### `entities` (root)
| Entity (table) | Meaning / relationships |
|---|---|
| `Transaction` (`@MappedSuperclass`, extends DateRecord) | transDate, authDate, authorisedBy, authorised, inputBy, description, batch, systemTransaction; -> `Account`. |
| `InvestmentTransaction` (`@MappedSuperclass` extends Transaction) | buySell, ledgerAccount, investmentType (`EntrySource`), currency, postToLedger; -> `SecurityIssuer` counterparty. |
| `Order` (`@MappedSuperclass` extends DateRecord) | orderNo, buySell, **orderStatus**, orderSource, orderType, timeInForce, expiryDate, authorised/authorisedDate, estimated/actual costs, consideration, regulatoryFees; -> `Account`. |
| `AccountTransaction` (account_transactions) | Client ledger line: credit, debit, description, unique `transaction_id`, portfolio, sourceData; -> `Account`. **Populated by MySQL triggers** (section 8). |
| `CashTransaction` (cash_transactions) | Deposit/withdrawal: amount, debitCredit, paymentChannel, **paymentStatus**, paid, verified, tranRefNo, paymentUrl; -> `Account`, `PaymentWallet`, `BankAccount`. |
| `PaymentWallet` (payment_wallets) | Client payout destination (mobile money or bank); -> `Account`, `Bank`, `BankBranch`. |
| `FixedIncomeTransaction` (fixed_income_transactions; extends InvestmentTransaction) | FI holding / execution: cost, faceValue, price, ytm, interestRate, maturityDate, amortisedCost, marketValue, transactionStatus, executionType, tenor; -> `FixedIncome`, `FixedIncomeTradeOrder`. |
| `FixedIncomeRedemption` (fixed_income_redemptions; extends InvestmentTransaction) | Coupon / principal payout: amount, corporateActionType, redemptionStatus, redemptionType, executed; -> `FixedIncomeTransaction`, `FiCorporateAction`. |
| `FiCorporateAction` (fi_corporate_action) | Scheduled coupon / principal event; -> `FixedIncome`. |
| `Dividend` (dividends) / `DividendPayout` (dividend_payouts) | Declared dividend per `Stock` (status); payout per `Account`. |
| `Bonus` (bonus_issues) / `BonusPayout` (bonus_payouts) | Bonus share issue per `Stock`; shares credited per `Account`. |
| `Eod` (eods) | End-of-day valuation snapshot (many BigDecimal NAV fields; inherited from a fund-management product, only `fixedIncomeHolding` is written here). |
| `Bank`, `BankBranch` (-> Bank), `BankAccount` (firm's own bank accounts) | Reference data. `Bank` -> `Country`, `mobileMoney` flag. |
| `Country`, `Industry`, `Registrar`, `RiskLevel`, `SecurityIssuer` (-> Country) | Reference data. |
| `MessagingTemplate` (messaging_templates) | emailText / smsText per `MessagingTemplateType`. |
| `EmailConfiguration` (email_configurations) | SMTP settings entity - defined but not used by the notification code. |
| `UserAccount` (user_accounts) | **Back-office user** (section 7). |
| `UserLogin` (user_logins) | Investor login/logout audit; -> `Investor`. |

### `entities.accounts`
| Entity | Meaning / relationships |
|---|---|
| `Investor` (investors) | The client and their full KYC record (~110 fields: identity, residency, ID document, contacts, bank, employment, income, risk profile, PEP, tax/FATCA, trading preferences, CSD fields) **plus portal credentials** (`userPassword`, `resetPasswordToken`, `resetPasswordTokenInitiatedDate`) and KYC state flags `bioDataCompleted`, `bioDataVerified`, `active`, `verifiedDate`, `verifiedBy`, `lastSectionIndex`. -> `Country` x2, `Bank`, `BankBranch`, `RiskLevel` x2. |
| `Account` (accounts) | Trading account: accountCode, depositoryCode, accountType, classification, creditLimit; -> `Investor principalInvestor`, `StockExchange`. |
| `AccountInvestor` | Join: co-holders of an account. |
| `AccountActivitiy` (account_activities) | Client activity feed row; -> Account, Investor. |
| `Beneficiary` | Beneficiary / next of kin with percentage allocation; -> Investor. |
| `InvestorBankAccount` | Additional bank accounts; -> Investor, Bank, BankBranch. |
| `InvestorFile` (investor_files) | BLOBs `profileImage`, `signature`; -> Investor. |
| `RiskAssessmentQuestion` / `RiskAssessmentAnswer` (-> question, riskScore) / `InvestorRiskAssessment` (-> Investor, answer) | Risk questionnaire. |
| `LoginOtp` (login_otps) | Login OTP hash, attempts, send counters; -> Investor. |
| `PendingRegistration` (pending_registrations) | Unverified sign-up (email, phone, names, password hash, OTP hash, expiry). |
| `LoginSession` (login_sessions) | -> Investor, activeStatus. Defined, apparently unused. |

### `entities.equities`
| Entity | Meaning / relationships |
|---|---|
| `StockExchange` | exchangeCode, name, settlementPeriod. |
| `Stock` | Listed equity; -> StockExchange, Industry, Registrar. |
| `StockExchangeAccount` | Client depository code per exchange; -> Account. |
| `EquityMarketPrice` | Daily price; -> Stock. |
| `EquityOrder` (equity_orders; extends Order) | orderQuantity, qtyExecuted, qtyLeft, orderPrice; -> Stock, `EquityOrderBatch`. |
| `EquityOrderBatch` | Batch of orders sent to the exchange (batchDate, dispatched date, locked, totals). |
| `EquityTradeTransaction` (equity_trades_transactions) | Single execution / fill: quantity, executionPrice, executionCost, executionId, executionType, transactionStatus; -> EquityOrder, EquityTransaction, Stock. |
| `EquityTransaction` (equity_transactions) | Aggregated trade per order per day (basis of contract note): quantity, tradePrice, consideration, commissions, netConsideration, authorised; -> Account, EquityOrder, Stock. |
| `FeeType`, `ExchangeFee` (-> StockExchange, FeeType; NOMINAL / PERCENTAGE, brokerCommission flag), `TradeFee` (-> ExchangeFee, EquityTransaction) | Fee schedule and fees applied per trade. |
| `FixedIncome` (fixed_income_security) | Bond / bill master: coupon, dayCount, tenor, issue/maturity, ISIN, ratePolicy, interest interval; -> SecurityIssuer. |
| `FixedIncomeMarketPrice` | Daily price / yield by ISIN; -> FixedIncome. |
| `FixedIncomeTradeOrder` (fixed_income_orders; extends Order) | amount, amountSold, amountLeft, isin, yield, maturityDate, maturityValue, subClass; -> FixedIncome, `FixedIncomeOrderBatch`. |
| `FixedIncomeOrderBatch` | As equity batch. |

### `entities.support` (client care)
`SupportCase` (reference, type, category, subject, channel, priority, **caseStatus**, timestamps, SLA due dates, breach flags, escalated, pausedMinutes, related object; -> Investor, Account, `UserAccount owner`, CaseTeam), `CaseMessage` (-> case, `UserAccount staffAuthor` or `Investor clientAuthor`, visibility), `CaseEvent` (audit trail: eventType, from/to status, actor, note), `CaseAttachment` (storageKey), `CaseCategory` (self-parent, default priority, ack/resolve hours, team, escalationTeam, restricted), `CaseTeam` (defaultAssignee, teamLead -> UserAccount), `CaseResolution` (code, rootCause, remedy, compensationAmount, resolvedBy), `CaseSatisfaction` (rating 1-5), `ClientInteraction` (contact log; -> Investor, UserAccount, optional case).

### Non-entity model classes
- `entities/detail` (13 report-row POJOs, not persisted): `AccountTradeDetail, AccountTransactionDetails, CashTransactionDetail, ComplaintRegisterDetails, ContractNoteFee, EquityTransDetail, EquityTransactionDetail, EquityWorkingOrderDetails, FixedIncomeTradeOrderDetails, FixedIncomeTransactionDetail, InvestorDetails, TradeOrderDetails, TradeOrderModel`.
- `J/model`: `OrderContainer, ExecutionOrderGroup, PendingExecutionDay, TradeFeeModel, ContractNote` (view models).
- **`jsf/AssetValuation` is an `@Entity`** (extends `UniqueEntityModel`) living in the `jsf` package and is used by `AccountService` and `FixedIncomeService`. It must not be dropped with the JSF layer.

### Enums / constants (`entities/constants`, 61 files)
Workflow-driving:
- **`OrderStatus`**: PENDING, SUBMITTED, PARTIALLY_FILLED, COMPLETELY_FILLED, EXPIRED, CANCELLED, PARTIALLY_FILLED_CANCELLED; `workingOrders = [PENDING, SUBMITTED, PARTIALLY_FILLED]`.
- **`TransactionStatus`**: PROCESSED, NOT_PROCESSED (executions).
- **`ExecType`**: NEW, FILL, PARTIAL_FILL (`fills` list).
- **`PaymentStatus`**: PAID, PENDING, CANCELLED, FAILED. **`PaymentChannel`**: MOBILE_MONEY, CARD_PAYMENT. **`PaymentWalletType`**: MOBILE_MONEY, BANK_ACCOUNT.
- **`CaseStatus`**: NEW, ACKNOWLEDGED, IN_PROGRESS, AWAITING_CLIENT, RESOLVED, CLOSED (`openStatuses`, `settledStatuses`). **`CasePriority`**: CRITICAL(0.5), HIGH(0.75), MEDIUM(1.0), LOW(2.0) SLA factors. **`CaseType`**: COMPLAINT, QUERY, REQUEST, FEEDBACK. **`CaseChannel`**: PORTAL, EMAIL, PHONE, WALK_IN, BRANCH, SOCIAL, INTERNAL. **`CaseVisibility`**: CLIENT, INTERNAL. **`CaseEventType`**: RAISED, ACKNOWLEDGED, ASSIGNED, STATUS_CHANGED, MESSAGE_SENT, NOTE_ADDED, ATTACHMENT_ADDED, ESCALATED, SLA_BREACHED, RESOLVED, CLOSED, REOPENED, SATISFACTION_RECORDED. **`CaseResolutionCode`**: RESOLVED_IN_FAVOUR, RESOLVED_EXPLAINED, RESOLVED_WITH_REDRESS, NOT_UPHELD, WITHDRAWN, NO_RESPONSE, REFERRED. **`CaseRelatedType`**: NONE, EQUITY_ORDER, FIXED_INCOME_ORDER, CASH_TRANSACTION, ACCOUNT.
- **`RedemptionStatus`**: PAID, PARTIALLY_PAID, UN_PAID. **`RedemptionType`**: SCHEDULED, UN_SCHEDULED. **`CorporateActionType`**: INTEREST_PAYMENT, PRINCIPAL_REDEMPTION. **`DividendStatus`** / **`BonusStatus`**: DECLARED, RECORDED, EXECUTED.
- **`OtpSendResult`**: SENT, COOLDOWN, LIMIT_REACHED. **`OtpVerificationStatus`**: SUCCESS, FAILED, NULL, EXPIRED, LOCKED.
- **`ActiveInactiveStatus`**: ACTIVE, INACTIVE (the only state on `UserAccount`).
- **KYC status has no enum** - it is the three booleans on `Investor` (`bioDataCompleted`, `bioDataVerified`, `active`) plus `verifiedDate` / `verifiedBy`.
- **No role / permission / access-level enum exists.** `Group` (CLIENT_SERVICE, SETTINGS, ORDER_MANAGEMENT) is only a menu grouping.

Trading / instrument: `BuySell` (BUY, SELL), `OrderType` (BEST_EFFORT, LIMIT_ORDER, MARKET_ORDER, OTHER), `OrderSource` (ONLINE, BACK_OFFICE), `TimeInForce` (GOOD_TILL_CANCEL, DAY_ORDER), `ApplicationMode` (NOMINAL, PERCENTAGE), `AssetClass` (EQUITIES, COLLECTIVE_INVESTMENT_INSTRUMENT, CASH, CURRENCY, FIXED_INCOME, REIT, RECEIVABLE, PAYABLES), `AssetSubClass` (GOVT_TB, GOVT_BONDS, GOVT_TN, EURO_BONDS, STATUTORY_AGENCY_BILL, ... each with code, AssetClass and category), `AssetSubClassCategory`, `FixedIncomeTenor` (TWO_WEEKS ... multi-year, with code and days), `FixedIncomeDayCount` (ACT_360 ... ACT_368), `FIMarketType` (PRIMARY, SECONDARY, TRANSFER), `RatePolicy` (FIXED_RATE, FLOATING_RATE), `BondValuationMethod` (STRAIGHT_LINE, MARK_TO_MARKET, EFFECTIVE_INTEREST_RATE, NO_AMORTISATION), `PremiumDiscount`, `ValuationCategory` (ASSETS, LIABILITIES, AMORTISATION), `LedgerAccount` (PAYABLES, RECEIVABLES, CALL_INTEREST, INTEREST, CONTRIBUTION, REDEMPTION, DIVIDEND, ADMIN_FEES, MANAGEMENT_FEES, ... each with DebitCredit and code), `EntrySource` (FixedIncomeDeal, FIXED_INCOME_REDEMPTION, BANK_TRANSACTION, EQUITY_TRADE, COLLECTIVE_INVESTMENT_SCHEME, REIT, ...), `SourceData` (CASH_TRANSACTIONS, EQUITY_TRANSACTIONS, FIXED_INCOME_TRANSACTIONS - written by DB triggers), `Portfolio` (TRADING_ACCOUNT, MUTUAL_FUND).

Account / investor: `AccountType` (INDIVIDUAL, CORPORATE, ITF, JOINT), `AccountClassification` (LOCAL_RETAIL, LOCAL_INSTITUTIONAL, FOREIGN_RETAIL, FOREIGN_INSTITUTIONAL), `InvestorType` (INDIVIDUAL, CORPORATE), `ResidentialStatus` (4), `EmploymentStatus` (EMPLOYED, SELF_EMPLOYED, UNEMPLOYED, RETIRED, STUDENT), `Education` (BASIC ... ADVANCED_DEGREE), `AnnualIncome` (4 GHS bands), `SourceOfFunds`, `InvestmentHorizon`, `AnticipatedInvestmentActivity`, `Relationship` (12), `BankAccountType` (CURRENT, CALL, NOTIONAL, ADJUSTING_ACCOUNT), `AlertType` (PURCHASE, SALES).

Messaging / misc: `MessagingTemplateType` (INITIAL_REGISTRATION_MESSAGE, PLATFORM_WELCOME_EMAIL, BIODATA_COMPLETION_EMAIL, CASH_DEPOSIT, CASE_LOGGED, CASE_ACKNOWLEDGED, CASE_REPLY, CASE_RESOLVED), `MessageType` (SMS, EMAIL), `EmailVariables` (class of `{PLACEHOLDER}` constants: RECEIPIENT, FULL_NAME, INVESTOR_NAME, LAST_NAME, OTHER_NAMES, AMOUNT, BALANCE, CASE_REFERENCE, CASE_SUBJECT ...), `ActivityType` (LOGIN, LOGOUT, FUND_ACCOUNT, ORDER_EQUITY, DELETE_EQUITY_ORDER, ORDER_FIXED_INCOME, DELETE_FIXED_INCOME, ACCOUNT_TRANSACTION, CASH_TRANSACTION, INVESTOR, PAYMENT_WALLET, TRADE), `InteractionType` (CALL, EMAIL, MEETING, VISIT, NOTE), `InteractionDirection` (INBOUND, OUTBOUND), `Group`.

Several label enums have constructor argument order swapped (label/code), e.g. `AlertType`, `PaymentStatus`, `PaymentChannel`, `ResidentialStatus` - `getCode()` and `getLabel()` return the opposite of what the names suggest. The API exposes `name()` and `toString()`, so check each before reproducing lookups.

---

## 6. Reports (`J/reports`)

All reports are **JasperReports 7.0.3 -> PDF**. Templates (source `.jrxml` + pre-compiled `.jasper`, loaded from the classpath as streams):
`src/main/resources/com/statelyhub/brokerage/resources/reports/` (4 shared header/footer sub-reports, portrait/landscape) and `.../reports/brokerage/`. Logo: `resources/images/laurus-africa.png` (`monarch-capital.png` also present).

Classes:
- `ReportManager` (`@Stateless`, extends common `JasperReportManager`): configured `WEB_APPLICATION` / `INPUTSTREAM` / `PDF`; preloads header/footer sub-reports, logo, colour scheme and static params (`trusteeName="Laurus Africa"`, `businessCategory`, confidentiality note, empty address/licence fields). `showReportNow` -> `showReport(...)` which **writes the PDF straight to the JSF `HttpServletResponse` via `FacesContext`** - it cannot be called from REST as is. `writeToFile` writes to `${java.io.tmpdir}/brokerage`.
- `BrokerageReportManager` (`@Named @RequestScoped`) and `FixedIncomeReportService` (`@Named @RequestScoped`): build detail rows / params and call the above.
- `BrokerageReportFiles` (template path constants), `ImageResourceFile`, `ReportsController` (`@SessionScoped` JSF bean: running fixed-income report), `UserReport` and `DetailService` (empty).

| Report | Template | Method | Triggered from (JSF bean) |
|---|---|---|---|
| Contract note | `contract_note` | `BrokerageReportManager.generateContractNote(trade, fees, executions)` | `EquityTradeController` |
| Trade report | `trade` | `generateTradeReport(trades, period)` | `EquityTradeController`, `EquityOrderExecutionProcessingController` |
| Account trades | `account_trades` | `generateAccountTradesReport(account, trades, period)` | `AccountPortfolioController` |
| Trade orders | `trade_order` | `generateTradeOrderReport` | `TradeOrderController` |
| Equity working orders | `equity_working_orders` | `generateWorkingOrdersReport(rows, asAt)` | `EquitiesWorkingOrdersListView` |
| Cash transactions | `cash_transaction` | `generateCashTransactionReport` | `CashTransactionController`, `CashTransactionRecordsController` |
| Equity transactions | `equity_trade_transaction` | `generateEquityTransactionReport` | `EquityTradesController` |
| Investor report | `investor_report` | `generateInvestorReport` | `InvestorController` |
| Portfolio statement | `portfolio_statement` | `generatePortflio(Portfolio)` | `AccountPortfolioController` |
| Complaints / cases register (landscape) | `complaints_register` | `generateComplaintsRegisterReport(rows, period)` | `support/CaseController` |
| Fixed-income transactions | `fixed_income_transaction` | `FixedIncomeReportService.generateFixedIncomeTrasactionOrder` / `transactions(list)` | `FixedIncomeWorkingOrdersListView`, `SimpleFixedIncomeTransactionController`, `FixedIncomeTransactionHistoryController` |
| Running FI transactions | `transactions` | `runningTransaction(list, date)` | `ReportsController`, `FixedIncomeTransactionHistoryController` |
| Fixed-income trade orders | `fixed_income_trade_order` | `generateFixedIncomeTradeOrderReport` / `orders(list)` | `FixedIncomeTradeOrderController` |
| Account statement | `account_statement` | `generateAccountStatement` / `printAccountTransactions` | `AccountTransactionController`, `AccountPortfolioController`; **also REST** `GET /v1/accounts/{id}/statement` (fills and exports directly, bypassing `showReport`) |
| Portfolio cash transactions | `portfolio_cash_transaction` | `printCashTransactions` | `AccountPortfolioController` |
| Equity history | `equity_history` | `printEquityTransactions` | `AccountPortfolioController` |

Orphans: `settlement_report.jrxml` has no compiled `.jasper` and no constant; `fixed_income_redemption.jasper` has no `.jrxml` and no constant.
Excel: no Jasper XLS output. `ExcelExporter` is used once (`EquityOrderBatchController` -> `BatchExport.xls`) and `ExcelDataLoader` is used for uploads (section 8). No HTML reports.

---

## 7. Back-office security model

- **User entity**: `entities/UserAccount` (`user_accounts`): `accountName`, `emailAddress`, `userPassword`, `phoneNo`, `accountStatus` (`ActiveInactiveStatus`). That is all.
- **Roles / permissions / page access**: **none exist.** No role entity, no permission table, no per-page access list, no `@RolesAllowed`, no `web.xml` security constraints, no container realm. Every logged-in back-office user can do everything. (`UserSession.userCategory` exists as a field but there is no model behind it.)
- **Password hashing**: `SecurityHash.getInstance().shaHash(pw)` = **unsalted single-round SHA-1** (`MessageDigest.getInstance("SHA")`), Base64-encoded. Same function hashes investor passwords and OTPs.
- **Login flow** (JSF): `LoginController.doLogin` -> `UserService.login(Credential)` (JPQL match on email + hash; **`accountStatus` is not checked**, so INACTIVE users can log in) -> `UserSession.login(userAccount)` (`@SessionScoped`, holds `userUR`) -> redirect to admin index. Logout invalidates the HTTP session. No lockout, no MFA, no login audit for staff.
- **Page guard**: `BrokeragePhaseListener` - at RENDER_RESPONSE, if the view id contains `"secured"` and `userSession.getUserUR() == null`, redirect to login. It only guards rendering of pages under a `secured` path; it does not guard postbacks/actions or `/api/*`.
- **Default account**: `DbInitService` creates `support@statelyhub.com` at startup with the **password equal to the email address** if it does not exist.
- **User admin**: `jsf/sysadmin/UserAccountController` (create / delete / set password), `ChangePasswordController` (checks current hash), `SigupController` (creates a `UserAccount` - check whether its page is reachable without login).
- **Audit trail**:
  - Staff actions: no general audit log. `EntityModel.lastModifiedBy` exists but `CrudController.setCurrentUserID` is never called, so it is not populated [inferred]. Per-record stamps only: `Transaction.inputBy / authorisedBy / authDate`, `EquityTransaction.authorisedBy`, `Investor.verifiedBy / verifiedDate`. Only one call to `setInputBy` was found.
  - Case module: `CaseEvent` is a proper per-case audit trail (actor name as free text).
  - Investors: `UserLogin` (login/logout, duration) and `AccountActivitiy` (activity feed).
- **Investor (portal) auth**, for contrast: password + email/SMS OTP (6 digits, 5-minute expiry, attempt and resend limits via `LoginOtp`); sign-up via `PendingRegistration` + OTP. No token is issued afterwards (section 2).

---

## 8. Other things a migration could miss

### Startup / lifecycle
- `config/DbInitService` (`@Singleton @Startup`): on **every** deploy (1) `fixInvestment()` loads **all** `FixedIncomeTransaction`s and re-saves each through `FixedIncomeService.saveFixedIncomeTransaction` (recomputation side effects, slow on large data), then (2) creates the default support user.
- `SlaSweeper` (`@Singleton @Startup`) timer.
- `CaseService.seedReferenceData()` seeds 5 teams and ~6 top-level categories with children; invoked from the UI, not at startup [inferred].

### Database behaviour outside Java
- **MySQL triggers** in `src/main/resources/com/statelyhub/brokerage/resources/sql/triggers.sql` (9 triggers: after insert/update/delete on `equity_transactions`, `cash_transactions`, `fixed_income_transactions`) maintain the `account_transactions` ledger. `transaction-triggers.sql` is an older variant (also covers `fixed_income_redemptions`, `trades`). **Nothing in Java installs them** - they are applied by hand. Cash balances, statements and the client activity list depend on them. Any new backend writing those tables through the same DB still relies on these triggers; a new DB needs them installed.
- Schema is created by EclipseLink `create-or-extend-tables`; there are no migration scripts (no Flyway/Liquibase).

### Servlets, filters, listeners, sockets, caches
- Servlets: only `FacesServlet` (`*.xhtml`). No custom `@WebServlet`, `@WebFilter`, `@WebListener`.
- JAX-RS providers: `CORSFilter`, `ValidationExceptionMapper`, `LocalDateParamConverterProvider`.
- JSF: `BrokeragePhaseListener`; 22 JSF converters in `jsf/convertors`.
- **No WebSockets**, no JMS, no CDI events (`@Observes`), no application cache (JPA L2 effectively off). The client app caches lookups on its side.

### i18n
- `resources/messages.properties` (223 lines, English only, menu/label keys) exposed as `#{msg}`. No other locales. API messages are hard-coded English strings in Java. Stray `newApacheConfTemplate.conf` files in the resources folder are junk.

### Uploaded files
- Case attachments: `CaseAttachmentStore` -> `${brokerage.attachments.dir}` or `~/brokerage-attachments/<caseId>/<uuid>_<name>`; whitelist pdf, png, jpg, jpeg, gif, txt, csv, doc, docx, xls, xlsx; max 10 MB; DB keeps the storage key. In a container this path is **ephemeral unless a volume is mounted**; nothing in the dockerfile sets it. Upload/download exists only in the JSF case desk.
- Investor profile image and signature: base64 in `InvestorDto` over REST, validated (JPEG/PNG, 5 MB), stored as BLOBs in `investor_files` (legacy copies in `Investor.profileImageUrl / signatureImageUrl` byte[] columns).
- Excel uploads (PrimeFaces `UploadedFile` -> temp file -> `ExcelDataLoader`): countries, investors (bulk), stocks, equity market prices, fixed-income market prices, stock orders, equity executions, fixed-income executions. All in JSF controllers.
- Excel export of order batches (`BatchExport.xls`).

### Hard-coded values that must become configuration (values deliberately not reproduced here)
- Paystack **secret key** (a test key) and callback URL `https://app.ananseinvest.com/paymentstatus` - `services/PaystackService.java`.
- SMTP host, account and **password** - `services/notification/NotificationServiceEmailImpl.getEmailSetup()`.
- mNotify **API key** and sender id `LaurusAdepa` - `NotificationServiceSmsImpl`; legacy SMS credentials in `services/SendSms.java`.
- Market-data base URLs (two different plain-http IPs) - `StatelyMarketDataApiService`.
- Password-reset link `http://localhost:4200/auth/change-password/...` and `http://localhost:8080/breath-web/` in notification / `UserService`.
- Commission 1.8% and regulatory 0.7% (`EquityOrderService`), +/-20% price band (`MarketPriceService`), default yield 5.5 (`MarketDataEndpoint`), OTP expiry 5 min, SLA defaults 8h / 40h, report branding in `ReportManager`.
- These secrets are committed to source control and should be rotated.

### Defects / inconsistencies worth knowing before reproducing behaviour
- REST API has no authentication; `PUT /auth/reset-password` needs no OTP; `POST /cash-transactions/updatepayment/{id}` lets any caller mark a deposit paid.
- Paystack webhook does not verify signatures and does not persist; payment confirmation effectively relies on the client calling `/verifypayment/{id}`. In `PaystackService.verifty` the channel is derived from `status` (never "card"/"mobile"), so `paymentChannel` is never set.
- `CashTransactionEndpoint` list/edit/delete and nested risk-answer routes are broken by wrong `@PathParam` names.
- Duplicate route: `GET v1/accounts/{id}/fixed-income-orders` is declared in two classes; `v1/accounts/wallets/...` overlaps `v1/accounts/{id}`.
- Client app calls `PUT equities/order/edit` and `PUT fixed-income/orders/edit`, which the server does not implement.
- `UserService.login` ignores `accountStatus`.
- Widespread `catch (Exception e) { e.printStackTrace(); }` with generic error responses; `System.out.println` logging including request bodies (passwords in reset requests, and `SecurityHash.hash` prints plaintext).
- Money is `double` throughout (except `Eod`).
- Leftovers from other Stately products ("Breath", "Sps", "trustee", "monarch capital", fund-NAV fields in `Eod`).
- pom Java version mismatch (17 vs 21) and JDK 25 runtime.
- JNDI name mismatch `jdbc/brokerage` vs `jdbc/brokerage__pm` (unverified whether it matters).

### Could not determine
- Whether the deployed production instance uses the same context root and whether the kustomize deploy step runs elsewhere.
- Contents of the `jakarta-dependency` repo (which jars are injected: Jasper, MySQL driver, POI, etc.).
- Exact JSON date/number formats emitted by `ApiResponse.toJson()` (depends on `JsonUtils` Gson config in stately-common).
- Whether the SQL triggers are actually installed in each environment.
- Runtime behaviour generally: nothing was compiled, deployed or called.
- Internals of the `jsf` package beyond wiring (out of scope) - note that much business logic (batching, execution processing, corporate actions, KYC verification, price upload) lives there and is **not** in the services listed above.
