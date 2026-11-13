import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';

/**
 * Back-office user accounts (JSF sysadmin/user-accounts.xhtml), plus the role
 * each user holds. REFERENCE PATTERN for a custom list + dialog screen.
 */
@Component({
  selector: 'app-users',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, PasswordModule, SelectModule, TableModule, TagModule, PageHeaderComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);

  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  saving = false;
  keyword = '';
  record: any = null;
  dialogVisible = false;
  statuses: any[] = [];
  roles: any[] = [];
  passwordVisible = false;
  passwordUser: any = null;
  newPassword = '';
  private lastEvent: any = { first: 0, rows: 20 };

  async ngOnInit() {
    this.statuses = await this.lookups.enum('ActiveInactiveStatus');
    this.roles = await this.lookups.list('roles');
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const response = await this.api.get('users', { keyword: this.keyword, ...pageParams(event) });
    this.loading = false;
    if (response.success) {
      this.rows = response.data;
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
  }

  create() {
    this.record = { accountStatus: 'ACTIVE' };
    this.dialogVisible = true;
  }

  edit(row: any) {
    this.record = { ...row };
    this.dialogVisible = true;
  }

  async save() {
    this.saving = true;
    const response = await this.api.save('users', this.record);
    this.saving = false;
    if (response.success) {
      this.dialogVisible = false;
      this.lookups.invalidate('users');
      this.load(this.lastEvent);
    }
  }

  openPassword(row: any) {
    this.passwordUser = row;
    this.newPassword = '';
    this.passwordVisible = true;
  }

  async savePassword() {
    const response = await this.api.put(`users/${this.passwordUser.id}/password`, { password: this.newPassword });
    if (response.success) {
      this.passwordVisible = false;
    }
  }

  async remove(row: any) {
    if (await this.notify.confirmDelete(`the user ${row.accountName}`)) {
      const response = await this.api.delete(`users/${row.id}`);
      if (response.success) {
        this.load(this.lastEvent);
      }
    }
  }
}
