import { computed, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Note, NoteRequest, PageResponse } from './models';

export type NoteDateFilter = 'all' | 'today' | 'week' | 'month';
export type NoteSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

@Injectable({ providedIn: 'root' })
export class NotesStore {
  readonly activeView = signal<'active' | 'archived'>('active');
  readonly searchQuery = signal('');
  readonly tagFilter = signal('');
  readonly dateFilter = signal<NoteDateFilter>('all');
  readonly notes = signal<Note[]>([]);
  readonly archivedNotes = signal<Note[]>([]);
  readonly selectedNoteId = signal<string | null>(null);
  readonly mobilePanelOpen = signal(false);
  readonly commandPaletteOpen = signal(false);
  readonly paletteResults = signal<Note[]>([]);
  readonly draft = signal<NoteRequest>({ title: '', content: '', tags: [] });
  readonly tagsInput = signal('');
  readonly saveState = signal<NoteSaveState>('idle');
  readonly currentNotes = computed(() => (this.activeView() === 'active' ? this.notes() : this.archivedNotes()));
  readonly availableTags = computed(() =>
    Array.from(new Set(this.currentNotes().flatMap((note) => note.tags ?? []))).sort(),
  );
  readonly visibleNotes = computed(() => {
    const tag = this.tagFilter();
    const date = this.dateFilter();
    const cutoff = this.dateCutoff(date);

    return this.currentNotes().filter((note) => {
      const matchesTag = !tag || note.tags?.includes(tag);
      const matchesDate = !cutoff || new Date(note.updatedAt).getTime() >= cutoff;
      return matchesTag && matchesDate;
    });
  });
  readonly selectedNote = computed(() => {
    const id = this.selectedNoteId();
    return [...this.notes(), ...this.archivedNotes()].find((note) => note.id === id) ?? null;
  });

  private saveInProgress = false;
  private savePending = false;
  private readonly afterSaveCallbacks: Array<() => void> = [];
  private paletteSearchSequence = 0;

  constructor(private readonly api: ApiService) {}

  loadActive() {
    const query = this.searchQuery().trim();
    const url = query ? `/api/notes/search?q=${encodeURIComponent(query)}` : '/api/notes';
    this.api.request<PageResponse<Note>>('get', url).subscribe({
      next: (page) => this.notes.set(page.content),
      error: (error) => this.api.setError(error),
    });
  }

  loadArchived() {
    this.api.request<PageResponse<Note>>('get', '/api/notes/archived').subscribe({
      next: (page) => this.archivedNotes.set(page.content),
      error: (error) => this.api.setError(error),
    });
  }

  switchView(view: 'active' | 'archived') {
    this.activeView.set(view);
    this.clearSelection();
    view === 'active' ? this.loadActive() : this.loadArchived();
  }

  search(value: string) {
    this.setSearchQuery(value);
    this.clearSelection();
    this.loadActive();
  }

  searchPalette(value: string) {
    const query = value.trim();
    const sequence = ++this.paletteSearchSequence;

    if (!query) {
      this.paletteResults.set(this.currentNotes().slice(0, 8));
      return;
    }

    this.api.request<PageResponse<Note>>('get', `/api/notes/search?q=${encodeURIComponent(query)}&size=8`).subscribe({
      next: (page) => {
        if (sequence === this.paletteSearchSequence) {
          this.paletteResults.set(page.content);
        }
      },
      error: (error) => {
        if (sequence === this.paletteSearchSequence) {
          this.paletteResults.set([]);
          this.api.setError(error);
        }
      },
    });
  }

  setSearchQuery(value: string) {
    this.searchQuery.set(value);
    this.activeView.set('active');
  }

  select(note: Note) {
    this.selectedNoteId.set(note.id);
    const tags = note.tags ?? [];
    this.draft.set({ title: note.title, content: note.content, tags });
    this.tagsInput.set(tags.join(', '));
    this.saveState.set('idle');
  }

  clearSelection() {
    this.selectedNoteId.set(null);
    this.draft.set({ title: '', content: '', tags: [] });
    this.tagsInput.set('');
    this.saveState.set('idle');
  }

