import { Routes } from '@angular/router';

export const AidRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./aid-management.component').then((m) => m.AidManagementComponent),
    data: {
      title: 'Aides',
      urls: [
        { title: 'Accueil', url: '/charity/home' },
        { title: 'Aides' },
      ],
    },
  },
];
