import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { NotifyService } from './notify.service';
import { SessionService } from './session.service';

const PUBLIC = ['/auth/login', '/auth/refresh'];

/**
 * Adds the bearer token to admin API calls, refreshes once on 401, and shows
 * toasts from the response envelope:
 *  - a successful POST/PUT/DELETE shows the server message (or a default),
 *  - any failure shows the message and the listed errors.
 * Pass the header `X-Silent: 1` to suppress the success toast.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);
  const auth = inject(AuthService);
  const notify = inject(NotifyService);

  const isApi = req.url.startsWith(environment.baseApi);
  const isPublic = PUBLIC.some((p) => req.url.endsWith(p));
  const silent = req.headers.has('X-Silent');
  if (silent) {
    req = req.clone({ headers: req.headers.delete('X-Silent') });
  }
  // X-Quiet: no toast at all, success or error (background calls such as the live stream token).
  const quiet = req.headers.has('X-Quiet');
  if (quiet) {
    req = req.clone({ headers: req.headers.delete('X-Quiet') });
  }

  const withToken = (request: HttpRequest<any>, token: string | null) =>
    token && isApi && !isPublic ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  const handleSuccess = (event: any) => {
    if (!(event instanceof HttpResponse) || !isApi || silent || quiet) {
      return;
    }
    const body: any = event.body;
    if (req.method !== 'GET' && body?.success && !req.url.endsWith('/auth/refresh') && !req.url.endsWith('/auth/login')) {
      const fallback = req.method === 'DELETE' ? 'Record deleted' : req.method === 'POST' ? 'Saved successfully' : 'Updated successfully';
      const message = typeof body.message === 'string' && body.message && body.message !== 'Successful' ? body.message : fallback;
      notify.success(message);
    }
  };

  const showError = (error: HttpErrorResponse) => {
    // sign-in and refresh failures are shown by the login screen itself
    if (!isApi || isPublic || quiet) {
      return;
    }
    const body: any = error.error;
    if (error.status === 0) {
      notify.error('The server could not be reached. Check your connection.');
      return;
    }
    const message = body?.message || error.statusText || 'Request failed';
    const details = (body?.errors || []).map((e: any) => e.message).filter(Boolean).join('\n');
    notify.error(details || message, details ? message : 'Error');
  };

  return next(withToken(req, session.getAccessToken())).pipe(
    tap(handleSuccess),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isApi && !isPublic && session.getRefreshToken()) {
        return auth.refresh().pipe(
          switchMap((token) => {
            if (!token) {
              auth.sessionEnded();
              return throwError(() => error);
            }
            return next(withToken(req, token)).pipe(
              tap(handleSuccess),
              catchError((retryError: HttpErrorResponse) => {
                showError(retryError);
                return throwError(() => retryError);
              }),
            );
          }),
        );
      }
      if (error.status === 401 && isApi && !isPublic) {
        auth.sessionEnded();
        return throwError(() => error);
      }
      showError(error);
      return throwError(() => error);
    }),
  );
};
