import { computed, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthTokenResponse, AuthUser, LoginRequest, RegisterRequest } from './models';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  readonly token = signal<string | null>(localStorage.getItem('ink.accessToken'));
  readonly user = signal<AuthUser | null>(null);
  readonly isAuthenticated = computed(() => !!this.token());

  constructor(private readonly api: ApiService) {
    if (this.token()) {
      this.loadCurrentUser();
    }
  }

  login(request: LoginRequest, afterLogin?: () => void) {
    this.api.request<AuthTokenResponse>('post', '/api/auth/login', request).subscribe({
      next: (response) => {
        localStorage.setItem('ink.accessToken', response.accessToken);
        this.token.set(response.accessToken);
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
    localStorage.removeItem('ink.accessToken');
    this.token.set(null);
    this.user.set(null);
  }

  loadCurrentUser() {
    this.api.request<AuthUser>('get', '/api/me').subscribe({
      next: (user) => this.user.set(user),
      error: () => this.logout(),
    });
  }
}
