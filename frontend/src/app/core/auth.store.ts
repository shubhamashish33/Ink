import { computed, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthTokenResponse, AuthUser, LoginRequest, RegisterRequest } from './models';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  readonly token = signal<string | null>(localStorage.getItem('ink.accessToken'));
  readonly refreshToken = signal<string | null>(localStorage.getItem('ink.refreshToken'));
  readonly user = signal<AuthUser | null>(null);
  readonly isAuthenticated = computed(() => !!this.token());

  constructor(private readonly api: ApiService) {
    window.addEventListener('ink-token-refreshed', (event) => {
      const response = (event as CustomEvent<AuthTokenResponse>).detail;
      this.token.set(response.accessToken);
      this.refreshToken.set(response.refreshToken);
      this.user.set(response.user);
    });

    window.addEventListener('ink-session-expired', () => this.clearSession());

    if (this.token()) {
      this.loadCurrentUser();
    }
  }

  login(request: LoginRequest, afterLogin?: () => void) {
    this.api.request<AuthTokenResponse>('post', '/api/auth/login', request).subscribe({
      next: (response) => {
        localStorage.setItem('ink.accessToken', response.accessToken);
        localStorage.setItem('ink.refreshToken', response.refreshToken);
        this.token.set(response.accessToken);
        this.refreshToken.set(response.refreshToken);
        this.user.set(response.user);
        this.api.clearError();
        afterLogin?.();
      },
      error: (error) => this.api.setError(error),
    });
  }

  register(request: RegisterRequest, afterLogin?: () => void) {
    this.api.request<AuthUser>('post', '/api/auth/register', request).subscribe({
      next: () => this.login({ email: request.email, password: request.password }, afterLogin),
      error: (error) => this.api.setError(error),
    });
  }

  logout() {
    const refreshToken = this.refreshToken();
    if (refreshToken) {
      this.api.request<void>('post', '/api/auth/logout', { refreshToken }).subscribe();
    }

    localStorage.removeItem('ink.accessToken');
    localStorage.removeItem('ink.refreshToken');
    this.clearSession();
  }

  loadCurrentUser() {
    this.api.request<AuthUser>('get', '/api/me').subscribe({
      next: (user) => this.user.set(user),
      error: () => this.logout(),
    });
  }

  private clearSession() {
    this.token.set(null);
    this.refreshToken.set(null);
    this.user.set(null);
  }
}
