import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../core/auth.store';
import { NotesStore } from '../../core/notes.store';
import { AuthPanel } from './auth-panel';

@Component({
  selector: 'app-auth-page',
  imports: [AuthPanel],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.css',
})
export class AuthPage {
  readonly mode: 'login' | 'register';

  constructor(
    route: ActivatedRoute,
    private readonly router: Router,
    readonly auth: AuthStore,
    readonly notes: NotesStore,
  ) {
    this.mode = route.snapshot.data['mode'] as 'login' | 'register';

    if (this.auth.isAuthenticated()) {
      this.router.navigateByUrl('/notes');
    }
  }

  onAuthenticated() {
    this.notes.loadActive();
    this.router.navigateByUrl('/notes');
  }
}
