import { Routes } from '@angular/router';

export const AdminRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./admin-dashboard.component').then((m) => m.AdminDashboardComponent),
    data: {
      title: 'Tableau de bord admin',
      urls: [
        { title: 'Accueil', url: '/charity/home' },
        { title: 'Tableau de bord admin' },
      ],
    },
  },
];
