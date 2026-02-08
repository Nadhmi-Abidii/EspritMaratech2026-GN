import { Routes } from '@angular/router';

export const PostRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./post-management.component').then((m) => m.PostManagementComponent),
    data: {
      title: 'Gestion des publications',
      urls: [
        { title: 'Accueil', url: '/charity/home' },
        { title: 'Publications' },
      ],
    },
  },
];
