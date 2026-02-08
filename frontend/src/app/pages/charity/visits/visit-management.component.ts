import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { EMPTY, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MaterialModule } from 'src/app/material.module';
import {
  Aide,
  Famille,
  FamilleReference,
  Visite,
} from 'src/app/core/models/charity.models';
import { extractApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { FamilyService } from 'src/app/features/charity/services/family.service';
import { AidService } from 'src/app/features/charity/services/aid.service';
import { VisitService } from 'src/app/features/charity/services/visit.service';
import { GeoMapComponent } from '../map/geo-map.component';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-visit-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, GeoMapComponent],
  templateUrl: './visit-management.component.html',
  styleUrl: './visit-management.component.scss',
})
export class VisitManagementComponent implements OnInit, AfterViewInit {
  readonly visitsLoading$ = this.visitService.loading$;
  readonly families$ = this.familyService.families$;
  readonly aids$ = this.aidService.aids$;
  readonly dataSource = new MatTableDataSource<Visite>([]);

  errorMessage = '';
  isSubmitting = false;
  isEditing = false;
  editingVisitId: string | null = null;
  selectedFamilyFilter = '';

  private aidsSnapshot: Aide[] = [];

  readonly form = this.fb.group({
    visitDate: ['', [Validators.required]],
    famille: ['', [Validators.required]],
    aideId: [''],
    notes: ['', [Validators.maxLength(2000)]],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly fb: FormBuilder,
    private readonly familyService: FamilyService,
    private readonly aidService: AidService,
    private readonly visitService: VisitService,
    private readonly snackBar: MatSnackBar,
    private readonly authService: AuthService
  ) {
    this.dataSource.filterPredicate = (visit, rawFilter) => {
      const filter = rawFilter.trim().toLowerCase();
      return (
        this.familyName(visit.famille).toLowerCase().includes(filter) ||
        (visit.notes ?? '').toLowerCase().includes(filter) ||
        this.visitAidSummary(visit).toLowerCase().includes(filter) ||
        new Date(visit.visitDate).toLocaleString('fr-FR').toLowerCase().includes(filter)
      );
    };
  }

  ngOnInit(): void {
    this.visitService.visits$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((visits) => {
        this.dataSource.data = visits;
      });

    this.aids$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((aids) => (this.aidsSnapshot = aids));

    this.form
      .get('famille')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const selectedAid = String(this.form.get('aideId')?.value ?? '');
        if (!selectedAid) {
          return;
        }

        const stillValid = this.filteredAids.some((aid) => aid._id === selectedAid);
        if (!stillValid) {
          this.form.patchValue({ aideId: '' }, { emitEvent: false });
        }
      });

