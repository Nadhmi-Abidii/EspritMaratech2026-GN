import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, finalize, forkJoin, of, startWith } from 'rxjs';
import {
  Beneficiaire,
  Famille,
} from 'src/app/core/models/charity.models';
import {
  PublicPostAssociationType,
  PublicPostItem,
} from 'src/app/core/models/public.models';
import { extractApiErrorMessage } from 'src/app/core/utils/api-error.util';
import { BeneficiaryService } from 'src/app/features/charity/services/beneficiary.service';
import { FamilyService } from 'src/app/features/charity/services/family.service';
import { PublicService } from 'src/app/features/public/services/public.service';
import { MaterialModule } from 'src/app/material.module';

@Component({
  selector: 'app-post-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './post-management.component.html',
  styleUrl: './post-management.component.scss',
})
export class PostManagementComponent implements OnInit {
  readonly postForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(180)]],
    content: ['', [Validators.required, Validators.maxLength(4000)]],
    donationGoal: [5000, [Validators.required, Validators.min(1)]],
    associationType: ['none' as PublicPostAssociationType, [Validators.required]],
    associationEntityId: [''],
  });

  posts: PublicPostItem[] = [];
  families: Famille[] = [];
  beneficiaries: Beneficiaire[] = [];

  isLoading = false;
  isSubmitting = false;
  editingPostId: string | null = null;
  deletingPostId: string | null = null;

  loadErrorMessage = '';
  submitErrorMessage = '';
  submitSuccessMessage = '';

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly fb: FormBuilder,
    private readonly publicService: PublicService,
    private readonly familyService: FamilyService,
    private readonly beneficiaryService: BeneficiaryService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.postForm.controls.associationType.valueChanges
      .pipe(
        startWith(this.postForm.controls.associationType.value),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((associationType) => {
        this.syncAssociationValidation(associationType);
      });

    this.refreshData();
  }

  get isEditing(): boolean {
    return !!this.editingPostId;
  }

  get associationTypeControlValue(): PublicPostAssociationType {
    return this.postForm.controls.associationType.value;
  }

  get associationEntities(): Array<Famille | Beneficiaire> {
    if (this.associationTypeControlValue === 'family') {
      return this.families;
    }

    if (this.associationTypeControlValue === 'beneficiary') {
      return this.beneficiaries;
    }

    return [];
  }

  trackPostById(_index: number, post: PublicPostItem): string {
    return post._id;
  }

  trackFamilyById(_index: number, family: Famille): string {
    return family._id;
  }

  trackBeneficiaryById(_index: number, beneficiary: Beneficiaire): string {
    return beneficiary._id;
  }

  trackEntityById(_index: number, entity: { _id: string }): string {
    return entity._id;
  }

  refreshData(): void {
    this.isLoading = true;
    this.loadErrorMessage = '';

    const errors: string[] = [];

    forkJoin({
      posts: this.publicService.loadPosts(100).pipe(
        catchError((error: unknown) => {
          errors.push(extractApiErrorMessage(error, 'Impossible de charger les publications.'));
          return of([] as PublicPostItem[]);
        })
      ),
      families: this.familyService.loadFamilies({ page: 1, limit: 100 }).pipe(
        catchError((error: unknown) => {
          errors.push(extractApiErrorMessage(error, 'Impossible de charger les familles.'));
          return of([] as Famille[]);
        })
      ),
      beneficiaries: this.beneficiaryService.loadBeneficiaries({ page: 1, limit: 100 }).pipe(
        catchError((error: unknown) => {
          errors.push(extractApiErrorMessage(error, 'Impossible de charger les bénéficiaires.'));
          return of([] as Beneficiaire[]);
        })
      ),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isLoading = false;
          this.loadErrorMessage = errors.join(' ');
        })
      )
      .subscribe(({ posts, families, beneficiaries }) => {
        this.posts = [...posts].sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        );
        this.families = families;
        this.beneficiaries = beneficiaries;
      });
  }

  submitPost(): void {
    this.submitErrorMessage = '';
    this.submitSuccessMessage = '';

    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      return;
    }

    const values = this.postForm.getRawValue();
    const associationEntityId = values.associationEntityId?.trim();

    const payload = {
      title: values.title.trim(),
      content: values.content.trim(),
      donationGoal: Number(values.donationGoal),
      associationType: values.associationType,
      family: values.associationType === 'family' ? associationEntityId || null : null,
      beneficiary:
        values.associationType === 'beneficiary' ? associationEntityId || null : null,
    };

    this.isSubmitting = true;

    const request$ = this.editingPostId
      ? this.publicService.updatePost(this.editingPostId, payload)
      : this.publicService.createPost(payload);

    request$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isSubmitting = false;
        })
      )
      .subscribe({
        next: (post) => {
          if (this.editingPostId) {
            this.posts = this.posts.map((entry) => (entry._id === post._id ? post : entry));
            this.submitSuccessMessage = 'Publication mise à jour avec succès.';
            this.snackBar.open('Publication mise à jour avec succès.', 'Fermer', {
              duration: 3000,
            });
          } else {
            this.posts = [post, ...this.posts.filter((entry) => entry._id !== post._id)];
            this.submitSuccessMessage = 'Publication créée avec succès.';
            this.snackBar.open('Publication créée avec succès.', 'Fermer', {
              duration: 3000,
            });
          }

          this.posts = [...this.posts].sort(
            (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
          );
          this.clearForm();
        },
        error: (error: unknown) => {
          this.submitErrorMessage = extractApiErrorMessage(error, "Impossible d'enregistrer la publication.");
        },
      });
  }

  editPost(post: PublicPostItem): void {
    const associationEntityId =
      post.associationType === 'family'
        ? post.familyId || ''
        : post.associationType === 'beneficiary'
          ? post.beneficiaryId || ''
          : '';

    this.editingPostId = post._id;
    this.submitErrorMessage = '';
    this.submitSuccessMessage = '';

    this.postForm.reset({
      title: post.title,
      content: post.content,
      donationGoal: post.donationGoal,
      associationType: post.associationType,
      associationEntityId,
    });
  }

  deletePost(post: PublicPostItem): void {
    this.submitErrorMessage = '';
    this.submitSuccessMessage = '';

    if (!window.confirm(`Supprimer la publication "${post.title}" définitivement ?`)) {
      return;
    }

    this.deletingPostId = post._id;

    this.publicService
      .deletePost(post._id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.deletingPostId = null;
        })
      )
      .subscribe({
        next: () => {
          this.posts = this.posts.filter((entry) => entry._id !== post._id);

          if (this.editingPostId === post._id) {
            this.clearForm();
          }

          this.submitSuccessMessage = 'Publication supprimée avec succès.';
          this.snackBar.open('Publication supprimée avec succès.', 'Fermer', {
            duration: 3000,
          });
        },
        error: (error: unknown) => {
          this.submitErrorMessage = extractApiErrorMessage(error, 'Impossible de supprimer la publication.');
        },
      });
  }

  clearForm(): void {
    this.editingPostId = null;
    this.postForm.reset({
      title: '',
      content: '',
      donationGoal: 5000,
      associationType: 'none',
      associationEntityId: '',
    });
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  progressBarStyle(post: PublicPostItem): Record<string, string> {
    const normalized = Math.max(0, Math.min(post.progressPercent, 100));

    return {
      width: `${normalized}%`,
    };
  }

  postProgressTone(post: PublicPostItem): 'green' | 'blue' | 'orange' {
    if (post.progressPercent >= 80) {
      return 'orange';
    }

    if (post.progressPercent >= 50) {
      return 'blue';
    }

    return 'green';
  }

  associationLabel(post: PublicPostItem): string {
    if (post.association.type === 'family' && post.association.family) {
      return `Famille : ${post.association.family.name}`;
    }

    if (post.association.type === 'beneficiary' && post.association.beneficiary) {
      const beneficiary = post.association.beneficiary;
      return `Bénéficiaire : ${beneficiary.firstName} ${beneficiary.lastName}`;
    }

    return 'Campagne générale';
  }

  isDeleting(postId: string): boolean {
    return this.deletingPostId === postId;
  }

  familyLabel(family: Famille): string {
    return `${family.name} (${family.zone})`;
  }

  beneficiaryLabel(beneficiary: Beneficiaire): string {
    const familyName =
      typeof beneficiary.famille === 'string'
        ? beneficiary.famille
        : beneficiary.famille.name || beneficiary.famille._id;

    return `${beneficiary.firstName} ${beneficiary.lastName} - ${familyName}`;
  }

  associationEntityLabel(entity: Famille | Beneficiaire): string {
    if (this.associationTypeControlValue === 'family') {
      return this.familyLabel(entity as Famille);
    }

    return this.beneficiaryLabel(entity as Beneficiaire);
  }

  private syncAssociationValidation(associationType: PublicPostAssociationType): void {
    const associationEntityIdControl = this.postForm.controls.associationEntityId;

    if (associationType === 'none') {
      associationEntityIdControl.clearValidators();
      associationEntityIdControl.setValue('');
    } else {
      associationEntityIdControl.setValidators([Validators.required]);
    }

    associationEntityIdControl.updateValueAndValidity({ emitEvent: false });
  }
}
