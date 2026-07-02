import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { finalize, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor(private readonly http: HttpClient) {}

  request<T>(method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: unknown): Observable<T> {
    this.loading.set(true);
    const token = localStorage.getItem('ink.accessToken');
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
    const request$ =
      method === 'get' || method === 'delete'
        ? this.http.request<T>(method, url, { headers })
        : this.http.request<T>(method, url, { body, headers });

    return request$.pipe(finalize(() => this.loading.set(false)));
  }

  setError(error: unknown) {
    if (error instanceof HttpErrorResponse && error.error?.message) {
      this.error.set(error.error.message);
      return;
    }
    this.error.set('Request failed. Check that the backend is running.');
  }

  clearError() {
    this.error.set(null);
  }
}
