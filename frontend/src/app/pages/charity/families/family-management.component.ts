import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { EMPTY, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MaterialModule } from 'src/app/material.module';
import {
  Famille,
  FamilyAidType,
  FamilyPayload,
  Geolocation,
  HousingSituation,
  ZoneItem,
  Visite,
} from 'src/app/core/models/charity.models';
import { extractApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { FamilyService } from 'src/app/features/charity/services/family.service';
import { VisitService } from 'src/app/features/charity/services/visit.service';
import { ZoneService } from 'src/app/features/charity/services/zone.service';
import { GeoMapComponent } from '../map/geo-map.component';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-family-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, GeoMapComponent],
  templateUrl: './family-management.component.html',
  styleUrl: './family-management.component.scss',
})
export class FamilyManagementComponent implements OnInit, AfterViewInit {
  readonly families$ = this.familyService.families$;
  readonly loading$ = this.familyService.loading$;
  readonly zones$ = this.zoneService.zones$;
  readonly dataSource = new MatTableDataSource<Famille>([]);

  errorMessage = '';
  isSubmitting = false;
  isEditing = false;
  editingFamilyId: string | null = null;
  zones: ZoneItem[] = [];

  selectedAidTypeFilter: FamilyAidType | '' = '';
  private tableSearchTerm = '';
  private lastVisitByFamilyId: Record<string, string> = {};
  private visitsSnapshot: Visite[] = [];

