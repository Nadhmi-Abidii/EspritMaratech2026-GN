import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, finalize, map, tap } from 'rxjs';
import { API_BASE_URL } from 'src/app/core/config/api.config';
import { ApiSuccessResponse } from 'src/app/core/models/api.models';
import {
  Famille,
  FamilyFilters,
  FamilyPayload,
} from 'src/app/core/models/charity.models';
import { buildHttpParams } from 'src/app/core/utils/http.util';

@Injectable({
  providedIn: 'root',
})
export class FamilyService {
  private readonly endpoint = `${API_BASE_URL}/familles`;
  private readonly familiesSubject = new BehaviorSubject<Famille[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);

  readonly families$ = this.familiesSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  loadFamilies(filters?: FamilyFilters): Observable<Famille[]> {
    this.loadingSubject.next(true);

    return this.http
      .get<ApiSuccessResponse<Famille[]>>(this.endpoint, {
        params: buildHttpParams(filters as Record<string, string | number | boolean | undefined>),
      })
      .pipe(
        map((response) => response.data),
        tap((families) => this.familiesSubject.next(families)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  getFamily(id: string): Observable<Famille> {
    return this.http
      .get<ApiSuccessResponse<Famille>>(`${this.endpoint}/${id}`)
      .pipe(map((response) => response.data));
  }

  createFamily(payload: FamilyPayload): Observable<Famille> {
    this.loadingSubject.next(true);

    return this.http
      .post<ApiSuccessResponse<Famille>>(this.endpoint, payload)
      .pipe(
        map((response) => response.data),
        tap((family) => {
          this.familiesSubject.next([family, ...this.familiesSubject.value]);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  updateFamily(id: string, payload: Partial<FamilyPayload>): Observable<Famille> {
    this.loadingSubject.next(true);

    return this.http
      .patch<ApiSuccessResponse<Famille>>(`${this.endpoint}/${id}`, payload)
      .pipe(
        map((response) => response.data),
        tap((updated) => {
          const next = this.familiesSubject.value.map((family) =>
            family._id === updated._id ? updated : family
          );

          this.familiesSubject.next(next);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  deleteFamily(id: string): Observable<void> {
    this.loadingSubject.next(true);

    return this.http
      .delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `${this.endpoint}/${id}`
      )
      .pipe(
        tap(() => {
          const next = this.familiesSubject.value.filter((family) => family._id !== id);
          this.familiesSubject.next(next);
        }),
        map(() => void 0),
        finalize(() => this.loadingSubject.next(false))
      );
  }
}