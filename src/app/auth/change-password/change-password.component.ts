import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { SessionService } from '../../core/session.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

/** The signed-in user changes their own password (JSF sysadmin/change-password.xhtml). */
@Component({
  selector: 'app-change-password',
  imports: [FormsModule, ButtonModule, PasswordModule, PageHeaderComponent],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.scss',
})
export class ChangePasswordComponent {
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  session = inject(SessionService);

  current = '';
  newPassword = '';
  retype = '';
  saving = false;

  async save() {
    if (!this.current || !this.newPassword) {
      this.notify.warn('Enter the current and new password');
      return;
    }
    if (this.newPassword !== this.retype) {
      this.notify.warn('The new passwords do not match');
      return;
    }
    this.saving = true;
    const response = await this.auth.changePassword(this.current, this.newPassword);
    this.saving = false;
    if (response.success) {
      this.current = this.newPassword = this.retype = '';
    }
  }
}
