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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import {
  AidType,
  Aide,
  Famille,
  FamilleReference,
} from 'src/app/core/models/charity.models';
import { extractApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { FamilyService } from 'src/app/features/charity/services/family.service';
import { AidService } from 'src/app/features/charity/services/aid.service';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-aid-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './aid-management.component.html',
  styleUrl: './aid-management.component.scss',
})
export class AidManagementComponent implements OnInit, AfterViewInit {
  readonly aidsLoading$ = this.aidService.loading$;
  readonly families$ = this.familyService.families$;
  readonly dataSource = new MatTableDataSource<Aide>([]);
  readonly aidTypeOptions: AidType[] = ['alimentaire', 'medication', 'aide_specifique'];
  readonly maxAidDate = new Date().toISOString().slice(0, 10);

  errorMessage = '';
  isSubmitting = false;
  isEditing = false;
  editingAidId: string | null = null;
  selectedFamilyFilter = '';
  private tableSearchTerm = '';

  readonly form = this.fb.group({
    type: ['alimentaire' as AidType, [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    aidDate: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)]],
    famille: ['', [Validators.required]],
    observations: ['', [Validators.maxLength(2000)]],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly fb: FormBuilder,
    private readonly aidService: AidService,
    private readonly familyService: FamilyService,
    private readonly snackBar: MatSnackBar,
    private readonly authService: AuthService
  ) {
    this.dataSource.filterPredicate = (aid, rawFilter) => {
      let filterData: { search: string; familyId: string } = {
        search: '',
        familyId: '',
      };

      try {
        filterData = JSON.parse(rawFilter) as { search: string; familyId: string };
      } catch {
        filterData.search = rawFilter.trim().toLowerCase();
      }

      const familyId = this.familyId(aid.famille);
      if (filterData.familyId && familyId !== filterData.familyId) {
        return false;
      }

      if (!filterData.search) {
        return true;
      }

      const haystack = [
        this.aidTypeLabel(aid.type),
        aid.type,
        String(aid.quantity),
        this.familyName(aid.famille),
        this.formatDate(aid.aidDate),
        this.formatDateTime(aid.aidDate),
        aid.observations ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(filterData.search);
    };
  }

  ngOnInit(): void {
    if (!this.canCreate) {
      this.form.disable();
    }

    this.aidService.aids$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((aids) => {
        this.dataSource.data = aids;
        this.applyTableFilters();
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
          case 'type':
            return item.type;
          case 'quantity':
            return item.quantity;
          case 'aidDate':
            return new Date(item.aidDate).getTime();
          case 'family':
            return this.familyName(item.famille).toLowerCase();
          default:
            return '';
        }
      };
      this.dataSource.sort = this.sort;
    }
  }

  get displayedColumns(): string[] {
    const base = ['type', 'quantity', 'aidDate', 'family'];
    return this.canEditOrDelete ? [...base, 'actions'] : base;
  }

  get canCreate(): boolean {
    return this.authService.hasAnyRole(['admin', 'coordinator', 'volunteer']);
  }

  get canUpdate(): boolean {
    return this.authService.hasAnyRole(['admin', 'coordinator']);
  }

  get canDelete(): boolean {
    return this.authService.hasRole('admin');
  }

  get canEditOrDelete(): boolean {
    return this.canUpdate || this.canDelete;
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

    this.reloadAids();
  }

  applyFilter(value: string): void {
    this.tableSearchTerm = value.trim().toLowerCase();
    this.applyTableFilters();
  }

