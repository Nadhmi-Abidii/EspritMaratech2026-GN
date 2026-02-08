import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, finalize, map, tap } from 'rxjs';
import { API_BASE_URL } from 'src/app/core/config/api.config';
import { ApiSuccessResponse } from 'src/app/core/models/api.models';
import {
  ZoneCreatePayload,
  ZoneItem,
  ZoneUpdatePayload,
} from 'src/app/core/models/charity.models';
import { buildHttpParams } from 'src/app/core/utils/http.util';

interface ZoneFilters {
  search?: string;
  responsibleId?: string;
  page?: number;
  limit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ZoneService {
  private readonly endpoint = `${API_BASE_URL}/zones`;
  private readonly zonesSubject = new BehaviorSubject<ZoneItem[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);

  readonly zones$ = this.zonesSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  loadZones(filters?: ZoneFilters): Observable<ZoneItem[]> {
    this.loadingSubject.next(true);

    return this.http
      .get<ApiSuccessResponse<ZoneItem[]>>(this.endpoint, {
        params: buildHttpParams(filters as Record<string, string | number | boolean | undefined>),
      })
      .pipe(
        map((response) => response.data),
        tap((zones) => this.zonesSubject.next(zones)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  getZone(id: string): Observable<ZoneItem> {
    return this.http
      .get<ApiSuccessResponse<ZoneItem>>(`${this.endpoint}/${id}`)
      .pipe(map((response) => response.data));
  }

  createZone(payload: ZoneCreatePayload): Observable<ZoneItem> {
    this.loadingSubject.next(true);

    return this.http
      .post<ApiSuccessResponse<ZoneItem>>(this.endpoint, payload)
      .pipe(
        map((response) => response.data),
        tap((zone) => this.zonesSubject.next([zone, ...this.zonesSubject.value])),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  updateZone(id: string, payload: ZoneUpdatePayload): Observable<ZoneItem> {
    this.loadingSubject.next(true);

    return this.http
      .patch<ApiSuccessResponse<ZoneItem>>(`${this.endpoint}/${id}`, payload)
      .pipe(
        map((response) => response.data),
        tap((updatedZone) => {
          const next = this.zonesSubject.value.map((zone) =>
            zone._id === updatedZone._id ? updatedZone : zone
          );
          this.zonesSubject.next(next);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  deleteZone(id: string): Observable<void> {
    this.loadingSubject.next(true);

    return this.http
      .delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(`${this.endpoint}/${id}`)
      .pipe(
        tap(() => {
          const next = this.zonesSubject.value.filter((zone) => zone._id !== id);
          this.zonesSubject.next(next);
        }),
        map(() => void 0),
        finalize(() => this.loadingSubject.next(false))
      );
  }
}
