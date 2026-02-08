import { Routes } from '@angular/router';

export const FamilyRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./family-management.component').then(
        (m) => m.FamilyManagementComponent
      ),
    data: {
      title: 'Familles',
      urls: [
        { title: 'Accueil', url: '/charity/home' },
        { title: 'Familles' },
      ],
    },
  },
];
