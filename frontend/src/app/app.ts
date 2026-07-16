import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { LucideLogOut, LucideMenu, LucideMoon, LucideSearch, LucideShieldCheck, LucideSun } from '@lucide/angular';
import { ApiService } from './core/api.service';
import { AuthStore } from './core/auth.store';
import { CryptoService } from './core/crypto.service';
import { NotesStore } from './core/notes.store';
import { ThemeStore } from './core/theme.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LucideLogOut, LucideMenu, LucideMoon, LucideSearch, LucideShieldCheck, LucideSun],
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
    private readonly crypto: CryptoService,
    private readonly router: Router,
  ) {
    if (this.auth.isAuthenticated()) {
      void this.restoreWorkspace();
    }
  }

  openHome() {
    const destination = this.auth.isAuthenticated() ? '/notes' : '/';
    if (this.router.url !== destination) void this.router.navigateByUrl(destination);
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

  private async restoreWorkspace() {
    try {
      if (await this.crypto.restore()) {
        this.notes.loadActive();
        return;
      }
    } catch (error) {
      this.api.setError(error);
    }

    this.auth.logout();
  }
}
