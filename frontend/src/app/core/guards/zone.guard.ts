import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

const toComparable = (value: string): string => value.trim().toLowerCase();

export const zoneCanActivateGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.getCurrentUser();

  if (!user) {
    return router.createUrlTree(['/authentication/login']) as UrlTree;
  }

  if (user.role === 'admin') {
    return true;
  }

  const targetZone =
    String(route.params['zoneId'] || route.queryParams['zoneId'] || '').trim();

  if (!targetZone) {
    return true;
  }

  const assignedZones = authService
    .getAssignedZones()
    .map((zone) => toComparable(zone))
    .filter((zone) => zone.length > 0);

  if (assignedZones.includes(toComparable(targetZone))) {
    return true;
  }

  return router.createUrlTree(['/public/info']) as UrlTree;
};
