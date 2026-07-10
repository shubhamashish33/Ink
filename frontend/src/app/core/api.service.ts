import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { catchError, finalize, Observable, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { AuthTokenResponse } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly rateLimited = signal(false);
  private refreshRequest$: Observable<AuthTokenResponse> | null = null;

  constructor(private readonly http: HttpClient) {}

  request<T>(method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: unknown): Observable<T> {
    this.loading.set(true);

    return this.send<T>(method, url, body).pipe(
      catchError((error) => {
        if (!this.shouldRefresh(error, url)) {
          return throwError(() => error);
        }

        return this.refreshAccessToken().pipe(switchMap(() => this.send<T>(method, url, body)));
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  setError(error: unknown) {
    if (error instanceof HttpErrorResponse && error.status === 429) {
      this.rateLimited.set(true);
      this.error.set('Too many attempts. Please wait about a minute before trying again.');
      return;
    }

    this.rateLimited.set(false);

    if (error instanceof HttpErrorResponse && error.error?.message) {
      this.error.set(error.error.message);
      return;
    }

    this.error.set('Request failed. Check that the backend is running.');
  }

  clearError() {
    this.error.set(null);
    this.rateLimited.set(false);
  }

  private send<T>(method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: unknown): Observable<T> {
    const token = localStorage.getItem('ink.accessToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;

    return method === 'get' || method === 'delete'
      ? this.http.request<T>(method, url, { headers })
      : this.http.request<T>(method, url, { body, headers });
  }

  private shouldRefresh(error: unknown, url: string) {
    return error instanceof HttpErrorResponse && error.status === 401 && !url.startsWith('/api/auth/');
  }

  private refreshAccessToken() {
    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    const refreshToken = localStorage.getItem('ink.refreshToken');

    if (!refreshToken) {
      this.clearSession();
      return throwError(() => new Error('Missing refresh token'));
    }

    this.refreshRequest$ = this.http.post<AuthTokenResponse>('/api/auth/refresh', { refreshToken }).pipe(
      tap((response) => {
        localStorage.setItem('ink.accessToken', response.accessToken);
        localStorage.setItem('ink.refreshToken', response.refreshToken);
        window.dispatchEvent(new CustomEvent<AuthTokenResponse>('ink-token-refreshed', { detail: response }));
      }),
      catchError((error) => {
        this.clearSession();
        return throwError(() => error);
      }),
      finalize(() => {
        this.refreshRequest$ = null;
      }),
      shareReplay(1),
    );

    return this.refreshRequest$;
  }

  private clearSession() {
    localStorage.removeItem('ink.accessToken');
    localStorage.removeItem('ink.refreshToken');
    window.dispatchEvent(new Event('ink-session-expired'));
  }
}
