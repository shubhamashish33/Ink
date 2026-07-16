import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArchive, LucideEdit3, LucidePin, LucideSearch, LucideShieldCheck, LucideTags, LucideX } from '@lucide/angular';

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, LucideArchive, LucideEdit3, LucidePin, LucideSearch, LucideShieldCheck, LucideTags, LucideX],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPage {
  readonly whatsNewOpen = signal(localStorage.getItem('ink.whatsNew.v1') !== 'dismissed');

  constructor() {
    queueMicrotask(() => this.track('page_view'));
  }

  dismissWhatsNew() {
    localStorage.setItem('ink.whatsNew.v1', 'dismissed');
    this.whatsNewOpen.set(false);
  }

  track(event: 'page_view' | 'register_click' | 'login_click') {
    const body = JSON.stringify({ event, path: location.pathname });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/public/analytics', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/public/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
  }
}
