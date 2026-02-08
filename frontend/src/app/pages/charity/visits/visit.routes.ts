import { Routes } from '@angular/router';

export const VisitRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./visit-management.component').then(
        (m) => m.VisitManagementComponent
      ),
    data: {
      title: 'Visites',
      urls: [
        { title: 'Accueil', url: '/charity/home' },
        { title: 'Visites' },
      ],
    },
  },
];
