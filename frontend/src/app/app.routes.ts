import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { AuthPage } from './features/auth/auth-page';
import { LandingPage } from './features/landing/landing-page';
import { NotesPage } from './features/notes-page/notes-page';

export const routes: Routes = [
  { path: '', component: LandingPage, title: 'Ink - Private Notes Workspace' },
  { path: 'login', component: AuthPage, data: { mode: 'login' }, title: 'Login - Ink' },
  { path: 'register', component: AuthPage, data: { mode: 'register' }, title: 'Register - Ink' },
  { path: 'notes', component: NotesPage, canActivate: [authGuard], title: 'Notes - Ink' },
  { path: '**', redirectTo: '' },
];