    this.reload();
  }

  ngAfterViewInit(): void {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }

    if (this.sort) {
      this.dataSource.sortingDataAccessor = (item, property) => {
        switch (property) {
          case 'visitDate':
            return new Date(item.visitDate).getTime();
          case 'family':
            return this.familyName(item.famille).toLowerCase();
          case 'aidDistributed':
            return this.visitAidSummary(item).toLowerCase();
          case 'observations':
            return (item.notes ?? '').toLowerCase();
          default:
            return '';
        }
      };
      this.dataSource.sort = this.sort;
    }
  }

  get displayedColumns(): string[] {
    const base = ['visitDate', 'family', 'aidDistributed', 'observations'];
    return this.canEditOrDelete ? [...base, 'actions'] : base;
  }

  get canCreate(): boolean {
    return this.authService.hasAnyRole(['admin', 'coordinator', 'volunteer']);
  }

  get canUpdate(): boolean {
    return this.authService.hasAnyRole(['admin', 'coordinator', 'volunteer']);
  }

  get canDelete(): boolean {
    return this.authService.hasRole('admin');
  }

  get canEditOrDelete(): boolean {
    return this.canUpdate || this.canDelete;
  }

  get filteredAids(): Aide[] {
    const selectedFamilyId = String(this.form.get('famille')?.value ?? '');

    if (!selectedFamilyId) {
      return this.aidsSnapshot;
    }

    return this.aidsSnapshot.filter((aid) => {
      const familleRef = aid.famille;
      const familyId = typeof familleRef === 'string' ? familleRef : familleRef._id;
      return familyId === selectedFamilyId;
    });
  }

  reload(): void {
    this.errorMessage = '';

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

    this.aidService
      .loadAids({ page: 1, limit: 100 })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, 'Impossible de charger les aides.');
          return EMPTY;
        })
      )
      .subscribe();

    this.reloadVisits();
  }

  applyFilter(value: string): void {
    this.dataSource.filter = value.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  onSelectOpened(opened: boolean): void {
    if (!opened) {
      return;
    }

    // Workaround: on some layouts/browsers the CDK overlay position is not
    // calculated until the first real viewport resize (opening devtools triggers it).
    // Forcing a resize event right after opening makes mat-select panels render
    // at the correct position consistently.
    setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
  }

  onFamilyFilterChange(familyId: string): void {
    this.selectedFamilyFilter = familyId;
    this.reloadVisits();
  }

  submit(): void {
    if (!this.canCreate) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;
    const wasEditing = this.isEditing;

    const visitDateRaw = String(this.form.get('visitDate')?.value ?? '');
    const aidId = String(this.form.get('aideId')?.value ?? '').trim();

    const payload = {
      visitDate: visitDateRaw ? new Date(visitDateRaw).toISOString() : undefined,
      famille: String(this.form.get('famille')?.value ?? ''),
      aides: aidId ? [aidId] : [],
      notes: String(this.form.get('notes')?.value ?? '').trim(),
    };

    const request$ =
      this.isEditing && this.editingVisitId
        ? this.visitService.updateVisit(this.editingVisitId, payload)
        : this.visitService.createVisit(payload);

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, "Impossible d'enregistrer la visite.");
          this.isSubmitting = false;
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.isSubmitting = false;
        this.resetForm();
        this.snackBar.open(
          wasEditing ? 'Visite mise à jour avec succès.' : 'Visite enregistrée avec succès.',
          'Fermer',
          { duration: 2500 }
        );
      });
  }

  clearForm(): void {
    this.resetForm();
  }

  editVisit(visit: Visite): void {
    if (!this.canUpdate) {
      return;
    }

    this.isEditing = true;
    this.editingVisitId = visit._id;

    const firstAid = (visit.aides ?? [])[0];
    const firstAidId = typeof firstAid === 'string' ? firstAid : firstAid?._id;

    this.form.patchValue({
      visitDate: this.toDateInputValue(visit.visitDate),
      famille: typeof visit.famille === 'string' ? visit.famille : visit.famille._id,
      aideId: firstAidId ?? '',
      notes: visit.notes ?? '',
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteVisit(visit: Visite): void {
    if (!this.canDelete) {
      return;
    }

    const confirmed = window.confirm(
      `Supprimer la visite du ${new Date(visit.visitDate).toLocaleString('fr-FR')} ?`
    );

    if (!confirmed) {
      return;
    }

    this.errorMessage = '';

    this.visitService
      .deleteVisit(visit._id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, 'Impossible de supprimer la visite.');
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.snackBar.open('Visite supprimée.', 'Fermer', { duration: 2000 });
      });
  }

  familyName(ref: string | FamilleReference): string {
    if (typeof ref === 'string') {
      return ref;
    }

    return ref.name ?? ref._id;
  }

  aidLabel(aid: Aide): string {
    return `${this.aidTypeLabel(aid.type)} (${aid.quantity})`;
  }

  visitAidSummary(visit: Visite): string {
    const labels = (visit.aides ?? [])
      .map((aid) => {
        if (typeof aid === 'string') {
          return null;
        }

        return this.aidLabel(aid);
      })
      .filter((value): value is string => !!value);

    return labels.length ? labels.join(', ') : '-';
  }

  trackFamilyById(_index: number, family: Famille): string {
    return family._id;
  }

  trackAidById(_index: number, aid: Aide): string {
    return aid._id;
  }

  isControlInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  private resetForm(): void {
    this.form.reset({
      visitDate: '',
      famille: '',
      aideId: '',
      notes: '',
    });

    this.isSubmitting = false;
    this.isEditing = false;
    this.editingVisitId = null;
  }

  private toDateInputValue(value: string): string {
    return value ? new Date(value).toISOString().slice(0, 10) : '';
  }

  private reloadVisits(): void {
    const request$ = this.selectedFamilyFilter
      ? this.visitService.loadVisitsForFamily(this.selectedFamilyFilter, {
          page: 1,
          limit: 100,
        })
      : this.visitService.loadVisits({ page: 1, limit: 100 });

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, 'Impossible de charger les visites.');
          return EMPTY;
        })
      )
      .subscribe();
  }

  private aidTypeLabel(type: string): string {
    if (type === 'alimentaire') {
      return 'Alimentaire';
    }

    if (type === 'medication') {
      return 'Médicaments';
    }

    if (type === 'aide_specifique') {
      return 'Aide spécifique';
    }

    return type;
  }
}
