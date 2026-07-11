import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideKeyRound, LucideLock, LucideMail, LucideShieldCheck, LucideUser } from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';

@Component({
  selector: 'app-auth-panel',
  imports: [FormsModule, LucideKeyRound, LucideLock, LucideMail, LucideShieldCheck, LucideUser],
  templateUrl: './auth-panel.html',
  styleUrl: './auth-panel.css',
})
export class AuthPanel {
  @Output() readonly authenticated = new EventEmitter<void>();

  @Input() set initialMode(mode: 'login' | 'register') {
    this.mode.set(mode);
  }

  readonly mode = signal<'login' | 'register'>('login');
  readonly loginForm = signal({ email: '', password: '' });
  readonly registerForm = signal({ email: '', password: '', displayName: '' });

  constructor(
    readonly api: ApiService,
    private readonly auth: AuthStore,
  ) {}

  setMode(mode: 'login' | 'register') {
    this.mode.set(mode);
    this.api.clearError();
  }

  updateLogin(field: 'email' | 'password', value: string) {
    this.loginForm.update((form) => ({ ...form, [field]: value }));
  }

  updateRegister(field: 'email' | 'password' | 'displayName', value: string) {
    this.registerForm.update((form) => ({ ...form, [field]: value }));
  }

  login() {
    this.auth.login(this.loginForm(), () => this.authenticated.emit());
  }

  register() {
    const form = this.registerForm();
    this.auth.register(form, () => this.authenticated.emit());
  }
}




