import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { AuthUser } from 'src/app/core/models/auth.models';
import { AuthService } from 'src/app/core/services/auth.service';
import { extractApiErrorMessage } from 'src/app/core/utils/api-error.util';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  user: AuthUser | null = null;
  loading = false;
  errorMessage = '';

  private readonly destroyRef = inject(DestroyRef);

  constructor(private readonly authService: AuthService) {}

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading = true;
    this.errorMessage = '';

    this.authService
      .getMe()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((error: unknown) => {
          this.errorMessage = extractApiErrorMessage(
            error,
            'Impossible de charger le profil.'
          );
          this.loading = false;
          return EMPTY;
        })
      )
      .subscribe((user) => {
        this.user = user;
        this.loading = false;
      });
  }

  logout(): void {
    this.authService.logout(true);
  }

  roleLabel(role: string): string {
    if (role === 'admin') {
      return 'Administrateur';
    }

    if (role === 'coordinator') {
      return 'Coordinateur';
    }

    if (role === 'responsible') {
      return 'Responsable';
    }

    if (role === 'volunteer') {
      return 'Bénévole';
    }

    return role;
  }
}
