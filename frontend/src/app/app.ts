import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LucideLogOut, LucideMenu, LucideMoon, LucideSearch, LucideShieldCheck, LucideSun } from '@lucide/angular';
import { ApiService } from './core/api.service';
import { AuthStore } from './core/auth.store';
import { NotesStore } from './core/notes.store';
import { ThemeStore } from './core/theme.store';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet, LucideLogOut, LucideMenu, LucideMoon, LucideSearch, LucideShieldCheck, LucideSun],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly commandShortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

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

  openCommandPalette() {
    this.notes.commandPaletteOpen.set(true);
  }

  openNotesMenu() {
    this.notes.mobilePanelOpen.set(true);
  }

  logout() {
    this.auth.logout();
    this.notes.notes.set([]);
    this.notes.archivedNotes.set([]);
    this.notes.clearSelection();
  }
}
