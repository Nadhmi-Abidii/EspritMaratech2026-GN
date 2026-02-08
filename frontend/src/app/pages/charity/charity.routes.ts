import { Routes } from '@angular/router';
import { authGuard } from 'src/app/core/guards/auth.guard';
import {
  roleCanActivateGuard,
  roleCanLoadGuard,
} from 'src/app/core/guards/role.guard';
import { zoneCanActivateGuard } from 'src/app/core/guards/zone.guard';
import { UserRole } from 'src/app/core/models/auth.models';

const ALL_ROLES: UserRole[] = ['admin', 'coordinator', 'responsible', 'volunteer'];
const MANAGEMENT_ROLES: UserRole[] = ['admin', 'coordinator', 'responsible'];

export const CharityRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        canLoad: [roleCanLoadGuard],
        canActivate: [roleCanActivateGuard],
        data: {
          roles: ALL_ROLES,
        },
        loadChildren: () =>
          import('./home/home.routes').then((m) => m.HomeRoutes),
      },
      {
        path: 'families',
        canLoad: [roleCanLoadGuard],
        canActivate: [roleCanActivateGuard],
        data: {
          roles: ALL_ROLES,
        },
        loadChildren: () =>
          import('./families/family.routes').then((m) => m.FamilyRoutes),
      },
      {
        path: 'zones/:zoneId/families',
        canLoad: [roleCanLoadGuard],
        canActivate: [roleCanActivateGuard, zoneCanActivateGuard],
        data: {
          roles: ALL_ROLES,
        },
        loadChildren: () =>
          import('./families/family.routes').then((m) => m.FamilyRoutes),
      },
      {
        path: 'beneficiaries',
        canLoad: [roleCanLoadGuard],
        canActivate: [roleCanActivateGuard],
        data: {
          roles: MANAGEMENT_ROLES,
        },
        loadChildren: () =>
          import('./beneficiaries/beneficiary.routes').then(
            (m) => m.BeneficiaryRoutes
          ),
      },
      {
        path: 'aids',
        canLoad: [roleCanLoadGuard],
        canActivate: [roleCanActivateGuard],
        data: {
          roles: ALL_ROLES,
        },
        loadChildren: () =>
          import('./aids/aid.routes').then((m) => m.AidRoutes),
      },
      {
        path: 'visits',
        canLoad: [roleCanLoadGuard],
        canActivate: [roleCanActivateGuard],
        data: {
          roles: ALL_ROLES,
        },
        loadChildren: () =>
          import('./visits/visit.routes').then((m) => m.VisitRoutes),
      },
      {
        path: 'admin',
        canLoad: [roleCanLoadGuard],
        canActivate: [roleCanActivateGuard],
        data: {
          roles: ['admin'],
        },
        loadChildren: () =>
          import('./admin/admin.routes').then((m) => m.AdminRoutes),
      },
      {
        path: 'posts',
        canLoad: [roleCanLoadGuard],
        canActivate: [roleCanActivateGuard],
        data: {
          roles: ['admin', 'responsible'],
        },
        loadChildren: () =>
          import('./posts/post.routes').then((m) => m.PostRoutes),
      },
      {
        path: 'profile',
        canLoad: [roleCanLoadGuard],
        canActivate: [roleCanActivateGuard],
        data: {
          roles: ALL_ROLES,
        },
        loadChildren: () =>
          import('./profile/profile.routes').then((m) => m.ProfileRoutes),
      },
    ],
  },
];
