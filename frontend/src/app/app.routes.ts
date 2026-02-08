import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';

export const routes: Routes = [
  {
    path: '',
    component: FullComponent,
    children: [
      {
        path: '',
        redirectTo: '/public/info',
        pathMatch: 'full',
      },
      {
        path: 'charity',
        loadChildren: () =>
          import('./pages/charity/charity.routes').then((m) => m.CharityRoutes),
      },
    ],
  },
  {
    path: '',
    component: BlankComponent,
    children: [
      {
        path: 'public',
        loadChildren: () =>
          import('./pages/public/public.routes').then((m) => m.PublicRoutes),
      },
      {
        path: 'authentication',
        loadChildren: () =>
          import('./pages/authentication/authentication.routes').then(
            (m) => m.AuthenticationRoutes
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'public/info',
  },
];
