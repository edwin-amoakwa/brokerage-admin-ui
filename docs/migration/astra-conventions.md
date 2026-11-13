# Astra ERP conventions guide (REST CRUD backend + Angular client)

Reference repos (read-only research, state as of 2026-11-10):

- Backend: `/Users/edwin/development/projects/stately/astra-erp/astra-be` (abbreviated `BE/` below)
- In-house library source: `/Users/edwin/development/projects/stately/stately-common-jakarta` (abbreviated `LIB/`)
- Main Angular client: `/Users/edwin/development/projects/stately/astra-erp/astra-app` (abbreviated `APP/`)

Line numbers refer to the files as they are on disk today.

---

## 0. Key finding: where the REST API actually lives

**`astra-admin` contains no REST endpoints at all.** It is a JSF / PrimeFaces 15 server-rendered back-office WAR
(131 Java files: `jsf/*Controller`, `services/*`, `oauth/*` servlets; `web.xml` maps only `FacesServlet` to `*.xhtml`).
There is no `@ApplicationPath` and no `@Path` class in it.

| Module | `@Path` classes | Role |
|---|---|---|
| `astra-web` | 358 | **The REST API** (plus a few legacy JSF pages). `@ApplicationPath("api")` |
| `astra-device-gateway` | 2 | Small separate JAX-RS app for attendance devices |
| `astra-admin` | 0 | JSF admin console (company registration, impersonation, sessions) |
| `astra-api-dto` | - | Shared DTO jar (91 classes) |
| `astra-entities` | - | Shared JPA base classes + core entities |
| `astra-common` | - | Shared enums/constants |
| `astra-utilities` | - | One-off utilities |

So "how we typically create CRUD API" = the patterns in **`astra-web/src/main/java/com/statelyhub/breath/api/endpoint/**`**.
What `astra-admin` shares with it is the service/persistence style (`CrudService`, `QryBuilder`, entity base classes).

Written guidelines: **none usable**. `BE/README.md` is the Bitbucket template, `BE/anahata.md` and
`BE/astra-web/anahata.md` are empty stubs, there is no `CLAUDE.md`, `BE/docs` holds feature designs and SQL migrations
only. Everything below is inferred from code.

---

## 1. Tech stack and versions

Backend
- Java 21 source/target (`BE/pom.xml:9-10`, `BE/astra-web/pom.xml`)
- Jakarta EE API 10.0.0, `provided` (`<jakartaee>10.0.0</jakartaee>`), WAR packaging
- App server: Payara Server Full. `BE/astra-web/Dockerfile:2` says `payara/server-full:7.2026.5-jdk25`
  (Payara 7 / JDK 25 at runtime while the POM compiles against EE 10 / Java 21 - see "Could not determine")
- JPA via `persistence.xml` unit `breathPU`, JTA datasource `jdbc/breath`, every entity listed with `<class>`; MySQL (`mysql-connector-j` 8.4.0)
- In-house libs: `com.statelyhub.modules:stately-common-jakarta:1.0` (ApiResponse, QryBuilder, CrudController, Pager, MappingResult, JsonUtils, Jasper helpers) and `com.statelyhub.modules:stately-jsf-jakarta:1.0`
- Other: Gson (response serialisation), JasperReports 7.0.3 + OpenPDF 1.3.32, jxl 2.6.12 (Excel), OmniFaces 4.2, AWS S3 SDK 1.12.528, zxing 3.5.2, googleauth 1.5.0. No Lombok, no MapStruct, no Swagger/OpenAPI (all commented out).
- `astra-admin` only: PrimeFaces 15.0.0, JasperReports 6.17.0.

Angular (`APP/package.json`)
- Angular 20.3.x, TypeScript 5.9, RxJS 7.8, zone.js 0.15
- PrimeNG 20.4 with `@primeuix/themes` (Aura preset), primeicons 7, Bootstrap 5 grid/utility classes
- ngx-toastr 19 (toasts), sweetalert2 11 (confirm dialogs), ng-block-ui / `p-blockUI`, date-fns, xlsx, jspdf, chart.js, underscore
- Sibling apps: `astra-employee` Angular 21.2 / PrimeNG 21.1 (last commit 2026-10-28), `astra-clients-portal` Angular 21.2 / PrimeNG 21.1 (2026-08-22). `astra-app` is the most recently modified (2026-11-09) and by far the largest (858 TS files), so it is the reference.

---

## 2. JAX-RS setup and layout

```java
// BE/astra-web/src/main/java/com/statelyhub/breath/api/AppRestConfigApi.java:18-19
@ApplicationPath("api")
public class AppRestConfigApi extends Application {}
```

No explicit class registration: endpoints and `@Provider`s are discovered by scanning. Deployed context is
`/astra-web`, so URLs are `http://host:8080/astra-web/api/v1/...`.

Package layout under `com.statelyhub.breath`:

```
api/
  AppRestConfigApi.java, CORSFilter.java, ApiServiceHelper.java, ReportHelper.java
  providers/        SecureRequestFilter, PublicEndpoint, ValidationExceptionMapper, GenericExceptionMapper(disabled)
  endpoint/<module>/            XxxEndpoint.java           (account, crm, hr, inventory, sales, payroll, fleet, company, security ...)
  endpoint/<module>/dto/        XxxDto.java, XxxSearchParam.java (module-local DTOs)
  my_endpoints/                 employee self-service API  (v1/my.hr/..., v1/my.auth)
  clientportal/                 client portal API          (v1/clients.portal/...)
services/<module>/  @Stateless business services, XxxDtoService mappers, SearchService
entities/<module>/  JPA entities (most live in astra-web; base classes in astra-entities)
```

Naming
- Class: **`XxxEndpoint`** (356 classes; a handful of typos `XxxEnpoint`, two `XxxController`). Lookup classes are `XxxLookupEndpoint`.
- `@Path`: no leading slash, **`v1/<module>/<plural-kebab-case-resource>`**:
  `v1/crm/ticket-categories`, `v1/hr/config/ranks`, `v1/account/banking/transfers`, `v1/fleet/workshops`.
  Nested resources use path params: `v1/hr/employees/{employeeId}/bank-accounts`, `v1/account/locations/{locationId}/stores`.
  Lookup/reference data: `v1/<module>/data` (e.g. `v1/crm/data`, `v1/account/data`, `v1/hr/data`). Reports: `v1/<module>/reports`.
- Endpoint class is usually a plain CDI-managed JAX-RS class (no annotation); 70 of 356 add `@Stateless`. Dependencies via `@Inject`.
- `@Produces(MediaType.APPLICATION_JSON)` is added inconsistently (per method, per class, or not at all - Payara defaults to JSON).

Verbs (the dominant convention)

