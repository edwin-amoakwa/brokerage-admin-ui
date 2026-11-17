import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from './api-response';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private session = inject(SessionService);
  private router = inject(Router);

  private refreshing$: Observable<string | null> | null = null;

  async login(emailAddress: string, password: string): Promise<ApiResponse> {
    const response = await this.api.post('auth/login', { emailAddress, password });
    if (response.success) {
      this.session.start(response.data);
    }
    return response;
  }

  async logout(): Promise<void> {
    if (this.session.getAccessToken()) {
      await this.api.post('auth/logout');
    }
    this.session.clear();
    this.router.navigate(['/login']);
  }

  /** Called by the interceptor on a 401; one refresh is shared by concurrent requests. */
  refresh(): Observable<string | null> {
    if (!this.refreshing$) {
      this.refreshing$ = this.http
        .post<ApiResponse>(this.api.url('auth/refresh'), { refreshToken: this.session.getRefreshToken() })
        .pipe(
          map((response) => {
            if (response?.success) {
              this.session.start(response.data);
              return response.data.accessToken as string;
            }
            return null;
          }),
          // a rejected refresh (HTTP 401) is "no token", so the interceptor ends the session
          catchError(() => of(null)),
          finalize(() => (this.refreshing$ = null)),
          shareReplay(1),
        );
    }
    return this.refreshing$;
  }

  async reloadProfile(): Promise<void> {
    const response = await this.api.get('auth/me');
    if (response.success) {
      this.session.updateUser(response.data);
    }
  }

  changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse> {
    return this.api.put('auth/change-password', { currentPassword, newPassword });
  }

  sessionEnded(): void {
    this.session.clear();
    this.router.navigate(['/login'], { queryParams: { expired: 1 } });
  }
}

