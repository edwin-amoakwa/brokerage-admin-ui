# Implementation guide: JSF admin to Angular

How each migrated screen is built. The plan (approved, defaults taken) is the Claude Doc
"Brokerage Admin: JSF to Angular Migration Plan". The detailed inventories next to this file
(`jsf-inventory.md`, `backend-inventory.md`, `astra-conventions.md`) list every page, action and
bean method that must survive.

## Where things live

| What | Path |
|---|---|
| Backend WAR | `brokerage/brokerage-admin` (Java 17 source level, Jakarta EE 10, Payara) |
| Admin REST base | `api/admin` package, URL `api/v1/admin/...` |
| Admin endpoints | `com.statelyhub.brokerage.api.admin.endpoint.<module>` |
| Admin DTOs | `com.statelyhub.brokerage.api.admin.dto.<module>` |
| Admin services (logic moved out of JSF beans) | `com.statelyhub.brokerage.services.admin.<module>` |
| Angular app | `brokerage-admin-ui` (Angular 21.2, PrimeNG 21.1.10, zone change detection) |
| Feature screens | `src/app/features/<feature>/...`, routes in `<feature>.routes.ts` |

## Backend rules

- Follow astra-web's classic CRUD style: `XxxAdminEndpoint`, `@Path("v1/admin/<plural-kebab>")`,
  `POST` create (201), `PUT` update with the id in the body, `GET /{id}`, `GET` list, `DELETE /{id}`,
  actions as `POST|PUT /{id}/<verb>`.
- Annotate every endpoint class with `@AdminPermission(AdminPages.XXX)` (a method-level annotation
  overrides it). Lookups and pickers need only a session.
- List endpoints take `@BeanParam AdminSearchParam` (or a subclass with extra `@QueryParam`s) and
  return `AdminApi.page(() -> freshBuilder, param, this::toDto)`. The supplier must build a NEW
  `QryBuilder` each call.
- Responses always use `com.stately.common.api.ApiResponse` (`ok`, `created`, `findResult`,
  `delete`, `error`). Business failures are HTTP 400 with a message the user can act on.
- DTOs are hand-written classes with getters/setters. References are flattened to `xxxId` +
  `xxxName`; enums go out as `xxx` (constant name) + `xxxName` (label); dates are `LocalDate` /
  `LocalDateTime`; money is `double`. Never return entities (Gson would follow the graph).
- Logic that sits in a JSF bean moves into a `@Stateless` service under `services.admin.<module>`.
  Multi-step writes are ONE service method so they are one transaction. Throw `AdminException`
  for rule failures: it rolls back and becomes a 400 with its message.
- Audit fields (inputter, authorisedBy, verifiedBy, actorName...) come from the injected
  `AdminContext` (`getUserName()`, `getUser()`), never from request headers.
- Reports: `AdminReportService.pdf(reportFile, title, rows, params)` returns
  `ApiResponse.ok(<base64 PDF>)`. Reuse the existing detail builders in `reports/` where they help;
  never call `showReportNow` (it writes to the JSF response). Endpoint style:
  `GET v1/admin/<resource>/report?...` or `GET v1/admin/<resource>/{id}/<report-name>`.
- File uploads: JSON body with a `FileUploadDto`-shaped object `{fileString (data URL), fileName}`;
  `new FileUploadDto(fileString, fileName).createFile()` gives a temp file. Uploads are
  preview-then-confirm where the JSF page had a preview. Never delete existing rows before parsing:
  update or insert instead.
- Do not change entities, `persistence.xml`, JSF pages or JSF beans. Do not edit shared admin files
  (`AdminPages`, `AdminApi`, `AdminContext`, `AdminAuthFilter`, `AdminLookupEndpoint`,
  `AdminPickerEndpoint`, `AdminSearchParam`, `AdminReportService`). You may reuse existing services;
  add methods to an existing service only when your brief says you own it.
- Known-broken JSF features are fixed in the new code (intended behaviour), not ported as broken.
- Compile with `scratchpad/compile-backend.sh` (it takes a lock; other workers may be compiling).

Reference files: `endpoint/sysadmin/BankAdminEndpoint.java` (simple CRUD),
`endpoint/UserAccountAdminEndpoint.java` (CRUD with extra action), `endpoint/AdminPickerEndpoint.java`.

## Frontend rules

- Default Angular file layout: every component is `x.component.ts` + `x.component.html` +
  `x.component.scss` (`templateUrl` / `styleUrl`), never an inline template or styles, one component
  per file, each page in its own folder.
- Typescript records are `any`; no domain models. Services/components call `ApiService`
  (`get/post/put/delete/save`, paths relative to `v1/admin`), which resolves to the envelope and
  never throws. Check `response.success`.
- The interceptor already toasts successful POST/PUT/DELETE and every error. Do not add duplicate
  toasts; use `NotifyService` only for client-side validation or extra info.
- Deletes and irreversible actions confirm with `NotifyService.confirmDelete()` / `confirm()`.
- Dropdowns: `LookupService.enum('EnumName')` (any enum in `entities.constants`) or
  `LookupService.list('stocks')` (see `AdminLookupEndpoint`), bound with
  `optionLabel="itemName" optionValue="id"` on `p-select` with `appendTo="body"`.
- Dates: native `<input type="date" pInputText>` bound to ISO `yyyy-MM-dd` strings (`today()` and
  `isoDate()` in `core/api.service.ts`). Display with `| date: 'dd/MM/yyyy'`; money with
  `| number: '1.2-2'`.
- Pickers: `<app-entity-picker kind="account|investor|fixed-income" [value]="x" (selected)="...">`.
  The selection is the page's own state (no carry-over between pages).
- Reports: `reportData = new ReportData()`, `reportData.showPdfReport(title, response.data)`, and one
  `<app-report-viewer [reportData]="reportData">` per screen.
- Uploads: `readFileAsUpload(file)` from `core/api.service.ts` gives `{fileString, fileName, mimeType}`.
- Simple reference data uses `<app-crud-page [config]>` (see `features/admin/banks`). Custom screens
  follow `features/admin/users` (lazy `p-table`, `pageParams(event)`, `p-dialog` form).
- Layout: `<app-page-header>` at the top, `.card` sections, Bootstrap grid `row g-3` / `col-md-*`,
  `.field-label` labels, `.filter-bar` for filters, `<app-stat-tiles>` for summary tiles.
- Plain fields are fine for state (zone change detection is on). Use standalone components with
  `@if` / `@for` templates and `inject()`.
- Each route keeps `data: { permission: '<page key>', title }` (keys in `layout/menu.ts`).
- Build with `scratchpad/build-frontend.sh` (it takes a lock). Errors in another worker's folder
  are not yours; re-run later if they block you.
