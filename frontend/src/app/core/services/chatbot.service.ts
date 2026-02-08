import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { API_BASE_URL } from 'src/app/core/config/api.config';
import { ApiSuccessResponse } from 'src/app/core/models/api.models';
import {
  PublicChatbotAskPayload,
  PublicChatbotHistoryItem,
  PublicChatbotReply,
} from 'src/app/core/models/public.models';

@Injectable({
  providedIn: 'root',
})
export class ChatbotService {
  private readonly endpoint = `${API_BASE_URL}/public/chatbot/ask`;
  private conversationHistory: PublicChatbotHistoryItem[] = [];

  constructor(private readonly http: HttpClient) {}

  sendMessage(userMessage: string): Observable<string> {
    const message = userMessage.trim();

    if (!message) {
      return throwError(() => new Error('Message cannot be empty'));
    }

    const history = this.conversationHistory.slice(-8);

    // Keep history in sync with the UI (user message is already sent).
    this.conversationHistory.push({ role: 'user', content: message });

    const payload: PublicChatbotAskPayload = {
      message,
      history,
    };

    return this.http
      .post<ApiSuccessResponse<PublicChatbotReply>>(this.endpoint, payload)
      .pipe(
        map((response) => {
          const reply = response.data.reply || '';
          this.conversationHistory.push({ role: 'assistant', content: reply });
          return reply;
        }),
        catchError((error) => {
          const status = Number(error?.status || 0);
          const messageFromServer =
            error?.error?.error?.message ||
            error?.message ||
            'Failed to get a response from the assistant.';

          if (status === 429) {
            return throwError(() => new Error('Too many requests. Please try again later.'));
          }

          if (status === 502 || status === 503) {
            return throwError(() =>
              new Error('Assistant is temporarily unavailable. Please try again later.')
            );
          }

          if (status === 504) {
            return throwError(() => new Error('Assistant request timed out. Please try again.'));
          }

          return throwError(() => new Error(messageFromServer));
        })
      );
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  getHistory(): PublicChatbotHistoryItem[] {
    return [...this.conversationHistory];
  }
}
