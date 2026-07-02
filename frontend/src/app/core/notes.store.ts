import { computed, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Note, NoteRequest } from './models';

@Injectable({ providedIn: 'root' })
export class NotesStore {
  readonly activeView = signal<'active' | 'archived'>('active');
  readonly searchQuery = signal('');
  readonly notes = signal<Note[]>([]);
  readonly archivedNotes = signal<Note[]>([]);
  readonly selectedNoteId = signal<string | null>(null);
  readonly draft = signal<NoteRequest>({ title: '', content: '' });
  readonly visibleNotes = computed(() => (this.activeView() === 'active' ? this.notes() : this.archivedNotes()));
  readonly selectedNote = computed(() => {
    const id = this.selectedNoteId();
    return this.visibleNotes().find((note) => note.id === id) ?? null;
  });

  constructor(private readonly api: ApiService) {}

  loadActive() {
    const query = this.searchQuery().trim();
    const url = query ? `/api/notes/search?q=${encodeURIComponent(query)}` : '/api/notes';
    this.api.request<Note[]>('get', url).subscribe({
      next: (notes) => this.notes.set(notes),
      error: (error) => this.api.setError(error),
    });
  }

  loadArchived() {
    this.api.request<Note[]>('get', '/api/notes/archived').subscribe({
      next: (notes) => this.archivedNotes.set(notes),
      error: (error) => this.api.setError(error),
    });
  }

  switchView(view: 'active' | 'archived') {
    this.activeView.set(view);
    this.clearSelection();
    view === 'active' ? this.loadActive() : this.loadArchived();
  }

  search(value: string) {
    this.searchQuery.set(value);
    this.activeView.set('active');
    this.clearSelection();
    this.loadActive();
  }

  select(note: Note) {
    this.selectedNoteId.set(note.id);
    this.draft.set({ title: note.title, content: note.content });
  }

  clearSelection() {
    this.selectedNoteId.set(null);
    this.draft.set({ title: '', content: '' });
  }

  updateDraft(field: keyof NoteRequest, value: string) {
    this.draft.update((draft) => ({ ...draft, [field]: value }));
  }

  save() {
    const selected = this.selectedNote();
    const body = { title: this.draft().title.trim(), content: this.draft().content.trim() };

    if (!body.title || !body.content) {
      this.api.error.set('Title and content are required.');
      return;
    }

    if (selected) {
      this.api.request<Note>('put', `/api/notes/${selected.id}`, body).subscribe({
        next: (note) => this.replace(note),
        error: (error) => this.api.setError(error),
      });
      return;
    }

    this.api.request<Note>('post', '/api/notes', body).subscribe({
      next: (note) => {
        this.notes.update((notes) => [note, ...notes]);
        this.select(note);
        this.api.clearError();
      },
      error: (error) => this.api.setError(error),
    });
  }

  archive(note: Note) {
    this.moveOut(note, `/api/notes/${note.id}/archive`, 'notes');
  }

  unarchive(note: Note) {
    this.moveOut(note, `/api/notes/${note.id}/unarchive`, 'archivedNotes');
  }

  pin(note: Note) {
    this.api.request<Note>('patch', `/api/notes/${note.id}/pin`).subscribe({
      next: (updated) => this.replace(updated),
      error: (error) => this.api.setError(error),
    });
  }

  unpin(note: Note) {
    this.api.request<Note>('patch', `/api/notes/${note.id}/unpin`).subscribe({
      next: (updated) => this.replace(updated),
      error: (error) => this.api.setError(error),
    });
  }

  delete(note: Note) {
    this.api.request<void>('delete', `/api/notes/${note.id}`).subscribe({
      next: () => {
        this.notes.update((notes) => notes.filter((item) => item.id !== note.id));
        this.archivedNotes.update((notes) => notes.filter((item) => item.id !== note.id));
        this.clearSelection();
      },
      error: (error) => this.api.setError(error),
    });
  }

  private moveOut(note: Note, url: string, collection: 'notes' | 'archivedNotes') {
    this.api.request<Note>('patch', url).subscribe({
      next: () => {
        this[collection].update((notes) => notes.filter((item) => item.id !== note.id));
        this.clearSelection();
      },
      error: (error) => this.api.setError(error),
    });
  }

  private replace(note: Note) {
    const update = (notes: Note[]) => notes.map((item) => (item.id === note.id ? note : item));
    this.notes.update(update);
    this.archivedNotes.update(update);
    this.select(note);
    this.api.clearError();
  }
}
