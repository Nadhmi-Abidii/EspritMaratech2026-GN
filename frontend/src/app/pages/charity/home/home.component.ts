import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { EMPTY, catchError, finalize, forkJoin, map } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { MaterialModule } from 'src/app/material.module';
import { extractApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { FamilyService } from 'src/app/features/charity/services/family.service';
import { BeneficiaryService } from 'src/app/features/charity/services/beneficiary.service';
import { AidService } from 'src/app/features/charity/services/aid.service';
import { VisitService } from 'src/app/features/charity/services/visit.service';
import { AdminDashboardComponent } from '../admin/admin-dashboard.component';
import { VolunteerDashboardComponent } from './volunteer-dashboard.component';

interface OverviewCard {
  title: string;
  value: number;
  description: string;
  route: string;
}

@Component({
  selector: 'app-charity-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MaterialModule,
    AdminDashboardComponent,
    VolunteerDashboardComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  readonly isAdmin = this.authService.hasRole('admin');
  readonly isVolunteer = this.authService.hasRole('volunteer');

  cards: OverviewCard[] = [];
  loading = false;
  errorMessage = '';

  constructor(
    private readonly authService: AuthService,
    private readonly familyService: FamilyService,
    private readonly beneficiaryService: BeneficiaryService,
    private readonly aidService: AidService,
    private readonly visitService: VisitService
  ) {}

  ngOnInit(): void {
    if (this.isAdmin || this.isVolunteer) {
      return;
    }

    this.reloadOverview();
  }

  reloadOverview(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      families: this.familyService.loadFamilies({ page: 1, limit: 100 }).pipe(map((x) => x.length)),
      beneficiaries: this.beneficiaryService
        .loadBeneficiaries({ page: 1, limit: 100 })
        .pipe(map((x) => x.length)),
      aids: this.aidService.loadAids({ page: 1, limit: 100 }).pipe(map((x) => x.length)),
      visits: this.visitService.loadVisits({ page: 1, limit: 100 }).pipe(map((x) => x.length)),
    })
      .pipe(
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(
            error,
            "Impossible de charger l'aperçu du tableau de bord."
          );
          return EMPTY;
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((result) => {
        this.cards = [
          {
            title: 'Familles',
            value: result.families,
            description: 'Foyers enregistrés et suivis dans la plateforme.',
            route: '/charity/families',
          },
          {
            title: 'Bénéficiaires',
            value: result.beneficiaries,
            description: 'Personnes liées aux familles accompagnées.',
            route: '/charity/beneficiaries',
          },
          {
            title: 'Aides',
            value: result.aids,
            description: "Enregistrements d'aide distribuée aux familles.",
            route: '/charity/aids',
          },
          {
            title: 'Visites',
            value: result.visits,
            description: 'Visites terrain enregistrées par votre équipe.',
            route: '/charity/visits',
          },
        ];
      });
  }
}
