import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeStore {
  readonly dark = signal(localStorage.getItem('ink.theme') === 'dark');

  toggle() {
    this.dark.update((value) => {
      const next = !value;
      localStorage.setItem('ink.theme', next ? 'dark' : 'light');
      return next;
    });
  }
}
