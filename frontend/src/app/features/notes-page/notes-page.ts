import { Component } from '@angular/core';
import { NotesShell } from '../notes/notes-shell';

@Component({
  selector: 'app-notes-page',
  imports: [NotesShell],
  template: '<section class="workspace-grid"><app-notes-shell /></section>',
  styles: [`
    :host {
      display: block;
    }

    .workspace-grid {
      display: grid;
      grid-template-columns: minmax(280px, 330px) minmax(0, 1fr);
      min-height: calc(100dvh - 64px);
    }

    @media (max-width: 940px) {
      .workspace-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class NotesPage {}
