import { inject } from '@angular/core';
import {
  CanActivateFn,
  CanLoadFn,
  Route,
  Router,
  UrlSegment,
  UrlTree,
} from '@angular/router';
import { UserRole } from '../models/auth.models';
import { AuthService } from '../services/auth.service';

const VALID_ROLES: UserRole[] = ['admin', 'coordinator', 'responsible', 'volunteer'];

const extractRoles = (route: Pick<Route, 'data'>): UserRole[] => {
  const roles = route.data?.['roles'];

  if (!Array.isArray(roles)) {
    return [];
  }

  return roles.filter(
    (role): role is UserRole =>
      typeof role === 'string' && (VALID_ROLES as string[]).includes(role)
  );
};

const denyForUnauthenticated = (router: Router, returnUrl?: string): UrlTree =>
  router.createUrlTree(['/authentication/login'], {
    queryParams: returnUrl ? { returnUrl } : undefined,
  });

const denyForUnauthorized = (router: Router): UrlTree =>
  router.createUrlTree(['/charity/home']);

const evaluateAccess = (
  route: Pick<Route, 'data'>,
  returnUrl?: string
): true | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return denyForUnauthenticated(router, returnUrl);
  }

  const requiredRoles = extractRoles(route);

  if (requiredRoles.length === 0) {
    return true;
  }

  if (authService.hasAnyRole(requiredRoles)) {
    return true;
  }

  return denyForUnauthorized(router);
};

export const roleCanActivateGuard: CanActivateFn = (route, state) =>
  evaluateAccess(route, state.url);

export const roleCanLoadGuard: CanLoadFn = (route, segments: UrlSegment[]) => {
  const segmentPath = segments.map((segment) => segment.path).join('/');
  const returnUrl = segmentPath ? `/${segmentPath}` : undefined;
  return evaluateAccess(route, returnUrl);
};
