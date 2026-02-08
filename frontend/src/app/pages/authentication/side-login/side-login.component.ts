import { Component } from '@angular/core';
import { CoreService } from 'src/app/services/core.service';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MaterialModule } from '../../../material.module';
import { AuthService } from 'src/app/core/services/auth.service';
import { extractApiErrorMessage } from 'src/app/core/utils/api-error.util';

@Component({
  selector: 'app-side-login',
  standalone: true,
  imports: [RouterModule, MaterialModule, FormsModule, ReactiveFormsModule],
  templateUrl: './side-login.component.html',
})
export class AppSideLoginComponent {
  options = this.settings.getOptions();

  isSubmitting = false;
  loginError = '';

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });

  constructor(
    private readonly settings: CoreService,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute
  ) {}

  get f() {
    return this.form.controls;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loginError = '';
    this.isSubmitting = true;

    this.authService
      .login({
        email: String(this.form.value.email ?? '').trim(),
        password: String(this.form.value.password ?? ''),
      })
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          const returnUrl =
            this.route.snapshot.queryParamMap.get('returnUrl') || '/charity/home';
          this.router.navigateByUrl(returnUrl);
        },
        error: (error: unknown) => {
          this.loginError = extractApiErrorMessage(error, 'Connexion echouee.');
          this.isSubmitting = false;
        },
      });
  }
}