  readonly aidOptions: FamilyAidType[] = ['alimentaire', 'medicaments', 'aide_specifique'];
  readonly housingSituationOptions: Array<{ value: HousingSituation; label: string }> = [
    { value: 'proprietaire', label: 'Propriétaire' },
    { value: 'locataire', label: 'Locataire' },
    { value: 'heberge', label: 'Hébergé' },
    { value: 'sans_logement', label: 'Sans logement' },
    { value: 'autre', label: 'Autre' },
  ];
  readonly maxBirthDate = new Date().toISOString().slice(0, 10);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    address: ['', [Validators.required, Validators.maxLength(255)]],
    postalCode: ['', [Validators.required, Validators.maxLength(20)]],
    zoneId: [''],
    zone: ['', [Validators.maxLength(80)]],
    phone: ['', [Validators.required, Validators.maxLength(30)]],
    email: ['', [Validators.email]],
    numberOfPeople: [1, [Validators.required, Validators.min(1)]],
    date_de_naissance: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    nombre_enfants: [0, [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]],
    // occupation: ['', [Validators.required, Validators.maxLength(120)]],
    revenu_mensuel: [null as number | null, [Validators.min(0)]],
    situation_logement: ['', [Validators.required]],
    aidTypes: [[] as FamilyAidType[]],
    donationGoal: [0, [Validators.required, Validators.min(0)]],
    observations: [''],
    latitude: [null as number | null, [Validators.min(-90), Validators.max(90)]],
    longitude: [null as number | null, [Validators.min(-180), Validators.max(180)]],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly familyService: FamilyService,
    private readonly visitService: VisitService,
    private readonly zoneService: ZoneService,
    private readonly fb: FormBuilder,
    private readonly snackBar: MatSnackBar,
    private readonly authService: AuthService
  ) {
    this.dataSource.filterPredicate = (family, rawFilter) => {
      let filterData: { search: string; aidType: FamilyAidType | '' } = {
        search: '',
        aidType: '',
      };

      try {
        filterData = JSON.parse(rawFilter) as { search: string; aidType: FamilyAidType | '' };
      } catch {
        filterData.search = rawFilter.trim().toLowerCase();
      }

      if (filterData.aidType && !family.aidTypes.includes(filterData.aidType)) {
        return false;
      }

      if (!filterData.search) {
        return true;
      }

      const haystack = [
        family.name,
        family.address,
        family.postalCode,
        family.zone,
        family.phone,
        family.email ?? '',
        family.occupation ?? '',
        this.housingSituationLabel(family.situation_logement),
        String(family.numberOfPeople),
        String(family.nombre_enfants ?? ''),
        String(family.revenu_mensuel ?? ''),
        this.formatDate(family.date_de_naissance),
        this.formatDateTime(this.lastVisitDateForFamily(family._id)),
        String(family.donationGoal ?? ''),
        String(family.totalRaised ?? ''),
        family.goalReached ? 'objectif atteint' : 'objectif en cours',
        family.visited ? 'visite effectuée' : 'visite en attente',
        family.aidTypes.map((type) => this.familyAidLabel(type)).join(','),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(filterData.search);
    };
  }

  ngOnInit(): void {
    if (!this.canCreateOrUpdate) {
      this.form.disable();
    }

    this.familyService.families$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((families) => {
        this.dataSource.data = families;
        this.applyTableFilters();
      });

    this.visitService.visits$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((visits) => {
        this.visitsSnapshot = visits;
        this.rebuildLastVisitByFamily(visits);
        this.applyTableFilters();
      });

    this.zoneService.zones$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((zones) => {
        this.zones = zones;
        this.syncZoneControlsValidation();

        if (!this.isEditing) {
          const currentZone = this.defaultZoneIdForCurrentUser();
          if (currentZone && !this.form.get('zoneId')?.value && this.zones.length > 0) {
            this.form.patchValue({ zoneId: currentZone }, { emitEvent: false });
          }
        }
      });

    this.reloadFamilies();
  }

  ngAfterViewInit(): void {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }

    if (this.sort) {
      this.dataSource.sortingDataAccessor = (item, property) => {
        switch (property) {
          case 'name':
            return item.name.toLowerCase();
          case 'address':
            return item.address.toLowerCase();
          case 'aidTypes':
            return item.aidTypes.join(',').toLowerCase();
          case 'donationProgress':
            return Number(item.totalRaised ?? 0);
          case 'visited':
            return item.visited ? 1 : 0;
          case 'numberOfPeople':
            return item.numberOfPeople;
          case 'date_de_naissance':
            return item.date_de_naissance ? new Date(item.date_de_naissance).getTime() : 0;
          case 'lastVisit':
            return this.lastVisitDateForFamily(item._id)
              ? new Date(this.lastVisitDateForFamily(item._id) as string).getTime()
              : 0;
          case 'household':
            return item.nombre_enfants ?? 0;
          default:
            return '';
        }
      };
      this.dataSource.sort = this.sort;
    }
  }

  get displayedColumns(): string[] {
    const base = [
      'name',
      'address',
      'aidTypes',
      'donationProgress',
      'visited',
      'numberOfPeople',
      'date_de_naissance',
      'lastVisit',
      'household',
    ];
    return this.canEditOrDelete ? [...base, 'actions'] : base;
  }

  get canCreateOrUpdate(): boolean {
    return this.authService.hasAnyRole(['admin', 'coordinator', 'responsible']);
  }

  get canDelete(): boolean {
    return this.authService.hasRole('admin');
  }

  get canEditOrDelete(): boolean {
    return this.canCreateOrUpdate || this.canDelete;
  }

  get mapPickerPoint(): Geolocation | null {
    const latitude = this.form.get('latitude')?.value;
    const longitude = this.form.get('longitude')?.value;

    if (latitude === null || longitude === null) {
      return null;
    }

    return {
      latitude: Number(latitude),
      longitude: Number(longitude),
    };
  }

  reloadFamilies(): void {
    this.errorMessage = '';

    this.zoneService
      .loadZones({ page: 1, limit: 100 })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, 'Impossible de charger les zones.');
          return EMPTY;
        })
      )
      .subscribe();

    this.familyService
      .loadFamilies({ page: 1, limit: 100 })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, 'Impossible de charger les familles.');
          return EMPTY;
        })
      )
      .subscribe();

    this.visitService
      .loadVisits({ page: 1, limit: 100 })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, 'Impossible de charger les visites.');
          return EMPTY;
        })
      )
      .subscribe();
  }

  applyFilter(value: string): void {
    this.tableSearchTerm = value.trim().toLowerCase();
    this.applyTableFilters();
  }

  onAidTypeFilterChange(aidType: FamilyAidType | ''): void {
    this.selectedAidTypeFilter = aidType;
    this.applyTableFilters();
  }

  submit(): void {
    if (!this.canCreateOrUpdate) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    this.errorMessage = '';
    this.isSubmitting = true;
    const wasEditing = this.isEditing;

    const request$ =
      this.isEditing && this.editingFamilyId
        ? this.familyService.updateFamily(this.editingFamilyId, payload)
        : this.familyService.createFamily(payload);

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, "Impossible d'enregistrer la famille.");
          this.isSubmitting = false;
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.isSubmitting = false;
        this.resetForm();
        this.snackBar.open(
          wasEditing ? 'Famille mise à jour avec succès.' : 'Famille créée avec succès.',
          'Fermer',
          { duration: 2500 }
        );
      });
  }

  clearForm(): void {
    this.resetForm();
  }

  editFamily(family: Famille): void {
    if (!this.canCreateOrUpdate) {
      return;
    }

    this.isEditing = true;
    this.editingFamilyId = family._id;

    this.form.patchValue({
      name: family.name,
      address: family.address,
      postalCode: family.postalCode,
      zoneId: this.resolveZoneIdForFamily(family),
      zone: family.zone,
      phone: family.phone,
      email: family.email ?? '',
      numberOfPeople: family.numberOfPeople,
      date_de_naissance: this.toDateInputValue(family.date_de_naissance),
      nombre_enfants: family.nombre_enfants ?? 0,
      // occupation: family.occupation ?? '',
      revenu_mensuel: family.revenu_mensuel ?? null,
      situation_logement: family.situation_logement ?? '',
      aidTypes: family.aidTypes,
      donationGoal: Number(family.donationGoal ?? 0),
      observations: family.observations ?? '',
      latitude: family.geolocation?.latitude ?? null,
      longitude: family.geolocation?.longitude ?? null,
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteFamily(family: Famille): void {
    if (!this.canDelete) {
      return;
    }

    const confirmed = window.confirm(`Supprimer la famille "${family.name}" ?`);

    if (!confirmed) {
      return;
    }

    this.errorMessage = '';

    this.familyService
      .deleteFamily(family._id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, 'Impossible de supprimer la famille.');
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.snackBar.open('Famille supprimée.', 'Fermer', { duration: 2000 });
      });
  }

  setCoordinates(point: Geolocation): void {
    this.form.patchValue({
      latitude: Number(point.latitude.toFixed(6)),
      longitude: Number(point.longitude.toFixed(6)),
    });
  }

  clearCoordinates(): void {
    this.form.patchValue({
      latitude: null,
      longitude: null,
    });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  isControlInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
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

  formatAidTypes(value: FamilyAidType[]): string {
    if (!value?.length) {
      return '-';
    }

    return value.map((type) => this.familyAidLabel(type)).join(', ');
  }

  trackZoneById(_index: number, zone: ZoneItem): string {
    return zone._id;
  }

  trackFamilyById(_index: number, family: Famille): string {
    return family._id;
  }

  get mappedFamilies(): Famille[] {
    return this.dataSource.data.filter((family) => !!family.geolocation);
  }

  get mappedVisits(): Visite[] {
    return this.visitsSnapshot.filter((visit) => !!visit.geolocation);
  }

  formatCoordinates(target: { geolocation?: Geolocation | null }): string {
    const geo = target.geolocation;

    if (!geo) {
      return '-';
    }

    return `${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)}`;
  }

  zoneLabel(zone: ZoneItem): string {
    const responsible = zone.responsible?.name ? ` - ${zone.responsible.name}` : '';
    return `${zone.name}${responsible}`;
  }

  donationProgressLabel(family: Famille): string {
    const totalRaised = Number(family.totalRaised ?? 0);
    const donationGoal = Number(family.donationGoal ?? 0);

    if (!donationGoal) {
      return `${this.formatRevenue(totalRaised)} / -`;
    }

    return `${this.formatRevenue(totalRaised)} / ${this.formatRevenue(donationGoal)}`;
  }

  familyGoalReachedLabel(family: Famille): string {
    return family.goalReached ? 'Objectif atteint' : 'En cours';
  }

  familyVisitedLabel(family: Famille): string {
    return family.visited ? 'Visite effectuée' : 'Visite en attente';
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

  formatRevenue(value?: number): string {
    if (value === undefined || value === null) {
      return '-';
    }

    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  housingSituationLabel(value?: HousingSituation): string {
    if (!value) {
      return '-';
    }

    const option = this.housingSituationOptions.find((item) => item.value === value);
    return option?.label ?? value;
  }

  lastVisitDateForFamily(familyId: string): string | undefined {
    return this.lastVisitByFamilyId[familyId];
  }

  private buildPayload(): FamilyPayload {
    const latitude = this.form.get('latitude')?.value;
    const longitude = this.form.get('longitude')?.value;
    const birthDate = String(this.form.get('date_de_naissance')?.value ?? '').trim();
    const occupation = String(this.form.get('occupation')?.value ?? '').trim();
    const housingSituation = String(this.form.get('situation_logement')?.value ?? '').trim();
    const zoneId = String(this.form.get('zoneId')?.value ?? '').trim();
    const typedZoneName = String(this.form.get('zone')?.value ?? '').trim();
    const selectedZone = this.zones.find((zone) => zone._id === zoneId);

    const payload: FamilyPayload = {
      name: String(this.form.get('name')?.value ?? '').trim(),
      address: String(this.form.get('address')?.value ?? '').trim(),
      postalCode: String(this.form.get('postalCode')?.value ?? '').trim(),
      zoneId: zoneId || undefined,
      zone: selectedZone?.name || typedZoneName || undefined,
      phone: String(this.form.get('phone')?.value ?? '').trim(),
      email: String(this.form.get('email')?.value ?? '').trim() || undefined,
      numberOfPeople: Number(this.form.get('numberOfPeople')?.value ?? 1),
      date_de_naissance: birthDate || undefined,
      nombre_enfants: Number(this.form.get('nombre_enfants')?.value ?? 0),
      occupation: occupation || undefined,
      revenu_mensuel:
        this.form.get('revenu_mensuel')?.value === null
          ? undefined
          : Number(this.form.get('revenu_mensuel')?.value),
      situation_logement: (housingSituation as HousingSituation) || undefined,
      aidTypes: (this.form.get('aidTypes')?.value as FamilyAidType[]) ?? [],
      donationGoal: Number(this.form.get('donationGoal')?.value ?? 0),
      observations: String(this.form.get('observations')?.value ?? '').trim(),
    };

    if (latitude !== null && longitude !== null) {
      payload.geolocation = {
        latitude: Number(latitude),
        longitude: Number(longitude),
      };
    }

    return payload;
  }

  private resetForm(): void {
    this.form.reset({
      name: '',
      address: '',
      postalCode: '',
      zoneId: this.defaultZoneIdForCurrentUser() || '',
      zone: '',
      phone: '',
      email: '',
      numberOfPeople: 1,
      date_de_naissance: '',
      nombre_enfants: 0,
      // occupation: '',
      revenu_mensuel: null,
      situation_logement: '',
      aidTypes: [],
      donationGoal: 0,
      observations: '',
      latitude: null,
      longitude: null,
    });

    this.isSubmitting = false;
    this.isEditing = false;
    this.editingFamilyId = null;
  }

  private toDateInputValue(value?: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString().slice(0, 10);
  }

  private rebuildLastVisitByFamily(visits: Visite[]): void {
    const lookup: Record<string, string> = {};

    for (const visit of visits) {
      const familyId = typeof visit.famille === 'string' ? visit.famille : visit.famille._id;
      if (!familyId) {
        continue;
      }

      if (!lookup[familyId]) {
        lookup[familyId] = visit.visitDate;
        continue;
      }

      const current = new Date(lookup[familyId]).getTime();
      const next = new Date(visit.visitDate).getTime();

      if (next > current) {
        lookup[familyId] = visit.visitDate;
      }
    }

    this.lastVisitByFamilyId = lookup;
  }

  private resolveZoneIdForFamily(family: Famille): string {
    if (family.zoneId) {
      return family.zoneId;
    }

    const fallback = this.zones.find(
      (zone) => zone.name.trim().toLowerCase() === family.zone.trim().toLowerCase()
    );

    return fallback?._id || this.defaultZoneIdForCurrentUser() || '';
  }

  private defaultZoneIdForCurrentUser(): string | null {
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser) {
      return null;
    }

    if (currentUser.role === 'admin') {
      return null;
    }

    const assignedZones = this.authService
      .getAssignedZones()
      .map((zone) => zone.trim())
      .filter((zone) => zone.length > 0);

    if (!assignedZones.length) {
      return null;
    }

    const byId = this.zones.find((zone) => assignedZones.includes(zone._id));
    if (byId) {
      return byId._id;
    }

    const byName = this.zones.find((zone) =>
      assignedZones.some((assigned) => assigned.toLowerCase() === zone.name.toLowerCase())
    );

    return byName?._id || assignedZones[0] || null;
  }

  private syncZoneControlsValidation(): void {
    const zoneIdControl = this.form.get('zoneId');
    const zoneNameControl = this.form.get('zone');

    if (!zoneIdControl || !zoneNameControl) {
      return;
    }

    if (this.zones.length > 0) {
      zoneIdControl.setValidators([Validators.required]);
      zoneNameControl.setValidators([Validators.maxLength(80)]);
      zoneNameControl.setValue('', { emitEvent: false });
    } else {
      zoneIdControl.clearValidators();
      zoneIdControl.setValue('', { emitEvent: false });
      zoneNameControl.setValidators([Validators.required, Validators.maxLength(80)]);
    }

    zoneIdControl.updateValueAndValidity({ emitEvent: false });
    zoneNameControl.updateValueAndValidity({ emitEvent: false });
  }

  private applyTableFilters(): void {
    this.dataSource.filter = JSON.stringify({
      search: this.tableSearchTerm,
      aidType: this.selectedAidTypeFilter,
    });

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }
}
