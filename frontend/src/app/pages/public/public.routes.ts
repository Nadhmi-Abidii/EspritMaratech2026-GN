import { Routes } from '@angular/router';

export const PublicRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        redirectTo: 'info',
        pathMatch: 'full',
      },
      {
        path: 'info',
        loadComponent: () =>
          import('./info/public-info.component').then((m) => m.PublicInfoComponent),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./reports/public-reports.component').then((m) => m.PublicReportsComponent),
      },
    ],
  },
];
