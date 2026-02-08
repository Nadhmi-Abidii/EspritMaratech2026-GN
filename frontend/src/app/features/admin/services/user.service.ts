import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, finalize, map, tap } from 'rxjs';
import { API_BASE_URL } from 'src/app/core/config/api.config';
import { ApiSuccessResponse } from 'src/app/core/models/api.models';
import {
  ManagedUser,
  UserCreatePayload,
  UserFilters,
  UserUpdatePayload,
} from 'src/app/core/models/user.models';
import { buildHttpParams } from 'src/app/core/utils/http.util';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly endpoint = `${API_BASE_URL}/users`;
  private readonly usersSubject = new BehaviorSubject<ManagedUser[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);

  readonly users$ = this.usersSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  loadUsers(filters?: UserFilters): Observable<ManagedUser[]> {
    this.loadingSubject.next(true);

    return this.http
      .get<ApiSuccessResponse<ManagedUser[]>>(this.endpoint, {
        params: buildHttpParams(
          filters as Record<string, string | number | boolean | undefined>
        ),
      })
      .pipe(
        map((response) => response.data),
        tap((users) => this.usersSubject.next(users)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  createUser(payload: UserCreatePayload): Observable<ManagedUser> {
    this.loadingSubject.next(true);

    return this.http
      .post<ApiSuccessResponse<ManagedUser>>(this.endpoint, payload)
      .pipe(
        map((response) => response.data),
        tap((created) => this.usersSubject.next([created, ...this.usersSubject.value])),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  updateUser(id: string, payload: UserUpdatePayload): Observable<ManagedUser> {
    this.loadingSubject.next(true);

    return this.http
      .patch<ApiSuccessResponse<ManagedUser>>(`${this.endpoint}/${id}`, payload)
      .pipe(
        map((response) => response.data),
        tap((updated) => {
          const next = this.usersSubject.value.map((user) =>
            user._id === updated._id ? updated : user
          );
          this.usersSubject.next(next);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  deleteUser(id: string): Observable<ManagedUser> {
    this.loadingSubject.next(true);

    return this.http
      .delete<ApiSuccessResponse<ManagedUser>>(`${this.endpoint}/${id}`)
      .pipe(
        map((response) => response.data),
        tap((deletedUser) => {
          const next = this.usersSubject.value.filter((user) => user._id !== deletedUser._id);
          this.usersSubject.next(next);
        }),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  deactivateUser(id: string): Observable<ManagedUser> {
    return this.deleteUser(id);
  }
}
