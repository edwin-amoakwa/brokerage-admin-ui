/**
 * Both builds call the API through a relative path: `ng serve` proxies /api to
 * the local backend (proxy.conf.json) and Netlify rewrites /api to the hosted
 * backend (netlify.toml), so the browser always talks to one origin.
 */
export const environment = {
  production: false,
  baseApi: '/api/v1/admin',
};
