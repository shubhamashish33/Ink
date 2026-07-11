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

  dismissWhatsNew() {
    localStorage.setItem('ink.whatsNew.v1', 'dismissed');
    this.whatsNewOpen.set(false);
  }
}
