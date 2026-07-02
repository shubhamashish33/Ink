import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

type UserRole = 'USER';

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

interface AuthTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresInMinutes: number;
  user: AuthUser;
}

interface Note {
  id: string;
  title: string;
  content: string;
  archived: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NoteForm {
  title: string;
  content: string;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly authMode = signal<'login' | 'register'>('login');
  protected readonly token = signal<string | null>(localStorage.getItem('ink.accessToken'));
  protected readonly currentUser = signal<AuthUser | null>(null);
  protected readonly notes = signal<Note[]>([]);
  protected readonly archivedNotes = signal<Note[]>([]);
  protected readonly activeView = signal<'active' | 'archived'>('active');
  protected readonly selectedNoteId = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly loginForm = signal({ email: '', password: '' });
  protected readonly registerForm = signal({ email: '', password: '', displayName: '' });
  protected readonly noteForm = signal<NoteForm>({ title: '', content: '' });

  protected readonly isAuthenticated = computed(() => !!this.token());
  protected readonly visibleNotes = computed(() =>
    this.activeView() === 'active' ? this.notes() : this.archivedNotes(),
  );
  protected readonly selectedNote = computed(() => {
    const id = this.selectedNoteId();
    return this.visibleNotes().find((note) => note.id === id) ?? null;
  });

  constructor(private readonly http: HttpClient) {
    if (this.token()) {
      this.loadCurrentUser();
      this.loadNotes();
    }
  }

  protected switchAuthMode(mode: 'login' | 'register') {
    this.authMode.set(mode);
    this.error.set(null);
  }

  protected updateLogin(field: 'email' | 'password', value: string) {
    this.loginForm.update((form) => ({ ...form, [field]: value }));
  }

  protected updateRegister(field: 'email' | 'password' | 'displayName', value: string) {
    this.registerForm.update((form) => ({ ...form, [field]: value }));
  }

  protected updateNoteForm(field: keyof NoteForm, value: string) {
    this.noteForm.update((form) => ({ ...form, [field]: value }));
  }

  protected login() {
    this.request<AuthTokenResponse>('post', '/api/auth/login', this.loginForm()).subscribe({
      next: (response) => this.setSession(response),
      error: (error) => this.handleError(error),
    });
  }

  protected register() {
    const form = this.registerForm();
    this.request<AuthUser>('post', '/api/auth/register', form).subscribe({
      next: () => {
        this.loginForm.set({ email: form.email, password: form.password });
        this.login();
      },
      error: (error) => this.handleError(error),
    });
  }

  protected logout() {
    localStorage.removeItem('ink.accessToken');
    this.token.set(null);
    this.currentUser.set(null);
    this.notes.set([]);
    this.archivedNotes.set([]);
    this.selectedNoteId.set(null);
    this.noteForm.set({ title: '', content: '' });
  }

  protected selectView(view: 'active' | 'archived') {
    this.activeView.set(view);
    this.selectedNoteId.set(null);
    if (view === 'active') {
      this.loadNotes();
    } else {
      this.loadArchived();
    }
  }

  protected selectNote(note: Note) {
    this.selectedNoteId.set(note.id);
    this.noteForm.set({ title: note.title, content: note.content });
  }

  protected startNewNote() {
    this.selectedNoteId.set(null);
    this.noteForm.set({ title: '', content: '' });
  }

  protected saveNote() {
    const selected = this.selectedNote();
    const form = this.noteForm();
    const body = { title: form.title.trim(), content: form.content.trim() };

    if (!body.title || !body.content) {
      this.error.set('Title and content are required.');
      return;
    }

    if (selected) {
      this.request<Note>('put', `/api/notes/${selected.id}`, body).subscribe({
        next: (note) => this.replaceNote(note),
        error: (error) => this.handleError(error),
      });
      return;
    }

    this.request<Note>('post', '/api/notes', body).subscribe({
      next: (note) => {
        this.notes.update((notes) => [note, ...notes]);
        this.selectNote(note);
        this.error.set(null);
      },
      error: (error) => this.handleError(error),
    });
  }

  protected archive(note: Note) {
    this.request<Note>('patch', `/api/notes/${note.id}/archive`).subscribe({
      next: () => {
        this.notes.update((notes) => notes.filter((item) => item.id !== note.id));
        this.startNewNote();
      },
      error: (error) => this.handleError(error),
    });
  }

  protected unarchive(note: Note) {
    this.request<Note>('patch', `/api/notes/${note.id}/unarchive`).subscribe({
      next: () => {
        this.archivedNotes.update((notes) => notes.filter((item) => item.id !== note.id));
        this.startNewNote();
      },
      error: (error) => this.handleError(error),
    });
  }

  protected pin(note: Note) {
    this.request<Note>('patch', `/api/notes/${note.id}/pin`).subscribe({
      next: (updated) => this.replaceNote(updated),
      error: (error) => this.handleError(error),
    });
  }

  protected unpin(note: Note) {
    this.request<Note>('patch', `/api/notes/${note.id}/unpin`).subscribe({
      next: (updated) => this.replaceNote(updated),
      error: (error) => this.handleError(error),
    });
  }

  protected deleteNote(note: Note) {
    this.request<void>('delete', `/api/notes/${note.id}`).subscribe({
      next: () => {
        const update = (notes: Note[]) => notes.filter((item) => item.id !== note.id);
        this.notes.update(update);
        this.archivedNotes.update(update);
        this.startNewNote();
      },
      error: (error) => this.handleError(error),
    });
  }

  private loadCurrentUser() {
    this.request<AuthUser>('get', '/api/me').subscribe({
      next: (user) => this.currentUser.set(user),
      error: () => this.logout(),
    });
  }

  private loadNotes() {
    this.request<Note[]>('get', '/api/notes').subscribe({
      next: (notes) => this.notes.set(notes),
      error: (error) => this.handleError(error),
    });
  }

  private loadArchived() {
    this.request<Note[]>('get', '/api/notes/archived').subscribe({
      next: (notes) => this.archivedNotes.set(notes),
      error: (error) => this.handleError(error),
    });
  }

  private setSession(response: AuthTokenResponse) {
    localStorage.setItem('ink.accessToken', response.accessToken);
    this.token.set(response.accessToken);
    this.currentUser.set(response.user);
    this.error.set(null);
    this.loadNotes();
  }

  private replaceNote(note: Note) {
    const update = (notes: Note[]) => notes.map((item) => (item.id === note.id ? note : item));
    this.notes.update(update);
    this.archivedNotes.update(update);
    this.selectNote(note);
    this.error.set(null);
  }

  private request<T>(method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: unknown) {
    this.loading.set(true);
    const headers = this.authHeaders();
    const request$ =
      method === 'get' || method === 'delete'
        ? this.http.request<T>(method, url, { headers })
        : this.http.request<T>(method, url, { body, headers });

    return request$.pipe(finalize(() => this.loading.set(false)));
  }

  private authHeaders() {
    const token = this.token();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
  }

  private handleError(error: unknown) {
    this.loading.set(false);
    if (error instanceof HttpErrorResponse && error.error?.message) {
      this.error.set(error.error.message);
      return;
    }
    this.error.set('Request failed. Check that the backend is running.');
  }
}
