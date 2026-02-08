import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexLegend,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexStroke,
  ApexXAxis,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import {
  AidType,
  Aide,
  Beneficiaire,
  Famille,
  FamilleReference,
  FamilyAidType,
  HousingSituation,
  ZoneCreatePayload,
  ZoneItem,
  Visite,
} from 'src/app/core/models/charity.models';
import { UserRole } from 'src/app/core/models/auth.models';
import { ManagedUser, UserCreatePayload } from 'src/app/core/models/user.models';
import { AuthService } from 'src/app/core/services/auth.service';
import { extractApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { UserService } from 'src/app/features/admin/services/user.service';
import { AidService } from 'src/app/features/charity/services/aid.service';
import { BeneficiaryService } from 'src/app/features/charity/services/beneficiary.service';
import { FamilyService } from 'src/app/features/charity/services/family.service';
import { VisitService } from 'src/app/features/charity/services/visit.service';
import { ZoneService } from 'src/app/features/charity/services/zone.service';
import { MaterialModule } from 'src/app/material.module';
import { GeoMapComponent } from '../map/geo-map.component';

interface ActivityDonutChart {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  legend: ApexLegend;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  stroke: ApexStroke;
  colors: string[];
}

interface AidBarChart {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  legend: ApexLegend;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  stroke: ApexStroke;
  colors: string[];
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MaterialModule,
    NgApexchartsModule,
    GeoMapComponent,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  readonly currentUser$ = this.authService.user$;
  private readonly dashboardListLimit = 100;
  readonly userRoles: UserRole[] = ['admin', 'coordinator', 'responsible', 'volunteer'];
  readonly userForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    phone: ['', [Validators.maxLength(30)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['volunteer' as UserRole, [Validators.required]],
    isActive: [true],
    assignedZones: [''],
  });
  readonly zoneResponsibleForm = this.fb.nonNullable.group({
    zoneName: ['', [Validators.required, Validators.maxLength(120)]],
    responsibleName: ['', [Validators.required, Validators.maxLength(120)]],
    responsibleEmail: ['', [Validators.required, Validators.email, Validators.maxLength(120)]],
    responsiblePhone: ['', [Validators.required, Validators.maxLength(30)]],
    responsiblePassword: ['Password123!', [Validators.required, Validators.minLength(8)]],
  });

  isDashboardLoading = false;
  isUserLoading = false;
  isZoneLoading = false;
  isCreatingUser = false;
  isCreatingZone = false;
  errorMessage = '';
  dashboardErrors: string[] = [];
  userErrorMessage = '';
  userSuccessMessage = '';
  zoneErrorMessage = '';
  zoneSuccessMessage = '';

  stats = {
    families: 0,
    beneficiaries: 0,
    visits: 0,
    aids: 0,
  };

  aidTotals: Record<AidType, number> = {
    alimentaire: 0,
    medication: 0,
    aide_specifique: 0,
  };

  familiesSnapshot: Famille[] = [];
  beneficiariesSnapshot: Beneficiaire[] = [];
  visitsSnapshot: Visite[] = [];
  aidsSnapshot: Aide[] = [];
  usersSnapshot: ManagedUser[] = [];
  zonesSnapshot: ZoneItem[] = [];
  recentVisits: Visite[] = [];

  activityChart: Partial<ActivityDonutChart> = this.createActivityChart();
  aidSummaryChart: Partial<AidBarChart> = this.createAidSummaryChart();

  private lastVisitByFamilyId: Record<string, string> = {};
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly familyService: FamilyService,
    private readonly beneficiaryService: BeneficiaryService,
    private readonly visitService: VisitService,
    private readonly aidService: AidService,
    private readonly zoneService: ZoneService
  ) {}

  ngOnInit(): void {
    this.familyService.families$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((families) => {
        this.familiesSnapshot = families;
        this.recalculateDashboardState();
      });

    this.beneficiaryService.beneficiaries$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((beneficiaries) => {
        this.beneficiariesSnapshot = beneficiaries;
        this.recalculateDashboardState();
      });

    this.visitService.visits$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((visits) => {
        this.visitsSnapshot = visits;
        this.recalculateDashboardState();
      });

    this.aidService.aids$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((aids) => {
        this.aidsSnapshot = aids;
        this.recalculateDashboardState();
      });

    this.userService.users$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((users) => {
        this.usersSnapshot = users;
      });

    this.zoneService.zones$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((zones) => {
        this.zonesSnapshot = zones;
      });

    this.userService.loading$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((loading) => {
        this.isUserLoading = loading;
      });

    this.zoneService.loading$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((loading) => {
        this.isZoneLoading = loading;
      });

    this.reloadDashboardData();
  }

  reloadDashboardData(): void {
    this.errorMessage = '';
    this.dashboardErrors = [];
    this.isDashboardLoading = true;

    const errors: string[] = [];

    forkJoin({
      families: this.familyService.loadFamilies({ page: 1, limit: this.dashboardListLimit }).pipe(
        catchError((error: unknown) => {
          errors.push(extractApiErrorMessage(error, 'Impossible de charger les familles.'));
          return of([] as Famille[]);
        })
      ),
      beneficiaries: this.beneficiaryService
        .loadBeneficiaries({ page: 1, limit: this.dashboardListLimit })
        .pipe(
          catchError((error: unknown) => {
            errors.push(extractApiErrorMessage(error, 'Impossible de charger les bénéficiaires.'));
            return of([] as Beneficiaire[]);
          })
        ),
      visits: this.visitService.loadVisits({ page: 1, limit: this.dashboardListLimit }).pipe(
        catchError((error: unknown) => {
          errors.push(extractApiErrorMessage(error, 'Impossible de charger les visites.'));
          return of([] as Visite[]);
        })
      ),
      aids: this.aidService.loadAids({ page: 1, limit: this.dashboardListLimit }).pipe(
        catchError((error: unknown) => {
          errors.push(extractApiErrorMessage(error, 'Impossible de charger les aides.'));
          return of([] as Aide[]);
        })
      ),
      users: this.userService.loadUsers({ page: 1, limit: this.dashboardListLimit }).pipe(
        catchError((error: unknown) => {
          errors.push(extractApiErrorMessage(error, 'Impossible de charger les utilisateurs.'));
          return of([] as ManagedUser[]);
        })
      ),
      zones: this.zoneService.loadZones({ page: 1, limit: this.dashboardListLimit }).pipe(
        catchError((error: unknown) => {
          errors.push(extractApiErrorMessage(error, 'Impossible de charger les zones.'));
          return of([] as ZoneItem[]);
        })
      ),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isDashboardLoading = false;
          this.dashboardErrors = errors;

          if (errors.length > 0) {
            this.errorMessage = "Certaines sections du tableau de bord n'ont pas pu être chargées.";
          }
        })
      )
      .subscribe();
  }

  createUserFromDashboard(): void {
    this.userErrorMessage = '';
    this.userSuccessMessage = '';

    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const values = this.userForm.getRawValue();
    const assignedZones = this.parseAssignedZones(values.assignedZones);

    const payload: UserCreatePayload = {
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim() || undefined,
      password: values.password,
      role: values.role,
      isActive: values.isActive,
      assignedZones: assignedZones.length > 0 ? assignedZones : undefined,
    };

    this.isCreatingUser = true;

    this.userService
      .createUser(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isCreatingUser = false;
        })
      )
      .subscribe({
        next: (created) => {
          this.userSuccessMessage = `Utilisateur ${created.name} ajouté avec succès.`;
          this.userForm.reset({
            name: '',
            email: '',
            phone: '',
            password: '',
            role: 'volunteer',
            isActive: true,
            assignedZones: '',
          });
        },
        error: (error: unknown) => {
          this.userErrorMessage = extractApiErrorMessage(error, "Impossible d'ajouter l'utilisateur.");
        },
      });
  }

  deleteUser(user: ManagedUser): void {
    this.userErrorMessage = '';
    this.userSuccessMessage = '';

    if (!window.confirm(`Supprimer l'utilisateur ${user.name} définitivement ?`)) {
      return;
    }

    this.userService
      .deleteUser(user._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (deletedUser) => {
          this.userSuccessMessage = `Utilisateur ${deletedUser.name} supprimé.`;
        },
        error: (error: unknown) => {
          this.userErrorMessage = extractApiErrorMessage(error, "Impossible de supprimer l'utilisateur.");
        },
      });
  }

  createZoneResponsibleFromDashboard(): void {
    this.zoneErrorMessage = '';
    this.zoneSuccessMessage = '';

    if (this.zoneResponsibleForm.invalid) {
      this.zoneResponsibleForm.markAllAsTouched();
      return;
    }

    const values = this.zoneResponsibleForm.getRawValue();

    const payload: ZoneCreatePayload = {
      name: values.zoneName.trim(),
      responsible: {
        name: values.responsibleName.trim(),
        email: values.responsibleEmail.trim().toLowerCase(),
        phone: values.responsiblePhone.trim(),
        password: values.responsiblePassword,
      },
    };

    this.isCreatingZone = true;

    this.zoneService
      .createZone(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isCreatingZone = false;
        })
      )
      .subscribe({
        next: (zone) => {
          this.zoneSuccessMessage = `Zone ${zone.name} créée (responsable : ${zone.responsible?.name || ''}).`;
          this.zoneResponsibleForm.reset({
            zoneName: '',
            responsibleName: '',
            responsibleEmail: '',
            responsiblePhone: '',
            responsiblePassword: 'Password123!',
          });
        },
        error: (error: unknown) => {
          this.zoneErrorMessage = extractApiErrorMessage(
            error,
            'Impossible de créer le responsable de zone.'
          );
        },
      });
  }

  deleteZone(zone: ZoneItem): void {
    this.zoneErrorMessage = '';
    this.zoneSuccessMessage = '';

    if (
      !window.confirm(
        `Supprimer la zone ${zone.name} ? Cela ne fonctionne que si aucune famille n'est assignée.`
      )
    ) {
      return;
    }

    this.zoneService
      .deleteZone(zone._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.zoneSuccessMessage = `Zone ${zone.name} supprimée.`;
        },
        error: (error: unknown) => {
          this.zoneErrorMessage = extractApiErrorMessage(error, 'Impossible de supprimer la zone.');
        },
      });
  }

  logout(): void {
    this.authService.logout(true);
  }

  trackFamilyById(_index: number, family: Famille): string {
    return family._id;
  }

  trackBeneficiaryById(_index: number, beneficiary: Beneficiaire): string {
    return beneficiary._id;
  }

  trackVisitById(_index: number, visit: Visite): string {
    return visit._id;
  }

  trackAidById(_index: number, aid: Aide): string {
    return aid._id;
  }

  trackUserById(_index: number, user: ManagedUser): string {
    return user._id;
  }

  trackZoneById(_index: number, zone: ZoneItem): string {
    return zone._id;
  }

  get mappedFamilies(): Famille[] {
    return this.familiesSnapshot.filter((family) => !!family.geolocation);
  }

  get mappedVisits(): Visite[] {
    return this.visitsSnapshot.filter((visit) => !!visit.geolocation);
  }

  formatCoordinates(target: { geolocation?: { latitude: number; longitude: number } | null }): string {
    const geo = target.geolocation;

    if (!geo) {
      return '-';
    }

    return `${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)}`;
  }

  familyName(ref: string | FamilleReference): string {
    if (typeof ref === 'string') {
      return ref;
    }

    return ref.name ?? ref._id;
  }

  familyAidLabel(type: FamilyAidType): string {
    if (type === 'alimentaire') {
      return 'Alimentaire';
    }

    if (type === 'medicaments') {
      return 'Médicaments';
    }

    return 'Aide spécifique';
  }

  aidTypeLabel(type: AidType): string {
    if (type === 'alimentaire') {
      return 'Alimentaire';
    }

    if (type === 'medication') {
      return 'Médicaments';
    }

    return 'Aide spécifique';
  }

  familyAidList(family: Famille): string {
    if (!family.aidTypes?.length) {
      return '-';
    }

    return family.aidTypes.map((type) => this.familyAidLabel(type)).join(', ');
  }

  familyLastVisit(familyId: string): string {
    const value = this.lastVisitByFamilyId[familyId];
    return value ? this.formatDate(value) : '-';
  }

  beneficiaryHealthLabel(beneficiary: Beneficiaire): string {
    const healthHistory = beneficiary.healthHistory?.trim();

    if (healthHistory) {
      return healthHistory;
    }

    return beneficiary.hasDisability ? 'Suivi spécial' : 'Stable';
  }

  visitVolunteerName(visit: Visite): string {
    const names = new Set<string>();

    for (const aid of visit.aides ?? []) {
      if (typeof aid !== 'string' && aid.createdBy?.name) {
        names.add(aid.createdBy.name);
      }
    }

    if (names.size === 0) {
      return 'Non renseigné';
    }

    return Array.from(names).join(', ');
  }

  visitAidSummary(visit: Visite): string {
    const details = (visit.aides ?? [])
      .map((aid) => {
        if (typeof aid === 'string') {
          return null;
        }

        return `${this.aidTypeLabel(aid.type)} (${aid.quantity})`;
      })
      .filter((item): item is string => !!item);

    if (details.length > 0) {
      return details.join(', ');
    }

    if ((visit.aides ?? []).length > 0) {
      return `${visit.aides.length} aide(s) liée(s)`;
    }

    return '-';
  }

  formatDate(value?: string): string {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleDateString('fr-FR');
  }

  formatDateTime(value?: string): string {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleString('fr-FR');
  }

  roleLabel(value: UserRole): string {
    if (value === 'admin') {
      return 'Administrateur';
    }

    if (value === 'responsible') {
      return 'Responsable';
    }

    if (value === 'coordinator') {
      return 'Coordinateur';
    }

    return 'Bénévole';
  }

  userZonesLabel(user: ManagedUser): string {
    if (!user.assignedZones?.length) {
      return '-';
    }

    return user.assignedZones.join(', ');
  }

  formatRevenue(value?: number): string {
    if (value === undefined || value === null) {
      return '-';
    }

    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  familyHousingLabel(value?: HousingSituation): string {
    if (!value) {
      return '-';
    }

    if (value === 'proprietaire') {
      return 'Propriétaire';
    }

    if (value === 'locataire') {
      return 'Locataire';
    }

    if (value === 'heberge') {
      return 'Hébergé';
    }

    if (value === 'sans_logement') {
      return 'Sans logement';
    }

    return 'Autre';
  }

  private recalculateDashboardState(): void {
    this.stats = {
      families: this.familiesSnapshot.length,
      beneficiaries: this.beneficiariesSnapshot.length,
      visits: this.visitsSnapshot.length,
      aids: this.aidsSnapshot.length,
    };

    this.rebuildLastVisitLookup();
    this.rebuildRecentVisits();
    this.rebuildCharts();
  }

  private rebuildRecentVisits(): void {
    this.recentVisits = [...this.visitsSnapshot]
      .sort((left, right) => {
        return new Date(right.visitDate).getTime() - new Date(left.visitDate).getTime();
      })
      .slice(0, 10);
  }

  private rebuildCharts(): void {
    this.activityChart = {
      ...this.activityChart,
      series: [
        this.stats.families,
        this.stats.beneficiaries,
        this.stats.visits,
        this.stats.aids,
      ],
    };

    const totals = this.aidsSnapshot.reduce(
      (accumulator, aid) => {
        accumulator[aid.type] += aid.quantity;
        return accumulator;
      },
      {
        alimentaire: 0,
        medication: 0,
        aide_specifique: 0,
      } as Record<AidType, number>
    );

    this.aidTotals = totals;

    this.aidSummaryChart = {
      ...this.aidSummaryChart,
      series: [
        {
          name: 'Quantité',
          data: [totals.alimentaire, totals.medication, totals.aide_specifique],
        },
      ],
    };
  }

  private rebuildLastVisitLookup(): void {
    const lookup: Record<string, string> = {};

    for (const visit of this.visitsSnapshot) {
      const familyId = this.extractFamilyId(visit.famille);

      if (!familyId) {
        continue;
      }

      if (!lookup[familyId]) {
        lookup[familyId] = visit.visitDate;
        continue;
      }

      const currentTime = new Date(lookup[familyId]).getTime();
      const nextTime = new Date(visit.visitDate).getTime();

      if (nextTime > currentTime) {
        lookup[familyId] = visit.visitDate;
      }
    }

    this.lastVisitByFamilyId = lookup;
  }

  private extractFamilyId(ref: string | FamilleReference): string {
    return typeof ref === 'string' ? ref : ref._id;
  }

  private parseAssignedZones(input: string): string[] {
    if (!input.trim()) {
      return [];
    }

    const unique = new Set(
      input
        .split(',')
        .map((zone) => zone.trim())
        .filter((zone) => zone.length > 0)
    );

    return Array.from(unique);
  }

  private createActivityChart(): Partial<ActivityDonutChart> {
    return {
      series: [0, 0, 0, 0],
      chart: {
        type: 'donut',
        height: 290,
        toolbar: { show: false },
      },
      labels: ['Familles', 'Bénéficiaires', 'Visites', 'Aides'],
      legend: {
        position: 'bottom',
      },
      dataLabels: {
        enabled: true,
      },
      plotOptions: {
        pie: {
          donut: {
            size: '62%',
          },
        },
      },
      stroke: {
        width: 1,
      },
      colors: ['#1b5e20', '#0277bd', '#6a1b9a', '#ef6c00'],
    };
  }

  private createAidSummaryChart(): Partial<AidBarChart> {
    return {
      series: [
        {
          name: 'Quantité',
          data: [0, 0, 0],
        },
      ],
      chart: {
        type: 'bar',
        height: 290,
        toolbar: { show: false },
      },
      xaxis: {
        categories: ['Alimentaire', 'Médicaments', 'Aide spécifique'],
      },
      legend: {
        show: false,
      },
      dataLabels: {
        enabled: false,
      },
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: '45%',
        },
      },
      stroke: {
        show: true,
        width: 1,
        colors: ['transparent'],
      },
      colors: ['#00838f'],
    };
  }
}