  onFamilyFilterChange(familyId: string): void {
    this.selectedFamilyFilter = familyId;
    this.applyTableFilters();
    this.reloadAids();
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

    const aidDateRaw = String(this.form.get('aidDate')?.value ?? '').trim();

    const payload = {
      type: (this.form.get('type')?.value as AidType) ?? 'alimentaire',
      quantity: Number(this.form.get('quantity')?.value ?? 1),
      aidDate: aidDateRaw || undefined,
      observations: String(this.form.get('observations')?.value ?? '').trim() || undefined,
      famille: String(this.form.get('famille')?.value ?? ''),
    };

    const request$ =
      this.isEditing && this.editingAidId
        ? this.aidService.updateAid(this.editingAidId, payload)
        : this.aidService.createAid(payload);

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, "Impossible d'enregistrer l'aide.");
          this.isSubmitting = false;
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.isSubmitting = false;
        this.resetForm();
        this.reloadAids();
        this.snackBar.open(
          wasEditing ? 'Aide mise à jour avec succès.' : 'Aide enregistrée avec succès.',
          'Fermer',
          { duration: 2500 }
        );
      });
  }

  clearForm(): void {
    this.resetForm();
  }

  editAid(aid: Aide): void {
    if (!this.canUpdate) {
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;

    this.aidService
      .getAid(aid._id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(
            error,
            "Impossible de charger les détails de l'aide."
          );
          this.isSubmitting = false;
          return EMPTY;
        })
      )
      .subscribe((aidDetails) => {
        this.isSubmitting = false;
        this.isEditing = true;
        this.editingAidId = aidDetails._id;

        this.form.patchValue({
          type: aidDetails.type,
          quantity: aidDetails.quantity,
          aidDate: this.toDateInputValue(aidDetails.aidDate),
          observations: aidDetails.observations ?? '',
          famille: this.familyId(aidDetails.famille),
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
  }

  deleteAid(aid: Aide): void {
    if (!this.canDelete) {
      return;
    }

    const confirmed = window.confirm(`Supprimer l'aide "${this.aidTypeLabel(aid.type)}" ?`);

    if (!confirmed) {
      return;
    }

    this.errorMessage = '';

    this.aidService
      .deleteAid(aid._id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, "Impossible de supprimer l'aide.");
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.snackBar.open('Aide supprimée.', 'Fermer', { duration: 2000 });
      });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  familyName(ref: string | FamilleReference): string {
    if (typeof ref === 'string') {
      return ref;
    }

    return ref.name ?? ref._id;
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

  familyTrackById(_index: number, family: Famille): string {
    return family._id;
  }

  isControlInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  controlError(controlName: string): string {
    const control = this.form.get(controlName);
    if (!control?.errors) {
      return 'Valeur invalide.';
    }

    if (control.errors['required']) {
      return 'Ce champ est obligatoire.';
    }

    if (control.errors['min']) {
      return 'Doit être supérieur ou égal à 1.';
    }

    if (control.errors['pattern'] && controlName === 'aidDate') {
      return 'Veuillez saisir une date valide.';
    }

    if (control.errors['pattern'] && controlName === 'quantity') {
      return 'Veuillez saisir un entier valide.';
    }

    if (control.errors['maxlength']) {
      return 'Le texte est trop long.';
    }

    return 'Valeur invalide.';
  }

  private resetForm(): void {
    this.form.reset({
      type: 'alimentaire',
      quantity: 1,
      aidDate: '',
      observations: '',
      famille: '',
    });

    this.isSubmitting = false;
    this.isEditing = false;
    this.editingAidId = null;
  }

  private familyId(ref: string | FamilleReference): string {
    return typeof ref === 'string' ? ref : ref._id;
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

  private applyTableFilters(): void {
    this.dataSource.filter = JSON.stringify({
      search: this.tableSearchTerm,
      familyId: this.selectedFamilyFilter,
    });

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private reloadAids(): void {
    const request$ = this.selectedFamilyFilter
      ? this.aidService.loadAidsForFamily(this.selectedFamilyFilter, { page: 1, limit: 100 })
      : this.aidService.loadAids({ page: 1, limit: 100 });

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, 'Impossible de charger les aides.');
          return EMPTY;
        })
      )
      .subscribe();
  }
}
