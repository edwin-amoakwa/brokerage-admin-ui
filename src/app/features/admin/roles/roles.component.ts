import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';

/** Roles and the pages each one opens (new; the JSF console had no roles). */
@Component({
  selector: 'app-roles',
  imports: [FormsModule, ButtonModule, CheckboxModule, DialogModule, InputTextModule, TableModule, TagModule, PageHeaderComponent],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss',
})
export class RolesComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);

  rows: any[] = [];
  loading = false;
  saving = false;
  record: any = null;
  dialogVisible = false;
  groups: { label: string; pages: any[] }[] = [];
  selected: Record<string, boolean> = {};

  async ngOnInit() {
    const pages = await this.api.get('roles/pages');
    if (pages.success) {
      const byGroup = new Map<string, any[]>();
      for (const p of pages.data) {
        byGroup.set(p.group, [...(byGroup.get(p.group) || []), p]);
      }
      this.groups = [...byGroup.entries()].map(([label, items]) => ({ label, pages: items }));
    }
    this.load();
  }

  async load() {
    this.loading = true;
    const response = await this.api.get('roles');
    this.loading = false;
    if (response.success) {
      this.rows = response.data;
    }
  }

  create() {
    this.record = { superUser: false, permissions: [] };
    this.selected = {};
    this.dialogVisible = true;
  }

  edit(row: any) {
    this.record = { ...row };
    this.selected = {};
    (row.permissions || []).forEach((k: string) => (this.selected[k] = true));
    this.dialogVisible = true;
  }

  allChecked(group: any) {
    return group.pages.every((p: any) => this.selected[p.key]);
  }

  toggleGroup(group: any) {
    const value = !this.allChecked(group);
    group.pages.forEach((p: any) => (this.selected[p.key] = value));
  }

  async save() {
    this.record.permissions = Object.keys(this.selected).filter((k) => this.selected[k]);
    this.saving = true;
    const response = await this.api.save('roles', this.record);
    this.saving = false;
    if (response.success) {
      this.dialogVisible = false;
      this.lookups.invalidate('roles');
      this.load();
      this.auth.reloadProfile();
    }
  }

  async remove(row: any) {
    if (await this.notify.confirmDelete(`the role ${row.roleName}`)) {
      const response = await this.api.delete(`roles/${row.id}`);
      if (response.success) {
        this.load();
      }
    }
  }
}
