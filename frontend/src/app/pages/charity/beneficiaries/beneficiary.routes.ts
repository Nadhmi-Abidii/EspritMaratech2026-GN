import { Routes } from '@angular/router';

export const BeneficiaryRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./beneficiary-management.component').then(
        (m) => m.BeneficiaryManagementComponent
      ),
    data: {
      title: 'Bénéficiaires',
      urls: [
        { title: 'Accueil', url: '/charity/home' },
        { title: 'Bénéficiaires' },
      ],
    },
  },
];
