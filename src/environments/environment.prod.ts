export const environment = {
  production: true,
  // src/_redirects (same as laurus-web-app) maps /api/* to <backend>/brokerage/api/v1/*,
  // so /api/admin reaches the admin API at /api/v1/admin.
  baseApi: '/api/admin',
};
