# brokerage-admin-ui

Back-office console for the Laurus Africa prime brokerage platform. It replaces the JSF pages in
`brokerage/brokerage-admin` and talks to the admin REST API (`/api/v1/admin/...`) in the same WAR.

- Angular 21.2, PrimeNG 21.1.10 (MIT; Aura preset in the Laurus palette), Bootstrap 5 grid
- Standalone components, lazy feature routes, zone change detection
- Opaque bearer-token sessions (`v1/admin/auth`), page permissions per role

## Run locally

```bash
npm install
npm start            # http://localhost:5002, proxies /api to http://localhost:8080/brokerage-admin
```

Change the proxy target in `proxy.conf.json` if the backend runs elsewhere. Sign in with a
back-office user from the `user_accounts` table (the same users as the JSF console). Users without
a role can open every page.

## Build and deploy

```bash
npm run build        # dist/brokerage-admin-ui/browser
```

Netlify builds from `netlify.toml` and publishes `dist/brokerage-admin-ui/browser`. Redirects live
in `src/_redirects`, the same file laurus-web-app uses: `/api/*` is proxied to the brokerage backend
(`.../brokerage/api/v1/:splat`) and every other path falls back to `index.html`. The production
`baseApi` is therefore `/api/admin`, which reaches `/api/v1/admin` on the backend.

## Layout

| Path | Contents |
|---|---|
| `src/app/core` | API client, auth, interceptor, guard, lookups, ReportData, labels |
| `src/app/shared` | report viewer, entity pickers, stat tiles, page header, CRUD page |
| `src/app/layout` | shell and the sidebar menu (`menu.ts`, page keys) |
| `src/app/features/*` | one folder per menu group, each with its own routes file |
| `docs/migration` | implementation guide and the JSF inventories used for parity checks |

## Backend settings

The WAR reads these from the environment (or the matching JVM system property):

| Variable | Used for |
|---|---|
| `BROKERAGE_PAYSTACK_SECRET` | Paystack secret key |
| `BROKERAGE_MNOTIFY_API_KEY` | mNotify SMS key |
| `BROKERAGE_SMTP_HOST`, `BROKERAGE_SMTP_USER`, `BROKERAGE_SMTP_PASSWORD`, `BROKERAGE_SMTP_SENDER`, `BROKERAGE_SMTP_ACCOUNT_NAME` | outgoing email |
| `brokerage.marketdata.url` (system property) | Stately market-data service for fixed-income prices |

Until they are set, the old values committed in source are used and a warning is logged. Rotate
those keys, set the variables, then remove the fallbacks.
