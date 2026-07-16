import { HttpErrorResponse } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Note, NoteRequest, PageResponse } from './models';
import { CryptoService } from './crypto.service';

export type NoteDateFilter = 'all' | 'today' | 'week' | 'month';
export type NoteSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error';

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
  private persistedDraft: NoteRequest | null = null;

  constructor(private readonly api: ApiService, private readonly crypto: CryptoService) {}

  loadActive() {
    this.api.request<PageResponse<import('./models').EncryptedNoteResponse>>('get', '/api/notes?size=1000').subscribe({
      next: (page) => {
        void this.decryptAll(page.content)
          .then((notes) => this.notes.set(notes.filter((note) => this.matchesSearch(note))))
          .catch((error) => this.api.setError(error));
      },
      error: (error) => this.api.setError(error),
    });
  }

  loadArchived() {
    this.api.request<PageResponse<import('./models').EncryptedNoteResponse>>('get', '/api/notes/archived?size=1000').subscribe({
      next: (page) => {
        void this.decryptAll(page.content)
          .then((notes) => this.archivedNotes.set(notes))
          .catch((error) => this.api.setError(error));
      },
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

    const results = this.currentNotes().filter((note) => !query || this.matchesSearch(note, query));
    if (sequence === this.paletteSearchSequence) this.paletteResults.set(results.slice(0, 8));
  }

  setSearchQuery(value: string) {
    this.searchQuery.set(value);
    this.activeView.set('active');
  }

  select(note: Note) {
    this.selectedNoteId.set(note.id);
    const tags = note.tags ?? [];
    const draft = { title: note.title, content: note.content, tags };
    this.draft.set(draft);
    this.persistedDraft = this.normalizedDraft(draft);
    this.tagsInput.set(tags.join(', '));
    this.saveState.set('idle');
  }

  clearSelection() {
    this.selectedNoteId.set(null);
    this.draft.set({ title: '', content: '', tags: [] });
    this.tagsInput.set('');
    this.persistedDraft = null;
    this.saveState.set('idle');
  }

  updateDraft(field: 'title' | 'content', value: string) {
    this.draft.update((draft) => ({ ...draft, [field]: value }));
    this.refreshDirtyState();
  }

  updateTagsFromText(value: string) {
    this.tagsInput.set(value);
    this.draft.update((draft) => ({ ...draft, tags: this.normalizeTags(value) }));
    this.refreshDirtyState();
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
    const body: NoteRequest = {
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
    this.crypto.encrypt(body).then((encryptedPayload) => {
      const request = selected
        ? { encryptedPayload, version: selected.version }
        : { encryptedPayload };
      if (selected) {
        this.api.request<import('./models').EncryptedNoteResponse>('put', `/api/notes/${selected.id}`, request).subscribe({
          next: async (response) => this.completeSave((await this.crypto.decrypt(response))!, body, targetId),
          error: (error) => this.failSave(error),
        });
        return;
      }
      this.api.request<import('./models').EncryptedNoteResponse>('post', '/api/notes', request).subscribe({
        next: async (response) => {
          const note = await this.crypto.decrypt(response);
          if (note) this.notes.update((notes) => [note, ...notes]);
          if (note) this.completeSave(note, body, targetId);
        },
        error: (error) => this.failSave(error),
      });
    }).catch((error) => this.failSave(error));
  }

  private async decryptAll(items: import('./models').EncryptedNoteResponse[]) {
    const notes = await Promise.all(items.map((item) => this.crypto.decrypt(item)));
    return notes.filter((note): note is Note => !!note);
  }

  private matchesSearch(note: Note, query = this.searchQuery().trim()) {
    if (!query) return true;
    const value = `${note.title} ${note.content} ${note.tags.join(' ')}`.toLowerCase();
    return value.includes(query.toLowerCase());
  }

  /*
    The server never receives title/content/tags. The code below is retained
    only in the branch diff context to make the save flow easy to review.
  */
  private legacySaveRemoved() {
    /*
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
    */
  }

  archive(note: Note) {
    this.moveOut(note, `/api/notes/${note.id}/archive`, 'notes');
  }

  unarchive(note: Note) {
    this.moveOut(note, `/api/notes/${note.id}/unarchive`, 'archivedNotes');
  }

  pin(note: Note) {
    this.api.request<import('./models').EncryptedNoteResponse>('patch', `/api/notes/${note.id}/pin`).subscribe({
      next: async (updated) => { const decrypted = await this.crypto.decrypt(updated); if (decrypted) this.replace(decrypted); },
      error: (error) => this.api.setError(error),
    });
  }

  unpin(note: Note) {
    this.api.request<import('./models').EncryptedNoteResponse>('patch', `/api/notes/${note.id}/unpin`).subscribe({
      next: async (updated) => { const decrypted = await this.crypto.decrypt(updated); if (decrypted) this.replace(decrypted); },
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

  reloadSelected() {
    const selected = this.selectedNote();
    if (!selected) return;

    this.api.request<import('./models').EncryptedNoteResponse>('get', `/api/notes/${selected.id}`).subscribe({
      next: async (response) => {
        const latest = await this.crypto.decrypt(response);
        if (latest) this.replace(latest);
      },
      error: (error) => this.api.setError(error),
    });
  }

  private moveOut(note: Note, url: string, collection: 'notes' | 'archivedNotes') {
    this.api.request<import('./models').EncryptedNoteResponse>('patch', url).subscribe({
      next: (updated) => {
        const replaceMetadata = async () => {
          const decrypted = await this.crypto.decrypt(updated);
          if (decrypted) this.replace(decrypted);
        };
        void replaceMetadata();
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
    const versionConflict = error instanceof HttpErrorResponse
      && error.status === 409
      && error.error?.code === 'NOTE_VERSION_CONFLICT';
    this.saveState.set(versionConflict ? 'conflict' : 'error');
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

  private refreshDirtyState() {
    const draft = this.normalizedDraft(this.draft());
    const unchanged = this.persistedDraft !== null && this.sameDraft(draft, this.persistedDraft);
    const emptyNewDraft = this.persistedDraft === null && !draft.title && !draft.content && draft.tags.length === 0;
    this.saveState.set(unchanged || emptyNewDraft ? 'idle' : 'dirty');
  }

  private normalizedDraft(draft: NoteRequest): NoteRequest {
    return {
      title: draft.title.trim(),
      content: draft.content.trim(),
      tags: this.normalizeTags(draft.tags),
    };
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