| Operation | Verb + path | Response helper |
|---|---|---|
| Create | `POST  v1/x` (body DTO, `dto.setId(null)`) | `ApiResponse.created(dto)` -> 201 |
| Update | `PUT   v1/x` (**no id in path**; id is in the body) | `ApiResponse.updatedResult(ok, dto)` or `ApiResponse.ok(dto)` -> 200 |
| Get one | `GET   v1/x/{id}` | `ApiResponse.findResult(dto)` |
| List/search | `GET   v1/x` (sometimes `GET v1/x/list`) with query params | `ApiResponse.ok(list)` or `ApiResponse.ok(list, pager)` |
| Delete | `DELETE v1/x/{id}` | `ApiResponse.delete(ok)` or `ApiResponse.delete(ok, id)` |
| Action | `PUT/POST v1/x/{id}/approve`, `PUT v1/x/clock-out` | as appropriate |

Save is **POST for create + PUT for update, two separate methods** (241 endpoint files have `@PUT`). The Angular side hides
this behind one `saveXxx(record)` that picks POST vs PUT on `record.id`. A single POST upsert exists only in a few
places (e.g. `FileResourceEndpoint.upload`). `@PATCH` is used once in the whole codebase. The newer fleet module uses
`PUT v1/x/{id}` (id in path) - see section 9.

Search / filter / pagination: **GET with query params bound through `@BeanParam`**, never a POST search body.

```java
// BE/astra-api-dto/src/main/java/com/statelyhub/breath/dto/accounts/DefaultSearchParam.java:20-59 (abridged)
public class DefaultSearchParam extends DefaultHeaders implements Pager.Pageable {
    @QueryParam("keyword")   private String searchKeyword;
    @QueryParam("fromDate")  private LocalDate fromDate;
    @QueryParam("toDate")    private LocalDate toDate;
    @QueryParam("pageSize") @DefaultValue("10")   private int pageSize;
    @QueryParam("pageNo")   @DefaultValue("1")    private int pageNo;      // 1-based
    @QueryParam("paginated") @DefaultValue("true") private String paginated;
    @QueryParam("ignorePagination") private boolean ignorePagination;
    @QueryParam("partnerId") private String partnerId;
    @QueryParam("storeId")   private String storeId;
    @QueryParam("yearMonth") private String yearMonth;   // e.g. 2026-11 / 202611
    ...
    public LocalDateRange getDateRange() { return new LocalDateRange(fromDate, toDate); }
    public Pager getPager() { ... }
```

```java
// BE/astra-api-dto/.../dto/accounts/DefaultHeaders.java:15-30
public class DefaultHeaders {
    @HeaderParam(value = "companyId") private String companyId;
    @HeaderParam(value = "userId")    private String userId;
    @HeaderParam("locationId")        private String locationId;
    @HeaderParam("partnerId")         private String counterpartyId;
    @HeaderParam("employeeId")        private String employeeId;
```

A resource-specific param class extends it: `XxxSearchParam extends DefaultSearchParam` with extra `@QueryParam`
fields (enums bind directly by name) and a `clean()` override that normalises `"null"`/empty strings via
`ApiUtils.getValue(...)` (`BE/astra-web/.../api/endpoint/crm/dto/VisitationSearchParam.java:17-56`).

Date-range convention: query params **`fromDate` / `toDate`**, ISO `yyyy-MM-dd`, bound to `LocalDate` by
`LocalDateParamConverterProvider` in the library (`LIB/src/main/java/com/stately/common/api/converters/`), applied with
`builder.addDateRange(qryParam.getDateRange(), Entity._valueDate)`. Page size 0 or `paginated=false` means "no paging".

---

## 3. Response envelope

Class: `com.stately.common.api.ApiResponse` (`LIB/src/main/java/com/stately/common/api/ApiResponse.java`).

```java
// ApiResponse.java:31-37
private boolean success;
private int statusCode;
private String message;
private Object data;
private Object meta;
private Pager pager;                 // pageSize, totalPages, pageNo, totalRecords
private List<ErrorModel> errors;     // field, message, invalidValue, severity
```

All endpoint methods return `jakarta.ws.rs.core.Response` built by static helpers:

| Helper | HTTP | Notes |
|---|---|---|
| `ok(Object)`, `ok(String message)`, `ok(String, Object)`, `ok()` | 200 | :311-361 |
| `ok(Object data, Pager pager)` | 200 | paged list (:394) |
| `ok(Object data, Object meta, Pager pager)`; fluent `okWith().data(..).meta(..).pager(..).build()` | 200 | :344, :363-392 |
| `created(Object)` | 201 | :303 |
| `info(String message, Object)` | 200 | success with message, used by login (:232) |
| `findResult(Object)` | 200, or **400** "Data not found !!!" when null | :145 |
| `cantFind(String id, Object dto)` | **400** | :130 |
| `updatedResult(boolean)`, `updatedResult(boolean, Object)` | always 200, `success` reflects the flag | :162-188 |
| `delete(boolean)`, `delete(boolean, Object)` | 200 "Deleted" / **400** "Unable to delete, or doesn't exist" | :98-128 |
| `error()`, `error(String)`, `badRequest(String)`, `error(List<ErrorModel>)` | **400** | :224, :271-294 |
| `fail(int status, String message)` | any (401/403/404/409...) | :255, newer code only |
| `internalServerError(String)` | 500 | :263 |
| `sendFile(File)`, `file(File)` | 200 octet-stream + Content-Disposition attachment | :403-428 |

HTTP status usage in practice: 200 / 201 for success, **400 for every business or not-found failure**, 401/403 only
from the auth filter. 404 is not used for missing records. The client keys on `success` and the HTTP status.

Serialisation caveat: most helpers return `apiResponse.toJson()` - a **Gson** string produced by `JsonUtils`
(`LocalDate` -> `yyyy-MM-dd`, `LocalDateTime` -> ISO local date-time, `LocalTime` -> ISO time; custom Double adapter),
while `created(Object)` hands the object to the container (JSON-B). Request bodies are deserialised by the container
(JSON-B). Enums serialise as their constant name in both.

Error handling
- No global catch-all: `GenericExceptionMapper` has `// @Provider` commented out (`BE/astra-web/.../api/providers/GenericExceptionMapper.java:17`).
- `ValidationExceptionMapper` (`@Provider`, `.../providers/ValidationExceptionMapper.java:24-30`) turns
  `ConstraintViolationException` into `ApiResponse.error(List<ErrorModel>)` (400).
- Endpoints guard manually and return `ApiResponse.error("Specify Company")` etc.; many wrap bodies in
  `try/catch` + `e.printStackTrace()` + `return ApiResponse.error(...)`. Logging is `System.out.println`.
