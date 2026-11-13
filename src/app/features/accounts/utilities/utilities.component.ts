import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ApiService } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { EntityPickerComponent } from '../../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';

/** Account utilities (JSF accounts/account-utilities.xhtml): reset a retail investor's portal password. */
@Component({
  selector: 'app-account-utilities',
  imports: [FormsModule, ButtonModule, InputTextModule, PasswordModule, PageHeaderComponent, EntityPickerComponent],
  templateUrl: './utilities.component.html',
  styleUrl: './utilities.component.scss',
})
export class UtilitiesComponent {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  investor: any = null;
  password = '';
  confirmPassword = '';
  saving = false;

  select(investor: any) {
    this.investor = investor;
    this.password = '';
    this.confirmPassword = '';
  }

  async change() {
    if (!this.password || this.password.length < 8) {
      this.notify.warn('The password must be at least 8 characters');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.notify.warn('The passwords do not match');
      return;
    }
    const ok = await this.notify.confirm(`Set a new portal password for ${this.investor.displayName}?`);
    if (!ok) {
      return;
    }
    this.saving = true;
    const response = await this.api.put(`investor-utilities/${this.investor.id}/password`, {
      password: this.password,
      confirmPassword: this.confirmPassword,
    });
    this.saving = false;
    if (response.success) {
      this.password = '';
      this.confirmPassword = '';
    }
  }
}
