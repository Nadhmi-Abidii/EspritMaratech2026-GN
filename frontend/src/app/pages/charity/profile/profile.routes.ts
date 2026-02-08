import { Routes } from '@angular/router';

export const ProfileRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./profile.component').then((m) => m.ProfileComponent),
    data: {
      title: 'Profil',
      urls: [
        { title: 'Accueil', url: '/charity/home' },
        { title: 'Profil' },
      ],
    },
  },
];