- Services report outcomes with `ProcResponse` (`ProcResponse.success(data)` / `ProcResponse.error("msg")`), converted
  by `ResponseMapper.toResponse(procResponse)`.

Validation
- Body params are annotated `@Valid` (121 files) but DTOs carry almost no Bean Validation annotations, so it is
  effectively a no-op. Real validation is **manual inside `toEntity(...)`**, accumulating into `MappingResult<T>`:

```java
// LIB/src/main/java/com/stately/common/data/MappingResult.java
public class MappingResult<T> {
    private T mapping;
    private List<ErrorModel> errorList = new LinkedList<>();
    public boolean hasErrors() ...
    public MappingResult addError(String message) ...
    public MappingResult addUnknown(String message) ...   // "Unknown X Selected"
```

---

## 4. DTO conventions

- Location: two places. Shared DTOs in the `astra-api-dto` module (`com.statelyhub.breath.dto[.accounts|.hr|.app|.fields]`,
  91 classes, including `BaseDto`, `DefaultSearchParam`, `DefaultHeaders`, `LookupItem`). Module-local DTOs (the
  majority, 215+) sit next to the endpoint in `astra-web/.../api/endpoint/<module>/dto/`.
- Naming: `XxxDto` (request and response are the same class), `XxxSearchParam` / `XxxParam` for `@BeanParam` filters.
  The newer fleet code splits into `XxxRequest` (input) and `XxxView` (output).
- Plain POJOs with hand-written getters/setters, no Lombok, no records. Optionally `extends BaseDto`:

```java
// BE/astra-api-dto/src/main/java/com/statelyhub/breath/dto/BaseDto.java (fields)
private String id;
private LocalDateTime createdDate;   private String lastModifiedBy;   private LocalDateTime lastModifiedDate;
private LocalDate valueDate;
private String locationId, locationName, locationCode, storeId, storeName;
private String inputterId, inputter;
private String authoriser, authoriserId;  private LocalDate dateAuthorised;  private boolean authorised;
```

- **Mapping is manual**: two methods `MappingResult<Entity> toEntity(Dto dto, Entity entity)` and `Dto toDto(Entity entity)`.
  - Simple resources: the two methods live as public methods at the bottom of the endpoint class.
  - Larger modules: a shared mapper bean `XxxDtoService` (`AccountDtoService` is `@Named`, others `@Stateless`), e.g.
    `services/accounts/AccountDtoService.java`, `api/endpoint/payroll/PayrollDtoService.java`,
    `api/endpoint/common/WorkflowDtoService.java`, `api/endpoint/inventory/InventoryApiHelperService.java`.
  - `toDto(null)` returns an empty DTO rather than null. `toEntity` receives the target entity (new or loaded) so the
    same method serves create and update.
- IDs: `String` (UUID without dashes, 32 chars).
- Dates: `java.time.LocalDate` / `LocalDateTime` in DTOs and entities; JSON as ISO strings (`"2026-11-10"`, `"2026-11-10T14:03:00"`).
- Enums: the Java enum type directly in the DTO, serialised as the constant name; a sibling `xxxName` string carries
  the label. Enums implement `MessageResolvable` (`getCode()`, `getLabel()`) and `toString()` returns the label.
- Nested references: **flattened `xxxId` + `xxxName` pairs**, not nested objects:

```java
// BE/astra-api-dto/src/main/java/com/statelyhub/breath/dto/accounts/BankTransferDto.java:19-37
public class BankTransferDto extends BaseDto{
    private String receiptNo;
    private String fromAccountId;   private String fromAccountName;
    private String toAccountId;     private String toAccountName;
    private String memo;
    private double amount;
    private String partnerId;       private String partnerName;
    private EntrySource entrySource;            private String entrySourceName;
    private CurrencyEnum transactionCurrency;   private String transactionCurrencySymbol;
```

  On input only the `xxxId` is read and resolved with `crudService.find(...)`; unresolved -> `mappingResult.addError("Specify ...")`.
- Money is `double` throughout (not `BigDecimal`).

---

## 5. Persistence access

Library: **`com.statelyhub.modules:stately-common-jakarta:1.0`** (package `com.stately.common.jpa`):
`CrudController`, `QryBuilder`, `Paginator`, `PageSearch`, `EntityModel`, `UniqueEntityModel`, `DateRecord`.

`CrudService` is the application's `@Stateless` subclass that injects the container `EntityManager`:

```java
// BE/astra-web/src/main/java/com/statelyhub/breath/services/CrudService.java:38-50
@Stateless
public class CrudService extends CrudController {
    @PersistenceContext private EntityManager em;
    @PostConstruct
    private void init() { setEm(em); setEnviroment(Enviroment.JAVA_EE); }
```

Core calls (signatures in `LIB/.../jpa/CrudController.java`): `find(Class, id)`, `save(entity)` (assigns id when null,
sets created/lastModified, persist-or-merge; returns the entity or `null` on failure), `update(entity)` -> boolean,
`delete(Class, String id)` -> boolean (**hard delete** via `em.remove`), `delete(model, permanent=false)` (soft delete,
sets `deleted=true`), `generateId()`, `getEm()`, `findAll`, `count`, `deleteAll(Class, field, value)`.

Typical query code - a fluent builder that generates JPQL (root alias `e`), using the entity's `public static final String _field` constants:

```java
// BE/astra-web/.../api/endpoint/hr/config/RankEndpoint.java:122-126
List<Rank> itemsList = QryBuilder.get(crudService.getEm(), Rank.class)
        .addObjectParam(Rank._company, company)
        .buildQry()
        .getResultList();
```

```java
// BE/astra-web/src/main/java/com/statelyhub/breath/services/SearchService.java:2095-2119
public QryBuilder wrapBankTransfer(BankTransactionHistorySearchParam qryParam) {
    qryParam.clean();
    EntrySource entrySource = EntrySource.resolve(qryParam.getEntrySource());
    QryBuilder builder = QryBuilder.get(crudService.getEm(), BankTransfer.class);
    builder.addObjectParam(BankTransfer._company_id, qryParam.getCompanyId());
    builder.addObjectParam(BankTransfer._location_id, qryParam.getLocationId());
    builder.addObjectParamWhenNotNull(BankTransfer._entrySource, entrySource);
    builder.addObjectParamWhenNotNull(BankTransfer._counterparty_id, qryParam.getPartnerId());
    ...
    builder.addDateRange(qryParam.getDateRange(), BankTransfer._valueDate);
    builder.orderByDesc(BankTransfer._valueDate);
    builder.orderByDesc(BankTransfer._createdDate);
    return builder;
}
```

