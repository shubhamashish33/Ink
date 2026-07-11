import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArchive, LucideEdit3, LucidePin, LucideSearch, LucideShieldCheck, LucideTags } from '@lucide/angular';

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, LucideArchive, LucideEdit3, LucidePin, LucideSearch, LucideShieldCheck, LucideTags],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPage {}
