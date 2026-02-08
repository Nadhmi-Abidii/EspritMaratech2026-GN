import { Routes } from '@angular/router';

export const HomeRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./home.component').then((m) => m.HomeComponent),
    data: {
      title: 'Accueil',
      urls: [{ title: 'Accueil' }],
    },
  },
];