Other builder methods: `addStringQryParam(field, value, ComparismCriteria.LIKE)`, `addInParam`, `addNotInParam`,
`addNumberParam`, `addDateParam`, `addRawParam(jpqlFragment)`, `addGroupBy`, `addReturnField`, `orderByAsc/Desc`,
`getSingleResult(Class)`, `count()`, `getResultAsDouble()`, `delete()`.

Pagination pattern - one `wrapXxx(param)` builder method, reused for the page and the count:

```java
// SearchService.java:3090-3093 and 3815-3819
public List searchBankTransfer(BankTransactionHistorySearchParam qryParam) {
    QryBuilder builder = wrapBankTransfer(qryParam);
    return searchService.search(builder, qryParam.getPager(), qryParam.isIgnorePagination());
}
public Pager bankTransferPager(BankTransactionHistorySearchParam qryParam) {
    QryBuilder builder = wrapBankTransfer(qryParam);
    return paginator.createPage(builder, qryParam.getPager());
}
```

Transactions: container-managed JTA through EJBs. `CrudService` and business services are `@Stateless`, so each
`crudService.save(...)` call from a non-EJB endpoint is its own transaction; multi-step atomic work is put in a
`@Stateless` service method (or the endpoint itself is made `@Stateless`). No `@Transactional` anywhere.

Entity base classes

```
com.stately.common.jpa.EntityModel        createdDate, lastModifiedDate, lastModifiedBy, updated, deleted (boolean), @PrePersist/@PreUpdate
  └─ UniqueEntityModel                    @Id String id  (column "id")
       ├─ CompanyRecord                   @ManyToOne Company company          (BE/astra-entities/.../entities/CompanyRecord.java:19-29)
       ├─ CompanyIdRecord                 String companyId (column "company")
       └─ DateRecord                      LocalDate valueDate
            └─ CompanyIdDatedRecord       companyId, inputterId, inputter, modifierId   (audit by user)
       CompanyDatedRecord / CompanyAuthDatedRecord (company + valueDate + inputter + authoriser fields), LocationRecord, PartnerRecord ...
```

Entity style: `@Entity @Table(name = "snake_case")`, explicit `@Column(name = "snake_case")` on every field,
`@Enumerated(EnumType.STRING)`, `@ManyToOne @JoinColumn(name = "...")`, and a `public static final String _fieldName = "fieldName";`
constant per queryable field (dot paths for joins, e.g. `_company_id = _company + "." + Company._id`). New entities must
be added to `persistence.xml`. Schema changes are hand-written SQL under `BE/docs/migrations`.

Soft delete: the `deleted` flag exists on every entity, but the standard CRUD path (`crudService.delete(Class, id)`) is a
hard delete; a `DeletedRecord` entity + `v1/deleted-records` endpoint keeps an audit trail for some transactional records.

Audit stamping: `crudService.tagUser(entity, headers)` copies `userId` / `user` request headers into
`inputterId` / `inputter` / `modifierId` / `lastModifiedBy` (`CrudService.java:121-147`).

---

## 6. Worked examples

### 6a. Minimal master-data CRUD (copy this for simple resources)

`BE/astra-web/src/main/java/com/statelyhub/breath/api/endpoint/crm/TicketCategoryEndpoint.java` (156 lines, whole file is the pattern)

```java
@Path("v1/crm/ticket-categories")                                   // :34
public class TicketCategoryEndpoint {
  @Inject private CrudService crudService;
  @Inject private ApiServiceHelper apiServiceHelper;

  @POST                                                              // :41-71
  public Response create(@HeaderParam(value = "companyId") String companyId, @Valid TicketCategoryDto dto) {
    if (dto == null) return ApiResponse.badRequest("Unable to process. Please try again");
    dto.setId(null);
    Company company = apiServiceHelper.getCompany(companyId);
    if (company == null) return ApiResponse.badRequest("Unable to process. Please try again");
    MappingResult<TicketCategory> mappingResult = toEntity(dto, new TicketCategory());
    if (mappingResult.hasErrors()) return ApiResponse.error(mappingResult.getErrorList());
    TicketCategory entity = mappingResult.getMapping();
    entity.setCompany(company);
    TicketCategory savedItem = crudService.save(entity);
    return ApiResponse.created(toDto(savedItem));
  }

  @PUT                                                               // :73-91
  public Response update(@Valid TicketCategoryDto itemDto) {
    TicketCategory existing = crudService.find(TicketCategory.class, itemDto.getId());
    if (existing == null) return ApiResponse.cantFind(itemDto.getId(), itemDto);
    MappingResult<TicketCategory> mappingResult = toEntity(itemDto, existing);
    if (mappingResult.hasErrors()) return ApiResponse.error(mappingResult.getErrorList());
    boolean updated = crudService.update(mappingResult.getMapping());
    return ApiResponse.updatedResult(updated, toDto(mappingResult.getMapping()));
  }

  @GET @Path("/{categoryId}")                                        // :93-98
  public Response getById(@PathParam(value = "categoryId") String id) {
    return ApiResponse.findResult(toDto(crudService.find(TicketCategory.class, id)));
  }

  @GET                                                               // :100-117
  public Response list(@HeaderParam(value = "companyId") String companyId) {
    List<TicketCategory> entitesList = QryBuilder.get(crudService.getEm(), TicketCategory.class)
            .addObjectParam(TicketCategory._company, apiServiceHelper.getCompany(companyId))
            .buildQry().getResultList();
    ... dtoList.add(toDto(item)) ...
    return ApiResponse.ok(dtoList);
  }

  @DELETE @Path("/{categoryId}")                                     // :119-124
  public Response deleteById(@PathParam(value = "categoryId") String id) {
    return ApiResponse.delete(crudService.delete(TicketCategory.class, id));
  }

  public MappingResult toEntity(TicketCategoryDto dto, TicketCategory entity) { ... }   // :126-140
  public TicketCategoryDto toDto(TicketCategory entity) { ... }                         // :142-155
}
```

DTO: `.../api/endpoint/crm/dto/TicketCategoryDto.java` (`id`, `categoryName`, `categoryCode`).
Near-identical twin: `.../api/endpoint/hr/config/RankEndpoint.java` (`v1/hr/config/ranks`, checks company on every method).
(The abridged listing above compresses guard clauses onto one line; the real file uses braces and blank lines.)

### 6b. Full transactional resource end to end: Bank Transfer

1. **Entity** `BE/astra-web/src/main/java/com/statelyhub/breath/entities/accounts/BankTransfer.java:32-108`
   `@Entity @Table(name = "bank_transfer") class BankTransfer extends CompanyAuthDatedRecord` with
   `@ManyToOne Location location`, `Account bankAccountFrom/bankAccountTo`, `Counterparty counterparty`,
   `@Enumerated(EnumType.STRING) EntrySource entrySource`, `CurrencyEnum transactionCurrency`, `double amount`,
   plus `_location_id`, `_bankAccountFrom_id`, `_entrySource` ... path constants.
