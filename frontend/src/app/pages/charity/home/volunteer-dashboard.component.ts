import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { EMPTY, catchError, finalize, forkJoin, map } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { extractApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { FamilyService } from 'src/app/features/charity/services/family.service';
import { VisitService } from 'src/app/features/charity/services/visit.service';
import { AidService } from 'src/app/features/charity/services/aid.service';
import { Aide, Famille, FamilleReference, Visite } from 'src/app/core/models/charity.models';

interface VolunteerMetric {
  label: string;
  value: number | string;
  hint: string;
  accent: 'teal' | 'blue' | 'amber' | 'slate';
}

interface VolunteerAction {
  title: string;
  description: string;
  route: string;
  cta: string;
}

interface PriorityFamily {
  id: string;
  name: string;
  zone: string;
  visited: boolean;
  goalReached: boolean;
  raised: number;
  goal: number;
  remaining: number;
}

interface RecentVisit {
  id: string;
  familyName: string;
  when: string;
  notes: string;
}

@Component({
  selector: 'app-volunteer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule],
  templateUrl: './volunteer-dashboard.component.html',
  styleUrl: './volunteer-dashboard.component.scss',
})
export class VolunteerDashboardComponent implements OnInit {
  loading = false;
  errorMessage = '';
  metrics: VolunteerMetric[] = [];
  priorityFamilies: PriorityFamily[] = [];
  recentVisits: RecentVisit[] = [];

  readonly quickActions: VolunteerAction[] = [
    {
      title: 'Familles',
      description: "Consultez vos familles assignées et mettez à jour les informations après les visites terrain.",
      route: '/charity/families',
      cta: 'Ouvrir les familles',
    },
    {
      title: 'Visites',
      description: 'Enregistrez de nouvelles visites terrain et des notes de suivi pour chaque famille.',
      route: '/charity/visits',
      cta: 'Ouvrir les visites',
    },
    {
      title: 'Aides',
      description: "Suivez les aides délivrées pour les familles que vous accompagnez.",
      route: '/charity/aids',
      cta: 'Ouvrir les aides',
    },
    {
      title: 'Profil',
      description: 'Consultez votre rôle, vos zones et les informations de session.',
      route: '/charity/profile',
      cta: 'Ouvrir le profil',
    },
  ];

  constructor(
    private readonly authService: AuthService,
    private readonly familyService: FamilyService,
    private readonly visitService: VisitService,
    private readonly aidService: AidService
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  get volunteerName(): string {
    return this.authService.getCurrentUser()?.name || 'Bénévole';
  }

  get assignedZonesLabel(): string {
    const assigned = this.authService.getAssignedZones();
    return assigned.length ? assigned.join(', ') : 'Aucune zone assignée';
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      families: this.familyService.loadFamilies({ page: 1, limit: 100 }),
      visits: this.visitService.loadVisits({ page: 1, limit: 100 }),
      aids: this.aidService.loadAids({ page: 1, limit: 100 }),
    })
      .pipe(
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(
            error,
            'Impossible de charger les données du tableau de bord bénévole.'
          );
          return EMPTY;
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(({ families, visits, aids }) => {
        this.metrics = this.buildMetrics(families, visits, aids);
        this.priorityFamilies = this.buildPriorityFamilies(families);
        this.recentVisits = this.buildRecentVisits(visits);
      });
  }

  trackPriorityById(_index: number, family: PriorityFamily): string {
    return family.id;
  }

  trackVisitById(_index: number, visit: RecentVisit): string {
    return visit.id;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('fr-FR');
  }

  familyProgressPercent(family: PriorityFamily): number {
    if (!family.goal || family.goal <= 0) {
      return 0;
    }

    return Math.min(100, Number(((family.raised / family.goal) * 100).toFixed(1)));
  }

  private buildMetrics(families: Famille[], visits: Visite[], aids: Aide[]): VolunteerMetric[] {
    const visitedCount = families.filter((family) => family.visited).length;
    const pendingVisits = Math.max(families.length - visitedCount, 0);
    const reachedGoals = families.filter((family) => family.goalReached).length;
    const totalGoal = families.reduce((sum, family) => sum + Number(family.donationGoal || 0), 0);
    const totalRaised = families.reduce((sum, family) => sum + Number(family.totalRaised || 0), 0);
    const collectiveProgress =
      totalGoal > 0 ? Math.min(100, Number(((totalRaised / totalGoal) * 100).toFixed(1))) : 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const visitsThisMonth = visits.filter((visit) => {
      const date = new Date(visit.visitDate);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length;

    const aidsThisMonth = aids.filter((aid) => {
      const date = new Date(aid.aidDate);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length;

    return [
      {
        label: 'Familles assignées',
        value: families.length,
        hint: `${visitedCount} visitées / ${pendingVisits} en attente`,
        accent: 'teal',
      },
      {
        label: 'Visites ce mois-ci',
        value: visitsThisMonth,
        hint: `${visits.length} visites enregistrées au total`,
        accent: 'blue',
      },
      {
        label: 'Aides ce mois-ci',
        value: aidsThisMonth,
        hint: `${aids.length} aides enregistrées`,
        accent: 'amber',
      },
      {
        label: 'Objectifs de dons atteints',
        value: reachedGoals,
        hint: `${collectiveProgress}% de progression globale`,
        accent: 'slate',
      },
    ];
  }

  private buildPriorityFamilies(families: Famille[]): PriorityFamily[] {
    return families
      .map((family) => {
        const goal = Number(family.donationGoal || 0);
        const raised = Number(family.totalRaised || 0);
        const remaining = Math.max(goal - raised, 0);

        return {
          id: family._id,
          name: family.name,
          zone: family.zone || '-',
          visited: !!family.visited,
          goalReached: !!family.goalReached,
          raised,
          goal,
          remaining,
        };
      })
      .sort((left, right) => {
        if (left.visited !== right.visited) {
          return left.visited ? 1 : -1;
        }

        if (left.goalReached !== right.goalReached) {
          return left.goalReached ? 1 : -1;
        }

        return right.remaining - left.remaining;
      })
      .slice(0, 6);
  }

  private buildRecentVisits(visits: Visite[]): RecentVisit[] {
    return [...visits]
      .sort((left, right) => {
        return new Date(right.visitDate).getTime() - new Date(left.visitDate).getTime();
      })
      .slice(0, 6)
      .map((visit) => ({
        id: visit._id,
        familyName: this.familyName(visit.famille),
        when: visit.visitDate,
        notes: visit.notes?.trim() || 'Aucune note',
      }));
  }

  private familyName(ref: string | FamilleReference): string {
    if (typeof ref === 'string') {
      return ref;
    }

    return ref.name || ref._id;
  }
}
