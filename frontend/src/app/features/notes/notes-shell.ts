import { DatePipe } from '@angular/common';
import { Component, HostListener, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  LucideArchive,
  LucideArchiveRestore,
  LucideClock,
  LucideFileText,
  LucideLogOut,
  LucideMoon,
  LucideNotebook,
  LucidePin,
  LucidePlus,
  LucideSave,
  LucideSearch,
  LucideTag,
  LucideTrash2,
  LucideSun,
  LucideX,
} from '@lucide/angular';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { Note } from '../../core/models';
import { NotesStore } from '../../core/notes.store';
import { ThemeStore } from '../../core/theme.store';

interface NoteContextMenu {
  note: Note;
  x: number;
  y: number;
}

@Component({
  selector: 'app-notes-shell',
  imports: [
    DatePipe,
    FormsModule,
    LucideArchive,
    LucideArchiveRestore,
    LucideClock,
    LucideFileText,
    LucideLogOut,
    LucideMoon,
    LucideNotebook,
    LucidePin,
    LucidePlus,
    LucideSave,
    LucideSearch,
    LucideTag,
    LucideTrash2,
    LucideSun,
    LucideX,
  ],
  templateUrl: './notes-shell.html',
  styleUrl: './notes-shell.css',
})
export class NotesShell {
  readonly contextMenu = signal<NoteContextMenu | null>(null);
  private readonly searchInput$ = new Subject<string>();

  constructor(
    readonly auth: AuthStore,
    readonly notes: NotesStore,
    readonly api: ApiService,
    readonly theme: ThemeStore,
  ) {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => this.notes.search(value));
  }

  @HostListener('document:click')
  closeContextMenu() {
    this.contextMenu.set(null);
  }

  @HostListener('document:keydown.escape')
  closeContextMenuOnEscape() {
    this.closeContextMenu();
    this.closeMobilePanel();
  }

  closeMobilePanel() {
    this.notes.mobilePanelOpen.set(false);
  }

  logout() {
    this.closeMobilePanel();
    this.auth.logout();
    this.notes.notes.set([]);
    this.notes.archivedNotes.set([]);
    this.notes.clearSelection();
  }

  createNewNote() {
    this.notes.clearSelection();
    this.closeMobilePanel();
  }

  selectNote(note: Note) {
    this.notes.select(note);
    this.closeMobilePanel();
  }

  switchView(view: 'active' | 'archived') {
    this.notes.switchView(view);
  }

  updateSearch(value: string) {
    this.notes.setSearchQuery(value);
    this.searchInput$.next(value);
  }

  openContextMenu(event: MouseEvent, note: Note) {
    event.preventDefault();
    event.stopPropagation();
    this.notes.select(note);
    this.contextMenu.set({ note, x: event.clientX, y: event.clientY });
  }

  togglePin(note: Note) {
    note.pinned ? this.notes.unpin(note) : this.notes.pin(note);
    this.closeContextMenu();
  }

  toggleArchive(note: Note) {
    note.archived ? this.notes.unarchive(note) : this.notes.archive(note);
    this.closeContextMenu();
  }

  deleteFromMenu(note: Note) {
    this.notes.delete(note);
    this.closeContextMenu();
  }

  trackNote(_: number, note: Note) {
    return note.id;
  }
}