  updateDraft(field: 'title' | 'content', value: string) {
    this.draft.update((draft) => ({ ...draft, [field]: value }));
    this.saveState.set('dirty');
  }

  updateTagsFromText(value: string) {
    this.tagsInput.set(value);
    this.draft.update((draft) => ({ ...draft, tags: this.normalizeTags(value) }));
    this.saveState.set('dirty');
  }

  setTagFilter(tag: string) {
    this.tagFilter.set(tag);
  }

  setDateFilter(date: NoteDateFilter) {
    this.dateFilter.set(date);
  }

  clearFilters() {
    this.tagFilter.set('');
    this.dateFilter.set('all');
  }

  save(silent = false, afterSave?: () => void) {
    if (afterSave) {
      this.afterSaveCallbacks.push(afterSave);
    }

    const selected = this.selectedNote();
    const draft = this.draft();
    const body = {
      title: draft.title.trim(),
      content: draft.content.trim(),
      tags: this.normalizeTags(draft.tags),
    };

    if (!body.title || !body.content) {
      if (!silent) {
        this.api.error.set('Title and content are required.');
      } else {
        this.runAfterSaveCallbacks();
      }
      return;
    }

    if (silent && this.saveState() !== 'dirty') {
      if (!this.saveInProgress) {
        this.runAfterSaveCallbacks();
      }
      return;
    }

    if (this.saveInProgress) {
      this.savePending = true;
      return;
    }

    this.saveInProgress = true;
    this.saveState.set('saving');
    const targetId = selected?.id ?? null;
    if (selected) {
      this.api.request<Note>('put', `/api/notes/${selected.id}`, body).subscribe({
        next: (note) => this.completeSave(note, body, targetId),
        error: (error) => this.failSave(error),
      });
      return;
    }

    this.api.request<Note>('post', '/api/notes', body).subscribe({
      next: (note) => {
        this.notes.update((notes) => [note, ...notes]);
        this.completeSave(note, body, targetId);
      },
      error: (error) => this.failSave(error),
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

  private completeSave(note: Note, savedDraft: NoteRequest, targetId: string | null) {
    const update = (notes: Note[]) => notes.map((item) => (item.id === note.id ? note : item));
    this.notes.update(update);
    this.archivedNotes.update(update);
    const selectionChanged = this.selectedNoteId() !== targetId;
    if (selectionChanged) {
      this.saveInProgress = false;
      this.api.clearError();
      if (this.savePending) {
        this.savePending = false;
        this.save(true);
      } else {
        this.runAfterSaveCallbacks();
      }
      return;
    }

    this.selectedNoteId.set(note.id);

    const changedWhileSaving = !this.sameDraft(this.draft(), savedDraft);
    if (!changedWhileSaving) {
      this.select(note);
      this.saveState.set('saved');
    } else {
      this.saveState.set('dirty');
    }

    this.saveInProgress = false;
    this.api.clearError();

    if (this.savePending || changedWhileSaving) {
      this.savePending = false;
      this.save(true);
    } else {
      this.runAfterSaveCallbacks();
    }
  }

  private failSave(error: unknown) {
    this.saveInProgress = false;
    this.savePending = false;
    this.afterSaveCallbacks.length = 0;
    this.saveState.set('error');
    this.api.setError(error);
  }

  private runAfterSaveCallbacks() {
    const callbacks = this.afterSaveCallbacks.splice(0);
    callbacks.forEach((callback) => callback());
  }

  private sameDraft(left: NoteRequest, right: NoteRequest) {
    return left.title.trim() === right.title
      && left.content.trim() === right.content
      && this.normalizeTags(left.tags).join('|') === this.normalizeTags(right.tags).join('|');
  }

  private dateCutoff(filter: NoteDateFilter) {
    if (filter === 'all') {
      return null;
    }

    const now = new Date();
    if (filter === 'today') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }

    const days = filter === 'week' ? 7 : 30;
    return now.getTime() - days * 24 * 60 * 60 * 1000;
  }

  private normalizeTags(tags: string[] | string) {
    const values = Array.isArray(tags) ? tags : tags.split(',');

    return Array.from(
      new Set(
        values
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
  }
}

