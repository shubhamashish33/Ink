import { Component } from '@angular/core';
import { LucideArchive, LucideMoon, LucideNotebook, LucideSearch, LucideShieldCheck, LucideSparkles, LucideSun } from '@lucide/angular';
import { ApiService } from './core/api.service';
import { AuthStore } from './core/auth.store';
import { NotesStore } from './core/notes.store';
import { ThemeStore } from './core/theme.store';
import { AuthPanel } from './features/auth/auth-panel';
import { NotesShell } from './features/notes/notes-shell';

@Component({
  selector: 'app-root',
  imports: [
    AuthPanel,
    NotesShell,
    LucideArchive,
    LucideMoon,
    LucideNotebook,
    LucideSearch,
    LucideShieldCheck,
    LucideSparkles,
    LucideSun,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  constructor(
    readonly api: ApiService,
    readonly auth: AuthStore,
    readonly notes: NotesStore,
    readonly theme: ThemeStore,
  ) {
    if (this.auth.isAuthenticated()) {
      this.notes.loadActive();
    }
  }
}