2. **DTO** `BE/astra-api-dto/src/main/java/com/statelyhub/breath/dto/accounts/BankTransferDto.java:19` (`extends BaseDto`, id+name pairs, enum + label).
3. **Mapper** `BE/astra-web/src/main/java/com/statelyhub/breath/services/accounts/AccountDtoService.java`
   - `toEntity(BankTransferDto, BankTransfer)` :1147-1260 - copies scalars, validates (`return mappingResult.addError("Specify Transaction Date")`),
     resolves `fromAccountId` / `toAccountId` / `partnerId` with `crudService.find`, defaults currency and memo.
   - `toDto(BankTransfer)` :1262-1320 - null-safe, fills `fromAccountId` + `fromAccountName`, `entrySource` + `entrySourceName`,
     `locationId` + `locationName`, audit fields.
4. **Search param** `BankTransactionHistorySearchParam extends DefaultSearchParam` (astra-api-dto, `dto/accounts`).
5. **Services**
   - `services/accounts/BankTransferService.java:29,44` `@Stateless`, `ProcResponse saveTransfer(BankTransfer, UserAccount)` - business rules, ledger posting, one transaction.
   - `services/SearchService.java:2095` `wrapBankTransfer`, `:3090` `searchBankTransfer`, `:3815` `bankTransferPager`.
6. **Endpoint** `BE/astra-web/src/main/java/com/statelyhub/breath/api/endpoint/account/banking/BankTransferEndpoint.java`

```java
@Path("v1/account/banking/transfers")                                // :51
public class BankTransferEndpoint {

    @POST                                                            // :66-125
    public Response create(@HeaderParam(value = "companyId") String companyId,
                           @HeaderParam(value = "locationId") String locationId,
                           @HeaderParam(value = "userId") String userId,
                           @Valid BankTransferDto dto) {
        Company company = apiServiceHelper.getCompany(companyId);
        if (company == null) { return ApiResponse.error("Specify Company"); }
        Location location = QryBuilder.get(crudService.getEm(), Location.class)
                .addObjectParam(Location._company, company)
                .addObjectParam(Location._id, locationId)
                .getSingleResult(Location.class);
        if (location == null) { return ApiResponse.error("Specify Location"); }
        UserCompany userCompany = ...;                               // user must belong to the company
        if (userCompany == null) { return ApiResponse.error("Specify Valid User"); }

        dto.setId(null);
        BankTransfer bankTransfer = new BankTransfer();
        bankTransfer.setCompany(company);
        bankTransfer.setLocation(location);
        MappingResult<BankTransfer> mappingResult = accountDtoService.toEntity(dto, bankTransfer);
        if (mappingResult.hasErrors()) { return ApiResponse.error(mappingResult.getErrorList()); }

        ProcResponse response = bankTransferService.saveTransfer(mappingResult.getMapping(), userAccount);
        if (response.isSuccess()) {
            return ApiResponse.created(accountDtoService.toDto((BankTransfer) response.getData()));
        }
        return ResponseMapper.toResponse(response);
    }

    @PUT                      // :127-189  same guards; loads by company+location+id; ApiResponse.ok(toDto(entity))
    @GET @Path("/{id}")       // :191-196  ApiResponse.findResult(accountDtoService.toDto(existing))

    @GET @Path("/list")                                              // :198-216
    public Response getBankTransfersList(@BeanParam BankTransactionHistorySearchParam qryParam) {
        Company company = apiServiceHelper.getCompany(qryParam.getCompanyId());
        if (company == null) { return ApiResponse.error("Specify Company"); }
        List<BankTransferDto> dtoList = new LinkedList<>();
        for (BankTransfer item : searchService.searchBankTransfer(qryParam)) {
            dtoList.add(accountDtoService.toDto(item));
        }
        Pager pager = searchService.bankTransferPager(qryParam);
        return ApiResponse.ok(dtoList, pager);
    }

    @DELETE @Path("/{id}")    // :218-235  ApiResponse.delete(true|false, id)
    @GET @Path("/{id}/receipt") // :237-264  reportHelper.inlinePdfReport(company, location, reportData)  -> base64 PDF in data
}
```

A second good paged example with enum filters and LIKE search:
`.../api/endpoint/crm/VisitationEndpoint.java:136-165` + `.../services/CrmSearchService.java:32-80`.

---

## 7. Authentication, authorisation, tenancy, CORS

Not JWT. **Opaque bearer tokens backed by a DB session** (`AuthSession` entity; tokens generated/hashed by
`com.stately.common.security.TokenUtil`).

- Login: `POST api/v1/auth/login` body `{ emailAddress, userPassword, rememberMe }`
  (`.../api/endpoint/security/AuthServiceEndpoint.java:60-100`) -> `ApiResponse.info("Login Successful", loginResponse)`;
  `LoginTokenIssuer.attach(...)` adds the token pair. Related: `send-otp`, `verify-otp`, `verify-auth`, `reset-password`, `unlock-screen`.
- Session lifecycle: `v1/session/refresh` (body `{refreshToken}` -> `{accessToken, refreshToken}`, rotating),
  `logout`, `logout-all`, `switch-company`, `change-password`, `impersonation/redeem`, `embed-token`
  (`.../security/SessionEndpoint.java:36-323`).
- Lifetimes (`.../services/company/AuthSessionService.java:39-78`): access token 30 min, idle timeout 30 min, refresh 12 h
  (30 days with remember-me), refresh replay grace 60 s.
