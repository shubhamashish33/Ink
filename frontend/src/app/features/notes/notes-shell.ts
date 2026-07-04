import { DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideArchive, LucideArchiveRestore, LucideClock, LucideFileText, LucideLogOut, LucideNotebook, LucidePin, LucidePlus, LucideSave, LucideSearch, LucideTrash2, } from '@lucide/angular';
import { ApiService } from '../../core/api.service';
import { AuthStore } from '../../core/auth.store';
import { Note } from '../../core/models';
import { NotesStore } from '../../core/notes.store';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

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
    LucideNotebook,
    LucidePin,
    LucidePlus,
    LucideSave,
    LucideSearch,
    LucideTrash2,
  ],
  templateUrl: './notes-shell.html',
  styleUrl: './notes-shell.css',
})
export class NotesShell {
  private readonly searchInput$ = new Subject<string>();
  constructor(
    readonly auth: AuthStore,
    readonly notes: NotesStore,
    readonly api: ApiService,
  ) {
    this.searchInput$.pipe(debounceTime(300), distinctUntilChanged(),).subscribe((value) => {
      this.notes.search(value);
    })
  }

  logout() {
    this.auth.logout();
    this.notes.notes.set([]);
    this.notes.archivedNotes.set([]);
    this.notes.clearSelection();
  }

  updateSearch(value: string) {
    this.notes.setSearchQuery(value);
    this.searchInput$.next(value);
  }

  trackNote(_: number, note: Note) {
    return note.id;
  }
}
