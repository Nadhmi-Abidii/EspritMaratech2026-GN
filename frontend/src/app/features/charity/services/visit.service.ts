import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, finalize, map, tap } from 'rxjs';
import { API_BASE_URL } from 'src/app/core/config/api.config';
import { ApiSuccessResponse } from 'src/app/core/models/api.models';
import {
  VisitFilters,
  VisitPayload,
  Visite,
} from 'src/app/core/models/charity.models';
import { buildHttpParams } from 'src/app/core/utils/http.util';

@Injectable({
  providedIn: 'root',
})
export class VisitService {
  private readonly endpoint = `${API_BASE_URL}/visites`;
  private readonly visitsSubject = new BehaviorSubject<Visite[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);

  readonly visits$ = this.visitsSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  loadVisits(filters?: VisitFilters): Observable<Visite[]> {
    this.loadingSubject.next(true);

    return this.http
      .get<ApiSuccessResponse<Visite[]>>(this.endpoint, {
        params: buildHttpParams(filters as Record<string, string | number | boolean | undefined>),
      })
      .pipe(
        map((response) => response.data),
        tap((visits) => this.visitsSubject.next(visits)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  loadVisitsForFamily(
    familyId: string,
    filters?: Omit<VisitFilters, 'familleId'>
  ): Observable<Visite[]> {
    this.loadingSubject.next(true);

    return this.http
      .get<ApiSuccessResponse<Visite[]>>(`${API_BASE_URL}/familles/${familyId}/visites`, {
        params: buildHttpParams(
          (filters || {}) as Record<string, string | number | boolean | undefined>
        ),
      })
      .pipe(
        map((response) => response.data),
        tap((visits) => this.visitsSubject.next(visits)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  createVisit(payload: VisitPayload): Observable<Visite> {
    this.loadingSubject.next(true);

    return this.http
      .post<ApiSuccessResponse<Visite>>(this.endpoint, payload)
      .pipe(
        map((response) => response.data),
        tap((visit) => this.visitsSubject.next([visit, ...this.visitsSubject.value])),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  updateVisit(id: string, payload: Partial<VisitPayload>): Observable<Visite> {
    this.loadingSubject.next(true);

    return this.http
      .patch<ApiSuccessResponse<Visite>>(`${this.endpoint}/${id}`, payload)
      .pipe(
        map((response) => response.data),
        tap((updated) => {
          const next = this.visitsSubject.value.map((visit) =>
            visit._id === updated._id ? updated : visit
          );
          this.visitsSubject.next(next);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  deleteVisit(id: string): Observable<void> {
    this.loadingSubject.next(true);

    return this.http
      .delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `${this.endpoint}/${id}`
      )
      .pipe(
        tap(() => {
          const next = this.visitsSubject.value.filter((visit) => visit._id !== id);
          this.visitsSubject.next(next);
        }),
        map(() => void 0),
        finalize(() => this.loadingSubject.next(false))
      );
  }
}
