import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { ChatbotService } from 'src/app/core/services/chatbot.service';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss']
})
export class ChatbotComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  messages: Message[] = [];
  userInput: string = '';
  isLoading = false;
  isOpen = false;

  private messageIdCounter = 0;

  constructor(private chatbotService: ChatbotService) {}

  ngOnInit(): void {
    // No-op: the backend holds the OpenAI key, so the widget is ready to use.
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  /**
   * Toggle chatbot visibility
   */
  toggleChatbot(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.messages.length === 0) {
      this.addGreetingMessage();
    }
  }

  /**
   * Send a message to ChatGPT
   */
  sendMessage(): void {
    if (!this.userInput.trim() || this.isLoading) {
      return;
    }

    // Add user message to UI
    this.addMessage('user', this.userInput);
    const userText = this.userInput;
    this.userInput = '';

    // Send to chatbot service
    this.isLoading = true;
    const loadingMessageId = this.addLoadingMessage();

    this.chatbotService.sendMessage(userText).subscribe({
      next: (response: string) => {
        this.removeMessage(loadingMessageId);
        this.addMessage('assistant', response);
        this.isLoading = false;
      },
      error: (error: Error) => {
        this.removeMessage(loadingMessageId);
        const errorMessage = error.message === 'API key not configured'
          ? 'Please set your OpenAI API key to use the chatbot.'
          : error.message || 'Sorry, something went wrong. Please try again.';
        this.addMessage('assistant', errorMessage);
        this.isLoading = false;
      }
    });
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    if (confirm('Are you sure you want to clear the conversation history?')) {
      this.messages = [];
      this.chatbotService.clearHistory();
      this.addGreetingMessage();
    }
  }

  /**
   * Add a message to the conversation
   */
  private addMessage(role: 'user' | 'assistant', content: string): void {
    const message: Message = {
      id: `msg-${this.messageIdCounter++}`,
      role,
      content,
      timestamp: new Date()
    };
    this.messages.push(message);
  }

  /**
   * Add a loading message
   */
  private addLoadingMessage(): string {
    const messageId = `msg-${this.messageIdCounter++}`;
    this.messages.push({
      id: messageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    });
    return messageId;
  }

  /**
   * Remove a message by id
   */
  private removeMessage(messageId: string): void {
    this.messages = this.messages.filter(msg => msg.id !== messageId);
  }

  /**
   * Add a greeting message
   */
  private addGreetingMessage(): void {
    this.addMessage(
      'assistant',
      `Welcome to Omnia Charity Support!\n\nI'm here to help answer your questions about our mission, programs, and impact. Feel free to ask about donations, reports, or how we help families in need.`
    );
  }

  /**
   * Scroll to the bottom of the message container
   */
  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = 
          this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.warn('Scroll error:', err);
    }
  }
}
