import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, finalize, map, tap } from 'rxjs';
import { API_BASE_URL } from 'src/app/core/config/api.config';
import { ApiSuccessResponse } from 'src/app/core/models/api.models';
import { AidFilters, AidPayload, Aide } from 'src/app/core/models/charity.models';
import { buildHttpParams } from 'src/app/core/utils/http.util';

@Injectable({
  providedIn: 'root',
})
export class AidService {
  private readonly endpoint = `${API_BASE_URL}/aides`;
  private readonly aidsSubject = new BehaviorSubject<Aide[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);

  readonly aids$ = this.aidsSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  loadAids(filters?: AidFilters): Observable<Aide[]> {
    this.loadingSubject.next(true);

    return this.http
      .get<ApiSuccessResponse<Aide[]>>(this.endpoint, {
        params: buildHttpParams(filters as Record<string, string | number | boolean | undefined>),
      })
      .pipe(
        map((response) => response.data),
        tap((aids) => this.aidsSubject.next(aids)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  getAid(id: string): Observable<Aide> {
    this.loadingSubject.next(true);

    return this.http.get<ApiSuccessResponse<Aide>>(`${this.endpoint}/${id}`).pipe(
      map((response) => response.data),
      finalize(() => this.loadingSubject.next(false))
    );
  }

  loadAidsForFamily(familyId: string, filters?: Omit<AidFilters, 'familleId'>): Observable<Aide[]> {
    this.loadingSubject.next(true);

    return this.http
      .get<ApiSuccessResponse<Aide[]>>(`${API_BASE_URL}/familles/${familyId}/aides`, {
        params: buildHttpParams(
          (filters || {}) as Record<string, string | number | boolean | undefined>
        ),
      })
      .pipe(
        map((response) => response.data),
        tap((aids) => this.aidsSubject.next(aids)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  createAid(payload: AidPayload): Observable<Aide> {
    this.loadingSubject.next(true);

    return this.http
      .post<ApiSuccessResponse<Aide>>(this.endpoint, payload)
      .pipe(
        map((response) => response.data),
        tap((aid) => this.aidsSubject.next([aid, ...this.aidsSubject.value])),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  updateAid(id: string, payload: Partial<AidPayload>): Observable<Aide> {
    this.loadingSubject.next(true);

    return this.http
      .put<ApiSuccessResponse<Aide>>(`${this.endpoint}/${id}`, payload)
      .pipe(
        map((response) => response.data),
        tap((updated) => {
          const next = this.aidsSubject.value.map((aid) =>
            aid._id === updated._id ? updated : aid
          );
          this.aidsSubject.next(next);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  deleteAid(id: string): Observable<void> {
    this.loadingSubject.next(true);

    return this.http
      .delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `${this.endpoint}/${id}`
      )
      .pipe(
        tap(() => {
          const next = this.aidsSubject.value.filter((aid) => aid._id !== id);
          this.aidsSubject.next(next);
        }),
        map(() => void 0),
        finalize(() => this.loadingSubject.next(false))
      );
  }
}
