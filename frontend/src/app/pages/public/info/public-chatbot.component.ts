import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-public-chatbot',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './public-chatbot.component.html',
  styleUrl: './public-chatbot.component.scss',
})
export class PublicChatbotComponent {
  readonly chatUrl: SafeResourceUrl;
  isOpen = false;

  constructor(private readonly sanitizer: DomSanitizer) {
    this.chatUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://agent.hellotars.com/conv/dOPnsK'
    );
  }

  toggleWidget(): void {
    this.isOpen = !this.isOpen;
  }

  closeWidget(): void {
    this.isOpen = false;
  }
}
