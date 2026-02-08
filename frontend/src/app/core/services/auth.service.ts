import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { Router } from '@angular/router';
import { API_BASE_URL, AUTH_STORAGE_KEY } from '../config/api.config';
import {
  AuthSession,
  AuthUser,
  LoginRequest,
  LoginResponse,
  UserRole,
} from '../models/auth.models';
import { ApiSuccessResponse } from '../models/api.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly endpoint = `${API_BASE_URL}`;
  private readonly sessionSubject = new BehaviorSubject<AuthSession | null>(
    this.readSession()
  );

  readonly session$ = this.sessionSubject.asObservable();

  readonly user$ = this.session$.pipe(map((session) => session?.user ?? null));

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  login(payload: LoginRequest): Observable<AuthSession> {
    return this.http
      .post<ApiSuccessResponse<LoginResponse>>(`${this.endpoint}/login`, payload)
      .pipe(
        map((response) => ({ token: response.data.token, user: response.data.user })),
        tap((session) => this.persistSession(session))
      );
  }

  getMe(): Observable<AuthUser> {
    return this.http
      .get<ApiSuccessResponse<AuthUser>>(`${this.endpoint}/me`)
      .pipe(
        map((response) => response.data),
        tap((user) => {
          const current = this.sessionSubject.value;

          if (!current?.token) {
            return;
          }

          this.persistSession({
            token: current.token,
            user,
          });
        })
      );
  }

  logout(redirect = true): void {
    this.clearSession();

    if (redirect) {
      this.router.navigate(['/authentication/login']);
    }
  }

  clearSession(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    this.sessionSubject.next(null);
  }

  getToken(): string | null {
    return this.sessionSubject.value?.token ?? null;
  }

  getCurrentUser(): AuthUser | null {
    return this.sessionSubject.value?.user ?? null;
  }

  isAuthenticated(): boolean {
    const token = this.getToken();

    if (!token) {
      return false;
    }

    if (this.isTokenExpired(token)) {
      this.clearSession();
      return false;
    }

    return true;
  }

  hasRole(role: UserRole): boolean {
    return this.getCurrentUser()?.role === role;
  }

  hasAnyRole(roles: readonly UserRole[]): boolean {
    const role = this.getCurrentUser()?.role;
    return !!role && roles.includes(role);
  }

  getAssignedZones(): string[] {
    return [...(this.getCurrentUser()?.assignedZones ?? [])];
  }

  getCurrentZone(): string | null {
    const zones = this.getAssignedZones();
    return zones.length > 0 ? zones[0] : null;
  }

  private persistSession(session: AuthSession): void {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    this.sessionSubject.next(session);
  }

  private readSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as AuthSession;

      if (!parsed?.token || !parsed?.user) {
        return null;
      }

      if (this.isTokenExpired(parsed.token)) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }

      return parsed;
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payloadChunk = token.split('.')[1];

      if (!payloadChunk) {
        return true;
      }

      const normalized = payloadChunk.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(normalized)) as { exp?: number };

      if (!payload.exp) {
        return true;
      }

      return payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }
}
