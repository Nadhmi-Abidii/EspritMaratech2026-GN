import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, finalize, map, tap } from 'rxjs';
import { API_BASE_URL } from 'src/app/core/config/api.config';
import { ApiSuccessResponse } from 'src/app/core/models/api.models';
import {
  Beneficiaire,
  BeneficiaryFilters,
  BeneficiaryPayload,
} from 'src/app/core/models/charity.models';
import { buildHttpParams } from 'src/app/core/utils/http.util';

@Injectable({
  providedIn: 'root',
})
export class BeneficiaryService {
  private readonly endpoint = `${API_BASE_URL}/beneficiaires`;
  private readonly beneficiariesSubject = new BehaviorSubject<Beneficiaire[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);

  readonly beneficiaries$ = this.beneficiariesSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  loadBeneficiaries(filters?: BeneficiaryFilters): Observable<Beneficiaire[]> {
    this.loadingSubject.next(true);

    return this.http
      .get<ApiSuccessResponse<Beneficiaire[]>>(this.endpoint, {
        params: buildHttpParams(filters as Record<string, string | number | boolean | undefined>),
      })
      .pipe(
        map((response) => response.data),
        tap((beneficiaries) => this.beneficiariesSubject.next(beneficiaries)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  loadBeneficiariesForFamily(
    familyId: string,
    filters?: Omit<BeneficiaryFilters, 'familleId'>
  ): Observable<Beneficiaire[]> {
    this.loadingSubject.next(true);

    return this.http
      .get<ApiSuccessResponse<Beneficiaire[]>>(
        `${API_BASE_URL}/familles/${familyId}/beneficiaires`,
        {
          params: buildHttpParams(
            (filters || {}) as Record<string, string | number | boolean | undefined>
          ),
        }
      )
      .pipe(
        map((response) => response.data),
        tap((beneficiaries) => this.beneficiariesSubject.next(beneficiaries)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  createBeneficiary(payload: BeneficiaryPayload): Observable<Beneficiaire> {
    this.loadingSubject.next(true);

    return this.http
      .post<ApiSuccessResponse<Beneficiaire>>(this.endpoint, payload)
      .pipe(
        map((response) => response.data),
        tap((beneficiary) => {
          this.beneficiariesSubject.next([
            beneficiary,
            ...this.beneficiariesSubject.value,
          ]);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  updateBeneficiary(
    id: string,
    payload: Partial<BeneficiaryPayload>
  ): Observable<Beneficiaire> {
    this.loadingSubject.next(true);

    return this.http
      .patch<ApiSuccessResponse<Beneficiaire>>(`${this.endpoint}/${id}`, payload)
      .pipe(
        map((response) => response.data),
        tap((updated) => {
          const next = this.beneficiariesSubject.value.map((beneficiary) =>
            beneficiary._id === updated._id ? updated : beneficiary
          );
          this.beneficiariesSubject.next(next);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  deleteBeneficiary(id: string): Observable<void> {
    this.loadingSubject.next(true);

    return this.http
      .delete<ApiSuccessResponse<{ id: string; deleted: boolean }>>(
        `${this.endpoint}/${id}`
      )
      .pipe(
        tap(() => {
          const next = this.beneficiariesSubject.value.filter(
            (beneficiary) => beneficiary._id !== id
          );
          this.beneficiariesSubject.next(next);
        }),
        map(() => void 0),
        finalize(() => this.loadingSubject.next(false))
      );
  }
}
