import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { SessionService } from '../../core/session.service';

/**
 * Staff sign-in. Same screen as the JSF login.xhtml: identity pane on the left,
 * the form on the right, password reveal and a Caps Lock warning. Styles are in
 * login.component.scss, ported from webapp/assets/css/login.css.
 */
@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private session = inject(SessionService);

  readonly production = environment.production;

  email = '';
  password = '';
  loading = false;
  error = '';
  showPassword = false;
  capsOn = false;
  expired = !!this.route.snapshot.queryParamMap.get('expired');

  constructor() {
    if (this.session.loggedIn()) {
      this.router.navigateByUrl('/');
    }
  }

  checkCaps(event: KeyboardEvent) {
    if (typeof event.getModifierState === 'function') {
      this.capsOn = event.getModifierState('CapsLock');
    }
  }

  async submit() {
    this.error = '';
    if (!this.email.trim()) {
      this.error = 'Enter your username';
      return;
    }
    if (!this.password) {
      this.error = 'Enter your password';
      return;
    }
    this.loading = true;
    const response = await this.auth.login(this.email.trim(), this.password);
    this.loading = false;
    if (response.success) {
      this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') || '/');
    } else {
      this.error = response.message || 'Wrong username or password.';
      this.password = '';
    }
  }
}
