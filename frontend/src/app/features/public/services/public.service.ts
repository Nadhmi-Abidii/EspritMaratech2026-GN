import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, interval, map, of, startWith, switchMap, tap } from 'rxjs';
import { API_BASE_URL } from 'src/app/core/config/api.config';
import { ApiSuccessResponse } from 'src/app/core/models/api.models';
import {
  PublicChatbotAskPayload,
  PublicChatbotReply,
  PublicImpactPayload,
  PublicInfoPayload,
  PublicPostCreatePayload,
  PublicPostDonationCheckout,
  PublicPostDonationConfirmation,
  PublicPostDonationPayload,
  PublicPostItem,
  PublicPostUpdatePayload,
  PublicReportType,
  PublicReportsPayload,
} from 'src/app/core/models/public.models';
import { buildHttpParams } from 'src/app/core/utils/http.util';

interface ReportFilters {
  search?: string;
  type?: PublicReportType;
  year?: number;
}

@Injectable({
  providedIn: 'root',
})
export class PublicService {
  private readonly endpoint = `${API_BASE_URL}/public`;
  private readonly postsEndpoint = `${this.endpoint}/posts`;
  private readonly postsSubject = new BehaviorSubject<PublicPostItem[]>([]);
  readonly posts$ = this.postsSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  getInfo(): Observable<PublicInfoPayload> {
    return this.http
      .get<ApiSuccessResponse<PublicInfoPayload>>(`${this.endpoint}/info`)
      .pipe(map((response) => response.data));
  }

  getImpact(): Observable<PublicImpactPayload> {
    return this.http
      .get<ApiSuccessResponse<PublicImpactPayload>>(`${this.endpoint}/impact`)
      .pipe(map((response) => response.data));
  }

  getReports(filters?: ReportFilters): Observable<PublicReportsPayload> {
    return this.http
      .get<ApiSuccessResponse<PublicReportsPayload>>(`${this.endpoint}/reports`, {
        params: buildHttpParams(filters as Record<string, string | number | boolean | undefined>),
      })
      .pipe(map((response) => response.data));
  }

  loadPosts(limit = 24): Observable<PublicPostItem[]> {
    return this.http
      .get<ApiSuccessResponse<PublicPostItem[]>>(this.postsEndpoint, {
        params: buildHttpParams({ limit }),
      })
      .pipe(
        map((response) => response.data),
        tap((posts) => this.postsSubject.next(posts))
      );
  }

  watchPosts(intervalMs = 10000, limit = 24): Observable<PublicPostItem[]> {
    return interval(intervalMs).pipe(
      startWith(0),
      switchMap(() =>
        this.loadPosts(limit).pipe(catchError(() => of(this.postsSubject.value)))
      )
    );
  }

  createPost(payload: PublicPostCreatePayload): Observable<PublicPostItem> {
    return this.http
      .post<ApiSuccessResponse<PublicPostItem>>(this.postsEndpoint, payload)
      .pipe(
        map((response) => response.data),
        tap((createdPost) => {
          this.postsSubject.next([createdPost, ...this.postsSubject.value]);
        })
      );
  }

  updatePost(postId: string, payload: PublicPostUpdatePayload): Observable<PublicPostItem> {
    return this.http
      .patch<ApiSuccessResponse<PublicPostItem>>(`${this.postsEndpoint}/${postId}`, payload)
      .pipe(
        map((response) => response.data),
        tap((updatedPost) => {
          const nextPosts = this.postsSubject.value.map((post) =>
            post._id === updatedPost._id ? updatedPost : post
          );
          this.postsSubject.next(nextPosts);
        })
      );
  }

  deletePost(postId: string): Observable<void> {
    return this.http
      .delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(`${this.postsEndpoint}/${postId}`)
      .pipe(
        tap(() => {
          const nextPosts = this.postsSubject.value.filter((post) => post._id !== postId);
          this.postsSubject.next(nextPosts);
        }),
        map(() => void 0)
      );
  }

  donateToPost(postId: string, payload: PublicPostDonationPayload): Observable<PublicPostItem> {
    return this.http
      .post<ApiSuccessResponse<PublicPostItem>>(`${this.postsEndpoint}/${postId}/donations`, payload)
      .pipe(
        map((response) => response.data),
        tap((updatedPost) => {
          const nextPosts = this.postsSubject.value.map((post) =>
            post._id === updatedPost._id ? updatedPost : post
          );
          this.postsSubject.next(nextPosts);
        })
      );
  }

  createDonationCheckout(
    postId: string,
    payload: PublicPostDonationPayload
  ): Observable<PublicPostDonationCheckout> {
    return this.http
      .post<ApiSuccessResponse<PublicPostDonationCheckout>>(
        `${this.postsEndpoint}/${postId}/donations/checkout`,
        payload
      )
      .pipe(map((response) => response.data));
  }

  confirmDonation(
    postId: string,
    sessionId: string
  ): Observable<PublicPostDonationConfirmation> {
    return this.http
      .post<ApiSuccessResponse<PublicPostDonationConfirmation>>(
        `${this.postsEndpoint}/${postId}/donations/confirm`,
        {
          sessionId,
        }
      )
      .pipe(
        map((response) => response.data),
        tap((confirmation) => {
          const nextPosts = this.postsSubject.value.map((post) =>
            post._id === confirmation.post._id ? confirmation.post : post
          );

          if (!nextPosts.some((post) => post._id === confirmation.post._id)) {
            nextPosts.unshift(confirmation.post);
          }

          this.postsSubject.next(nextPosts);
        })
      );
  }

  askChatbot(payload: PublicChatbotAskPayload): Observable<PublicChatbotReply> {
    return this.http
      .post<ApiSuccessResponse<PublicChatbotReply>>(`${this.endpoint}/chatbot/ask`, payload)
      .pipe(map((response) => response.data));
  }
}
