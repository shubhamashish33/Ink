import { DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, ViewChild, computed, effect, inject, signal } from '@angular/core';
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
import { NoteDateFilter, NotesStore } from '../../core/notes.store';
import { ThemeStore } from '../../core/theme.store';

interface NoteContextMenu {
  note: Note;
  x: number;
  y: number;
}

interface HighlightPart {
  text: string;
  match: boolean;
}

type CommandId = 'new' | 'save' | 'theme';

interface PaletteItem {
  id: string;
  kind: 'command' | 'note' | 'create';
  label: string;
  detail?: string;
  shortcut?: string;
  command?: CommandId;
  note?: Note;
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
  @ViewChild('titleInput') private titleInput?: ElementRef<HTMLInputElement>;
  @ViewChild('commandInput') private commandInput?: ElementRef<HTMLInputElement>;
  @ViewChild('commandList') private commandList?: ElementRef<HTMLElement>;

  readonly contextMenu = signal<NoteContextMenu | null>(null);
  readonly commandQuery = signal('');
  readonly paletteIndex = signal(0);
  readonly paletteItems = computed<PaletteItem[]>(() => {
    const query = this.commandQuery().trim().toLowerCase();
    const commands: { id: CommandId; label: string; shortcut: string }[] = [
      { id: 'new', label: 'Create new note', shortcut: 'Ctrl N' },
      { id: 'save', label: 'Save now', shortcut: 'Ctrl S' },
      { id: 'theme', label: 'Toggle theme', shortcut: '' },
    ];
    const commandItems: PaletteItem[] = commands
      .filter((command) => !query || command.label.toLowerCase().includes(query))
      .map((command) => ({
        id: `command-${command.id}`,
        kind: 'command',
        label: command.label,
        shortcut: command.shortcut,
        command: command.id,
      }));
    const noteItems: PaletteItem[] = this.notes.paletteResults().map((note) => ({
      id: `note-${note.id}`,
      kind: 'note',
      label: note.title,
      detail: note.content,
      note,
    }));
    const createItem: PaletteItem[] = query
      ? [{ id: 'create-query', kind: 'create', label: `Create “${this.commandQuery().trim()}”`, detail: 'Start a new note' }]
      : [];

    return [...commandItems, ...noteItems, ...createItem];
  });
  private readonly paletteSearch$ = new Subject<string>();
  private readonly autosave$ = new Subject<string>();
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly capturePaletteEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !this.notes.commandPaletteOpen()) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.closeCommandPalette();
    this.changeDetectorRef.detectChanges();
  };

  constructor(
    readonly auth: AuthStore,
    readonly notes: NotesStore,
    readonly api: ApiService,
    readonly theme: ThemeStore,
  ) {
    document.addEventListener('keydown', this.capturePaletteEscape, true);
    this.destroyRef.onDestroy(() => document.removeEventListener('keydown', this.capturePaletteEscape, true));

    this.paletteSearch$
      .pipe(debounceTime(220), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => this.notes.searchPalette(value));

    this.autosave$
      .pipe(debounceTime(2500), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.notes.save(true));

    effect(() => {
      if (this.notes.commandPaletteOpen()) {
        this.initializePalette();
      }
    });
  }

  @HostListener('document:click')
  closeContextMenu() {
    this.contextMenu.set(null);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const editing = target?.matches('input, textarea, [contenteditable="true"]') ?? false;
    const commandKey = event.ctrlKey || event.metaKey;

    if (commandKey && target?.tagName === 'TEXTAREA' && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      this.applyMarkdown(target as HTMLTextAreaElement, '**');
      return;
    }

    if (commandKey && target?.tagName === 'TEXTAREA' && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      this.applyMarkdown(target as HTMLTextAreaElement, '_');
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeContextMenu();
      this.closeMobilePanel();
      return;
    }

    if (commandKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openCommandPalette();
      return;
    }

    if (commandKey && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      this.createNewNote();
      return;
    }

    if (commandKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.notes.save();
      return;
    }

    if (!editing && event.key === '/') {
      event.preventDefault();
      this.openCommandPalette();
    }
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

  createNewNote(title = '') {
    this.afterDraftSaved(() => {
      this.notes.clearSelection();
      if (title) {
        this.notes.updateDraft('title', title);
      }
      this.closeMobilePanel();
      this.notes.commandPaletteOpen.set(false);
      setTimeout(() => this.titleInput?.nativeElement.focus());
    });
  }

  selectNote(note: Note) {
    this.afterDraftSaved(() => {
      this.notes.select(note);
      this.closeMobilePanel();
    });
  }

  switchView(view: 'active' | 'archived') {
    this.afterDraftSaved(() => this.notes.switchView(view));
  }

  updateDraft(field: 'title' | 'content', value: string) {
    this.notes.updateDraft(field, value);
    this.scheduleAutosave();
  }

  updateTags(value: string) {
    this.notes.updateTagsFromText(value);
    this.scheduleAutosave();
  }

  setDateFilter(value: string) {
    this.notes.setDateFilter(value as NoteDateFilter);
  }

  openCommandPalette() {
    if (this.notes.commandPaletteOpen()) {
      this.initializePalette();
    } else {
      this.notes.commandPaletteOpen.set(true);
    }
  }

  closeCommandPalette(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    this.notes.commandPaletteOpen.set(false);
  }

  handlePaletteFocusOut(event: FocusEvent) {
    const palette = event.currentTarget as HTMLElement;
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && palette.contains(nextTarget)) {
      return;
    }

    this.closeCommandPalette();
  }

  updatePaletteQuery(value: string) {
    const normalized = value.startsWith('/') ? value.slice(1) : value;
    this.commandQuery.set(normalized);
    this.paletteIndex.set(0);

    const query = normalized.trim().toLowerCase();
    const localMatches = this.notes.currentNotes()
      .filter((note) => !query || note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query))
      .slice(0, 8);
    this.notes.paletteResults.set(localMatches);
    this.paletteSearch$.next(normalized);
  }

  handlePaletteKeyboard(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.closeCommandPalette(event);
      return;
    }

    const items = this.paletteItems();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      this.movePaletteSelection(1, items.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      this.movePaletteSelection(-1, items.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const item = items[this.paletteIndex()];
      if (item) {
        this.activatePaletteItem(item);
      }
    }
  }

  activatePaletteItem(item: PaletteItem) {
    if (item.kind === 'note' && item.note) {
      this.selectNote(item.note);
      this.closeCommandPalette();
      return;
    }

    if (item.kind === 'create') {
      this.createNewNote(this.commandQuery().trim());
      return;
    }

    if (item.command) {
      this.runCommand(item.command);
    }
  }

  runCommand(command: CommandId) {
    if (command === 'new') {
      this.createNewNote();
    } else if (command === 'save') {
      this.notes.save();
    } else {
      this.theme.toggle();
    }
    this.notes.commandPaletteOpen.set(false);
  }

  applyMarkdown(textarea: HTMLTextAreaElement, before: string, after = before) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const content = this.notes.draft().content;
    const selected = content.slice(start, end);
    const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`;
    this.updateDraft('content', next);

    setTimeout(() => {
      textarea.focus();
      const cursorStart = start + before.length;
      textarea.setSelectionRange(cursorStart, cursorStart + selected.length);
    });
  }

  prefixMarkdown(textarea: HTMLTextAreaElement, prefix: string) {
    const start = textarea.selectionStart;
    const content = this.notes.draft().content;
    const lineStart = content.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const next = `${content.slice(0, lineStart)}${prefix}${content.slice(lineStart)}`;
    this.updateDraft('content', next);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  }

  highlightParts(text: string): HighlightPart[] {
    const query = this.notes.searchQuery().trim();
    if (!query) {
      return [{ text, match: false }];
    }

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(`(${escaped})`, 'ig');
    return text.split(matcher).filter(Boolean).map((part) => ({
      text: part,
      match: part.toLowerCase() === query.toLowerCase(),
    }));
  }

  private afterDraftSaved(action: () => void) {
    if (this.notes.saveState() === 'dirty' || this.notes.saveState() === 'saving') {
      this.notes.save(true, action);
      return;
    }
    action();
  }

  private scheduleAutosave() {
    const draft = this.notes.draft();
    const fingerprint = JSON.stringify({
      title: draft.title.trim(),
      content: draft.content.trim(),
      tags: [...draft.tags].map((tag) => tag.trim().toLowerCase()).filter(Boolean).sort(),
    });
    this.autosave$.next(fingerprint);
  }

  private initializePalette() {
    this.commandQuery.set('');
    this.paletteIndex.set(0);
    this.notes.searchPalette('');
    setTimeout(() => this.commandInput?.nativeElement.focus());
  }

  private movePaletteSelection(direction: 1 | -1, itemCount: number) {
    if (!itemCount) {
      return;
    }

    this.paletteIndex.update((index) => (index + direction + itemCount) % itemCount);
    setTimeout(() => {
      this.commandList?.nativeElement.querySelector<HTMLButtonElement>('button.active')?.scrollIntoView({ block: 'nearest' });
    });
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