- Filter: `SecureRequestFilter` (`@Provider ContainerRequestFilter`, post-matching;
  `.../api/providers/SecureRequestFilter.java:48-251`). Everything is authenticated unless:
  - the method/class carries `@PublicEndpoint(reason = "...")` (preferred; `.../providers/PublicEndpoint.java`), or
  - the path is in `PUBLIC_PATHS` / starts with `v1/noauth/` or `clientportal/noauth/`, or
  - it is an `OPTIONS` preflight.
  It reads `Authorization: Bearer <token>` (or `X-Api-Key` for integrations), rejects with a JSON body
  `{success:false, statusCode, message}` and 401/403, verifies the caller may act in the `companyId` header
  (falls back to the session's company), blocks writes on read-only impersonation sessions, and populates the
  `@RequestScoped AuthContext` (`.../services/company/AuthContext.java`: `getSession()`, `getCompanyId()`,
  `getSubjectId()`, `getSubjectType()`, `isImpersonated()`, `isReadOnly()`).
  Note the documented TEMPORARY bypass: header `agent-type: mobile` skips authentication unless system property
  `astra.security.mobile-bypass=false` (:158-177) - do not copy this.
- **Headers** sent by clients and read by endpoints: `Authorization`, `companyId` (tenant), `locationId` (branch/warehouse),
  `userId`, `user` (display name), `employeeId`, `partnerId`, `agent-type`.
- Identity inside endpoints: the long-standing convention is `@HeaderParam("companyId")` / `@HeaderParam("userId")`
  (302 files) or `@BeanParam` with `DefaultHeaders`. `AuthContext` injection is the newer, safer way and is used in
  only 16 files so far (e.g. `.../endpoint/hr/config/AnnouncementEndpoint.java:76-79`). `companyId` is validated by the
  filter; `userId` and `locationId` headers are not, which is why endpoints re-check `UserCompany` / `Location` membership.
- Multi-tenancy: every query is filtered by company (`Entity._company` or `_companyId`), and by location where relevant.
- Role/permission checks on endpoints: **no declarative mechanism**. `@Permission` (`.../api/annotation/Permission.java`)
  is an empty, unused annotation; no `@RolesAllowed`. Page/action permissions are stored per user
  (`v1/user-page-action`, `v1/pageaction`) and enforced mainly in the Angular UI; a few newer endpoints call a service
  explicitly (`accessService.hasAction(PAGE, ACTION)` in `.../hr/recruitment/InterviewEndpoint.java:43`).
- CORS: `CORSFilter` (`@Provider ContainerResponseFilter`, `.../api/CORSFilter.java:17-32`): `Access-Control-Allow-Origin: *`,
  allowed headers `origin, content-type, accept, authorization, x-frame-options, companyId, userId, user, locationId,
  employeeId, partnerid, agent-type, application, X-Seeker-Token, X-Api-Key`, methods `GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH`.
  Any new custom header must be added here.

---

## 8. Lookups, files, reports

Lookups / enums for dropdowns
- One `XxxLookupEndpoint` per module at `v1/<module>/data`, one `GET /<kebab-name>` per list
  (`.../api/endpoint/crm/CrmLookupEndpoint.java:41-110`):

```java
@GET @Path("/priority")
public Response getPriority() { return ApiResponse.ok(LookupItem.setup(Priority.values())); }
```

- Shape is `LookupItem { id, itemName, item }` (`BE/astra-api-dto/.../dto/accounts/LookupItem.java:16-110`):
  `setup(Enum...)` -> `id = name()`, `itemName = toString()` (label); `setupList(List<UniqueEntityModel>)` -> `id`, `toString()`.
  The Angular dropdowns bind `optionValue="id" optionLabel="itemName"`.
- Entity-backed dropdowns usually just call the resource's normal list endpoint.

File upload / download
- **No multipart anywhere.** Files travel as **base64 inside JSON**: DTO has a `FileUploadDto fileUpload`
  (`LIB/.../model/FileUploadDto.java`: `id`, `fileString` (data URL/base64), `fileName`, `mimeType`, `extension`; `createFile()`).
- Generic attachment API `v1/files` (`.../api/endpoint/others/FileResourceEndpoint.java:44-178`): `POST` upserts a `FileResource`
  linked by `relatedEntityId` + `entityType`, stored under `<companyId>/<folder>/<fileNameOnDisk>`; `GET /entity/{id}`, `DELETE /{id}`.
- Bulk imports are `XxxUploadEndpoint` classes (`v1/.../upload`) taking an `UploadDto` with the base64 Excel file.
- Downloads: `ApiResponse.sendFile(File)` / `ApiResponse.file(File)` (octet-stream attachment), or base64 in `data`.

Reports
- `v1/<module>/reports/<kebab-report-name>`, `GET` with `@BeanParam XxxReportFilterParam` (dates, `locationId`,
  `reportFormat`) - `.../api/endpoint/account/reports/AccountReportsEndpoint.java:118-160`.
- PDF: JasperReports `ReportData` -> `reportHelper.inlinePdfReport(company, location, reportData)` which returns
  **`ApiResponse.ok(<base64 PDF string>)`** (`.../api/ReportHelper.java:79-104`); the client renders
  `data:application/pdf;base64,...`. A raw-bytes variant `inlinePdfReportBytesResponse` exists (:107-116) but is the exception.
- Excel: same endpoint with `reportFormat=excel` branches to an export method; some lists are exported client-side with `xlsx`.
- Per-record prints follow `GET v1/x/{id}/receipt` (BankTransferEndpoint :237).

---

## 9. Two generations of style

- **Classic (dominant, ~300 endpoints, 2023 onwards)**: everything in section 6. This is "how we typically create CRUD".
- **Newer thin-endpoint style (fleet module, Oct 2026)**: `@Stateless` endpoint with class-level `@Produces/@Consumes`,
  one-line methods delegating to a `@Stateless` service, `XxxRequest` / `XxxView` DTOs, `PUT /{id}`, business failures
  thrown as `IllegalStateException` and translated to `ApiResponse.error(message)` by a small helper
  (`.../api/endpoint/fleet/hub/FleetWorkshopsEndpoint.java:21-57`, `.../fleet/hub/HubCall.java:19-74`).
  Same envelope, same headers, same `v1/<module>/<plural>` paths.

---

## 10. Angular conventions (astra-app)

Bootstrapping (`APP/src/app/app.config.ts:30-77`): standalone app, `provideRouter(routes)`,
`provideHttpClient(withInterceptorsFromDi())` + `{ provide: HTTP_INTERCEPTORS, useClass: RequestInterceptor, multi: true }`,
`providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } }, overlayAppendTo: 'body' })`,
`importProvidersFrom([AppCommonModule, CoreModule, AppStandaloneModule])`, service worker in production.

Environment / proxy
- `APP/src/environments/environment.ts`: `baseApi: "http://localhost:8080/astra-web/api/v1"` (absolute URL, CORS) - every
  service call is `` `${environment.baseApi}/<module>/<resource>` ``.
- `npm start` = `ng serve --port 4300 --host 0.0.0.0 --proxy-config localhost.json`; `localhost.json` proxies `/api/**`
  to `http://localhost:8080/astra-web` (only used if `baseApi` is switched to the relative `'api/v1'`).

Envelope and paging types
- `APP/src/app/core/ApiResponse.ts:1-9`: `class ApiResponse<T> { success; data: T; pager?; meta?; severity?; message; statusCode }`.
- `APP/src/app/core/pager.ts`: `class Pager { pageNo = 1; pageSize = 10; totalRecords = 0 }` and
  `Pager.createPagerNg(event)` converting a PrimeNG lazy-load event to `{ pageNo: first/rows + 1, pageSize: rows }`.
- `APP/src/app/core/HttpUtils.ts:8-19`: `HttpUtils.toUrlParam(obj)` drops null/undefined/'null' and builds the query string.

HTTP interceptor (`APP/src/app/core/request-interceptor.ts`)
- Adds headers (:269-306): `Authorization: Bearer <accessToken>`, `companyId`, `locationId`, `userId`, `user`, `employeeId`, `agent-type: web`
  (values from `localStorage` via `SessionKeys`).
- **Success toasts are automatic** (:153-170): 201 -> "Data Saved successfully"; 200 + PUT -> "Record updated successfully.";
  200 + DELETE -> "Data deleted successfully."; 200 + POST -> `body.message` if present.
- **Error toasts are automatic** (:187-243): shows `error.error.errors[].message` or `error.error.message` via ngx-toastr;
  403 -> message; 401 -> single-flight token refresh (`v1/session/refresh`, cross-tab lock) then replay, else logout.
  It rethrows `error.error`, so components wrap calls in `try { } catch { } finally { }` with an empty catch.
- Consequence: feature components almost never raise save/delete toasts themselves.

Toasts / confirms
- `NotificationService` (`APP/src/app/core/notification.service.ts`) wraps **ngx-toastr** (`success`, `error`, `warning`, `info`) - 227 files.
- Confirmations use **sweetalert2** through `MessageBox` (`APP/src/app/shared/message-helper.ts:37-97`):
  `const confirm = await MessageBox.deleteConfirm(); if (!confirm.value) return;` (77 files).
  PrimeNG `ConfirmationService` / `MessageService` are effectively not used.

Auth / guard / permissions
- `UserSession` (`APP/src/app/auth/user-session.ts`) keeps tokens, user, company, location and page actions in `localStorage`.
- `RouteGuard` (`APP/src/app/route-guard.service.ts:11-70`), class-based `CanActivate` applied on each layout route in
  `APP/src/app/app.routes.ts`; redirects to `/auth/login`, forces change-password when pending.
- UI permission checks: `showActionBasedOnPermission = UserSession.showActionBasedOnPermission;` then
  `*ngIf="showActionBasedOnPermission('cashTransactions','delete')"` (`user-session.ts:657-672`).

Routing: per-module route files with lazy standalone components, e.g. `APP/src/app/account/account.routes.ts:46`
`{ path: 'bank-transfer', loadComponent: () => import('./bank-transfer/bank-transfer.component').then(m => m.BankTransferComponent) }`,
mounted under a module layout component (`layouts/account-layout`, `hr-layout`, ...) with `loadChildren`.

Feature structure (typical CRUD)

```
src/app/<module>/
  <module>.routes.ts
  services/<feature>.service.ts        @Injectable({providedIn:'root'}), HttpClient, async methods returning Promise<ApiResponse<any>>
  dto/<module>.dto.ts                  loose classes; most code uses `any`
  <feature>/<feature>.component.{ts,html,scss}   ONE standalone component = filter form + p-table list + p-dialog form
```

Service (`APP/src/app/account/services/bank-transfer.service.ts:9-42`)

```ts
public async getBankTransferList(searchParam) {
  let params = new URLSearchParams(searchParam).toString()
  return await this.http.get<ApiResponse<any>>(`${environment.baseApi}/account/banking/transfers/list?${params}`).toPromise();
}
public async saveBankTransfer(record:any) {
  if(!record.id) { return await this.http.post<ApiResponse<any>>(`${environment.baseApi}/account/banking/transfers`, record).toPromise(); }
  else           { return await this.http.put<ApiResponse<any>>(`${environment.baseApi}/account/banking/transfers`, record).toPromise(); }
}
public async deleteBankTransfer(transferId:string) {
  return await this.http.delete<ApiResponse<any>>(`${environment.baseApi}/account/banking/transfers/${transferId}`).toPromise();
}
```

`async/await` + `.toPromise()` is the norm (137 files; `firstValueFrom` in 10). Generic helpers exist but are rarely used:
`APP/src/app/services/crud.service.ts` (`save(url, record)`, `delete(url, id)`) and `APP/src/app/base.service.ts`.

Component (`APP/src/app/account/bank-transfer/bank-transfer.component.ts`)

```ts
@Component({ selector: 'app-bank-transfer', templateUrl: ..., standalone: true,
  imports: [CoreModule, AppCommonModule, LocationSelectorComponent, AddNewButtonComponent, ReportViewerComponent] })   // :20-26
export class BankTransferComponent implements OnInit {
  showActionBasedOnPermission = UserSession.showActionBasedOnPermission;   // :31
  formView: FormView = FormView.listView();                                // :42
  bankTransfersList: any[];  searchParam:any = {};  pager:Pager = new Pager();
  showBankTransferForm = false;  blockedPage:boolean;

  lazyLoadRecords(event: TableLazyLoadEvent) {                             // :196-206
    if(!event) { return; }
    this.searchParam = Pager.createPagerNg(event);
    this.reloadRecords();
  }
  public async reloadRecords() {                                           // :208-227
    this.searchParam.fromDate = this.recordsFilterForm.controls.dateFrom.value;
    this.searchParam.toDate   = this.recordsFilterForm.controls.dateTo.value;
    try {
      this.blockedPage = true;
      const result = await this.bankTransferService.getBankTransferList(this.searchParam);
      this.bankTransfersList = result.data;
      this.pager = result.pager;
    } catch (error) {} finally { this.blockedPage = false; }
  }
  public async saveBankTransfer() {                                        // :127-152
    ... const response = await this.bankTransferService.saveBankTransfer(responseObj);
    if(response.success) { this.showBankTransferForm = false; CollectionUtil.add(this.bankTransfersList, response.data); }
  }
  editBankTransfer(rec) { this.bankTransferForm.reset(); this.bankTransferForm.patchValue(rec); this.showBankTransferForm = true; }   // :171-183
  public async deleteBankTransfer(rec) {                                   // :234-249
    const confirm = await MessageBox.deleteConfirm();
    if (!confirm.value) return;
    const result = await this.bankTransferService.deleteBankTransfer(rec.id);
    if(result.success) { CollectionUtil.remove(this.bankTransfersList, result.data); }
  }
  initForm() { this.bankTransferForm = this.fb.group({ id: null, valueDate: null, entrySource: null, ... amount: 0 }); }   // :317-332
}
```

- Reactive forms with `FormBuilder` / `UntypedFormBuilder`, `fb.group({ id: null, ... })`, `patchValue(record)` to edit,
  the form value is posted as-is (id decides POST vs PUT). `Validators` used sparingly; the server is the validator.
- `CollectionUtil.add(list, item)` / `CollectionUtil.remove(list, idOrItem)` (`APP/src/app/core/system.utils.ts`) update the
  list in place after save/delete instead of refetching.
- `FormView` (`APP/src/app/core/form-view.ts`) toggles list / create / detail panes for full-page forms (97 files);
  `p-dialog` with a boolean flag is used for small forms (192 templates).
- Constructor injection is the norm; `inject()` appears in newer code (116 files). Signals are not used. Templates mix
  `*ngIf` (218) and `@if` (189).

Template (`APP/src/app/account/bank-transfer/bank-transfer.component.html`)

```html
<p-blockUI [blocked]="blockedPage"><p-progress-spinner ariaLabel="loading" id="blockIcon" /></p-blockUI>          <!-- :1-3 -->
<app-page-header title="..." description="...">                                                                  <!-- :7-12 -->
  <div location-selector><app-location-selector (emitter)="onLocationSelected($event)"></app-location-selector></div>
</app-page-header>
<form class="row" [formGroup]="recordsFilterForm" (ngSubmit)="reloadRecords()">                                   <!-- :24-80 -->
  <p-select formControlName="entrySource" [options]="entrySourcesList" optionLabel="itemName" optionValue="id" [showClear]="true"></p-select>
  <input type="date" formControlName="dateFrom" pInputText>  <input type="date" formControlName="dateTo" pInputText>
  <button pButton class="p-button-sm p-button-info btn-sm" label="Reload"></button>
  <add-new-button (click)="addNewBankTransfer()" label="Add New"></add-new-button>
</form>
<p-table #bankTransfersTable class="p-datatable-striped p-datatable-sm" [value]="bankTransfersList"              <!-- :86-92 -->
         [paginator]="true" [lazy]="true" [rows]="pager.pageSize" [totalRecords]="pager.totalRecords"
         (onLazyLoad)="lazyLoadRecords($event)" [showCurrentPageReport]="true"
         currentPageReportTemplate="Showing {first} to {last} of {totalRecords} entries"
         [rowsPerPageOptions]="[10,25,50,150,500]" dataKey="id">
  <ng-template #header> ... </ng-template>
  <ng-template #body let-transfer>
    <td>{{transfer?.valueDate | date:'dd/MM/yyyy'}}</td> <td>{{transfer?.amount | number : '1.2-8'}}</td>
    <button pButton icon="pi pi-pencil" class="p-button-sm p-button-primary mx-1 mb-1" (click)="editBankTransfer(transfer)"></button>
    <button pButton icon="pi pi-trash" class="p-button-sm p-button-danger mx-1 mb-1"
            *ngIf="showActionBasedOnPermission('cashTransactions','delete')" (click)="deleteBankTransfer(transfer)"></button>
  </ng-template>
</p-table>
<p-dialog header="Cash Transactions" [(visible)]="showBankTransferForm" [style]="{width: '50vw'}" [modal]="true">   <!-- :197-316 -->
  <form [formGroup]="bankTransferForm" (ngSubmit)="saveBankTransfer()">
    <div class="row g-3"> <div class="col-md-6"> <label class="form-label field-label">...</label> <p-select .../> </div> ... </div>
    <button pButton class="p-button-sm p-button-success btn-sm" label="Save" icon="pi pi-check-circle"></button>
  </form>
</p-dialog>
<app-report-viewer [reportData]="reportData"></app-report-viewer>                                                  <!-- :330 -->
```

- Layout: Bootstrap grid (`row`, `col-md-6`, `g-3`, `card shadow-sm p-3`) + PrimeNG widgets; label classes
  `field-label`, `field-label-required`, `field-value`. Dates are native `<input type="date">` posting `yyyy-MM-dd`
  (PrimeNG datepicker in only ~20 templates). Display format `dd/MM/yyyy`.
- PrimeNG 20 template syntax: `<ng-template #header>`, `#body`, `#caption`, `#expandedrow`.

Shared building blocks
- `CoreModule` (`APP/src/app/core/core.module.ts`) re-exports CommonModule, Forms/ReactiveForms and ~40 PrimeNG modules +
  pipes; `AppCommonModule` (`APP/src/app/shared/app.common.module.ts`) re-exports shared business components. Standalone
  components import `[CoreModule, AppCommonModule, ...]`.
- `app-page-header` (`title`, `description`, `icon`, `location-selector` slot), `add-new-button`, `app-location-selector`,
  `partner-dropdown` (ControlValueAccessor), `app-report-viewer` + `ReportData.showPdfReport(title, base64)`
  (`APP/src/app/core/report-data.ts:11-21`), `app-file-uploader` (`relatedEntityId`, `relatedEntityType`; reads the file
  with `FileReader.readAsDataURL` and posts `{ fileUpload: { fileName, fileString } }` to `files`), `export-excel-button`,
  `date-range-selector`.
- Static dropdown data: `StaticDataService` static methods returning `[{ id: 'ENUM_NAME', itemName: 'Label' }]`
  (`APP/src/app/static-data.service.ts:570-576`); server lookups via per-module lookup services hitting `v1/<module>/data/...`.
- **Config-driven generic CRUD for simple master data**: `APP/src/app/setting/lookup.service.ts` holds
  `{ label, name, api: "crm/ticket-categories", fields: [{ label, name, type: InputType.Text }] }` entries (:117-124, :298-305)
  rendered by `APP/src/app/setting/generic-lookup/generic-lookup.component.ts` (table + `p-dialog` form + `MessageBox.confirm`).
  A new simple backend CRUD normally needs only a new entry here, no new component.

---

## 11. Could not determine / caveats

- **Exact runtime versions**: the Dockerfile targets Payara 7.2026.5 on JDK 25, but POMs compile for Java 21 against
  Jakarta EE 10.0.0. Which Payara version developers/prod actually run was not verifiable from the repo.
- `stately-common-jakarta` has no version history: it is always `1.0`, installed to the local `~/.m2` from
  `/Users/edwin/development/projects/stately/stately-common-jakarta` (no remote repository coordinates found).
- The generic `search(builder, pager, ignorePagination)` implementation behind `SearchService.searchService` was not opened;
  only its call sites were read.
- How JSON request bodies are bound (JSON-B defaults assumed; no custom `MessageBodyReader`/`ContextResolver` found in
  `api/providers`). Enum/date binding for bodies was inferred from DTO types, not from a running server.
- `LoginResponse` field list and exactly where the token pair sits in the login payload were not read in detail.
- No written coding standard exists; all rules above are observed frequency, and the codebase is inconsistent in places
  (trailing `/list` vs bare collection GET, `@Produces` placement, `@Stateless` on endpoints, company as entity vs `companyId` string).
- Things present in the reference that a new project may not want to copy: 400 for not-found, header-supplied
  `userId` trusted for audit, `agent-type: mobile` auth bypass, `Access-Control-Allow-Origin: *`, `double` for money,
  string-concatenated JPQL in `addRawParam`, `System.out.println` logging, swallowed exceptions in mappers.
