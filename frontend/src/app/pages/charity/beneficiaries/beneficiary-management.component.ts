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
  Beneficiaire,
  Famille,
  FamilleReference,
  Gender,
} from 'src/app/core/models/charity.models';
import { extractApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { FamilyService } from 'src/app/features/charity/services/family.service';
import { BeneficiaryService } from 'src/app/features/charity/services/beneficiary.service';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-beneficiary-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './beneficiary-management.component.html',
  styleUrl: './beneficiary-management.component.scss',
})
export class BeneficiaryManagementComponent implements OnInit, AfterViewInit {
  readonly beneficiariesLoading$ = this.beneficiaryService.loading$;
  readonly families$ = this.familyService.families$;
  readonly dataSource = new MatTableDataSource<Beneficiaire>([]);

  readonly genderOptions: Gender[] = ['male', 'female', 'other'];

  errorMessage = '';
  isSubmitting = false;
  isEditing = false;
  editingBeneficiaryId: string | null = null;
  selectedFamilyFilter = '';

  readonly form = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(80)]],
    lastName: ['', [Validators.required, Validators.maxLength(80)]],
    birthDate: ['', [Validators.required]],
    gender: ['male' as Gender, [Validators.required]],
    healthStatus: ['', [Validators.required, Validators.maxLength(4000)]],
    hasDisability: [false],
    famille: ['', [Validators.required]],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly fb: FormBuilder,
    private readonly familyService: FamilyService,
    private readonly beneficiaryService: BeneficiaryService,
    private readonly snackBar: MatSnackBar,
    private readonly authService: AuthService
  ) {
    this.dataSource.filterPredicate = (beneficiary, rawFilter) => {
      const filter = rawFilter.trim().toLowerCase();
      return (
        beneficiary.firstName.toLowerCase().includes(filter) ||
        beneficiary.lastName.toLowerCase().includes(filter) ||
        this.familyName(beneficiary.famille).toLowerCase().includes(filter) ||
        beneficiary.gender.toLowerCase().includes(filter) ||
        (beneficiary.healthHistory ?? '').toLowerCase().includes(filter)
      );
    };
  }

  ngOnInit(): void {
    if (!this.canCreateOrUpdate) {
      this.form.disable();
    }

    this.beneficiaryService.beneficiaries$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((beneficiaries) => {
        this.dataSource.data = beneficiaries;
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
          case 'firstName':
            return item.firstName.toLowerCase();
          case 'lastName':
            return item.lastName.toLowerCase();
          case 'family':
            return this.familyName(item.famille).toLowerCase();
          case 'birthDate':
            return new Date(item.birthDate).getTime();
          case 'gender':
            return item.gender;
          case 'healthStatus':
            return (item.healthHistory ?? '').toLowerCase();
          default:
            return '';
        }
      };
      this.dataSource.sort = this.sort;
    }
  }

  get displayedColumns(): string[] {
    const base = ['firstName', 'lastName', 'birthDate', 'gender', 'healthStatus', 'family'];
    return this.canEditOrDelete ? [...base, 'actions'] : base;
  }

  get canCreateOrUpdate(): boolean {
    return this.authService.hasAnyRole(['admin', 'coordinator']);
  }

  get canDelete(): boolean {
    return this.authService.hasRole('admin');
  }

  get canEditOrDelete(): boolean {
    return this.canCreateOrUpdate || this.canDelete;
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

    this.reloadBeneficiaries();
  }

  applyFilter(value: string): void {
    this.dataSource.filter = value.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  onFamilyFilterChange(familyId: string): void {
    this.selectedFamilyFilter = familyId;
    this.reloadBeneficiaries();
  }

  submit(): void {
    if (!this.canCreateOrUpdate) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;
    const wasEditing = this.isEditing;

    const payload = {
      firstName: String(this.form.get('firstName')?.value ?? '').trim(),
      lastName: String(this.form.get('lastName')?.value ?? '').trim(),
      birthDate: new Date(String(this.form.get('birthDate')?.value ?? '')).toISOString(),
      gender: (this.form.get('gender')?.value as Gender) ?? 'male',
      hasDisability: Boolean(this.form.get('hasDisability')?.value),
      healthHistory: String(this.form.get('healthStatus')?.value ?? '').trim(),
      famille: String(this.form.get('famille')?.value ?? ''),
    };

    const request$ =
      this.isEditing && this.editingBeneficiaryId
        ? this.beneficiaryService.updateBeneficiary(this.editingBeneficiaryId, payload)
        : this.beneficiaryService.createBeneficiary(payload);

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, "Impossible d'enregistrer le bénéficiaire.");
          this.isSubmitting = false;
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.isSubmitting = false;
        this.resetForm();
        this.snackBar.open(
          wasEditing
            ? 'Bénéficiaire mis à jour avec succès.'
            : 'Bénéficiaire créé avec succès.',
          'Fermer',
          { duration: 2500 }
        );
      });
  }

  clearForm(): void {
    this.resetForm();
  }

  editBeneficiary(beneficiary: Beneficiaire): void {
    if (!this.canCreateOrUpdate) {
      return;
    }

    this.isEditing = true;
    this.editingBeneficiaryId = beneficiary._id;

    this.form.patchValue({
      firstName: beneficiary.firstName,
      lastName: beneficiary.lastName,
      birthDate: this.toDateInputValue(beneficiary.birthDate),
      gender: beneficiary.gender,
      healthStatus: beneficiary.healthHistory ?? '',
      hasDisability: beneficiary.hasDisability,
      famille:
        typeof beneficiary.famille === 'string'
          ? beneficiary.famille
          : beneficiary.famille._id,
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteBeneficiary(beneficiary: Beneficiaire): void {
    if (!this.canDelete) {
      return;
    }

    const confirmed = window.confirm(
      `Supprimer le bénéficiaire "${beneficiary.firstName} ${beneficiary.lastName}" ?`
    );

    if (!confirmed) {
      return;
    }

    this.errorMessage = '';

    this.beneficiaryService
      .deleteBeneficiary(beneficiary._id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, 'Impossible de supprimer le bénéficiaire.');
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.snackBar.open('Bénéficiaire supprimé.', 'Fermer', { duration: 2000 });
      });
  }

  familyName(ref: string | FamilleReference): string {
    if (typeof ref === 'string') {
      return ref;
    }

    return ref.name ?? ref._id;
  }

  familyTrackById(_index: number, family: Famille): string {
    return family._id;
  }

  genderLabel(gender: Gender): string {
    if (gender === 'male') {
      return 'Homme';
    }

    if (gender === 'female') {
      return 'Femme';
    }

    return 'Autre';
  }

  isControlInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  private resetForm(): void {
    this.form.reset({
      firstName: '',
      lastName: '',
      birthDate: '',
      gender: 'male',
      healthStatus: '',
      hasDisability: false,
      famille: '',
    });

    this.isSubmitting = false;
    this.isEditing = false;
    this.editingBeneficiaryId = null;
  }

  private reloadBeneficiaries(): void {
    const request$ = this.selectedFamilyFilter
      ? this.beneficiaryService.loadBeneficiariesForFamily(this.selectedFamilyFilter, {
          page: 1,
          limit: 100,
        })
      : this.beneficiaryService.loadBeneficiaries({ page: 1, limit: 100 });

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(error, 'Impossible de charger les bénéficiaires.');
          return EMPTY;
        })
      )
      .subscribe();
  }

  private toDateInputValue(value: string): string {
    return value ? new Date(value).toISOString().slice(0, 10) : '';
  }
}
