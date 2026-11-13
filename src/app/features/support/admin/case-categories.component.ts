import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../../core/api.service';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';

/**
 * Case category tree with its SLA targets and routing
 * (JSF sysadmin/case-categories.xhtml). The whole tree is loaded at once
 * (it is small) so the parent dropdown can offer every other category.
 */
@Component({
  selector: 'app-case-categories',
  imports: [FormsModule, ButtonModule, CheckboxModule, DialogModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule, PageHeaderComponent],
  templateUrl: './case-categories.component.html',
  styleUrl: './case-categories.component.scss',
})
export class CaseCategoriesComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);

  all: any[] = [];
  keyword = '';
  loading = false;
  loaded = false;
  saving = false;
  dialogVisible = false;
  record: any = null;
  priorities: any[] = [];
  teams: any[] = [];

  get shown(): any[] {
    const k = this.keyword.trim().toLowerCase();
    if (!k) {
      return this.all;
    }
    return this.all.filter((c) => `${c.categoryCode} ${c.categoryName}`.toLowerCase().includes(k));
  }

  /** Every category except the one being edited. */
  get parentOptions(): any[] {
    return this.all.filter((c) => c.id !== this.record?.id);
  }

  async ngOnInit() {
    this.priorities = await this.lookups.enum('CasePriority');
    this.teams = await this.lookups.list('case-teams');
    this.load();
  }

  async load() {
    this.loading = true;
    const response = await this.api.get('case-categories', { paginated: false });
    this.loading = false;
    this.loaded = true;
    if (response.success) {
      this.all = response.data || [];
    }
  }

  async loadStandardSet() {
    const response = await this.api.post('case-categories/standard-set');
    if (response.success) {
      this.lookups.invalidate('case-categories');
      this.lookups.invalidate('case-teams');
      this.teams = await this.lookups.list('case-teams');
      this.load();
    }
  }

  private blank() {
    return { active: true, restricted: false, ackHours: 8, resolveHours: 40, defaultPriority: 'MEDIUM', parentId: null, teamId: null, escalationTeamId: null };
  }

  create() {
    this.record = this.blank();
    this.dialogVisible = true;
  }

  edit(row: any) {
    this.record = { ...row };
    this.dialogVisible = true;
  }

  clear() {
    this.record = { ...this.blank(), id: undefined };
  }

  async save() {
    const r = this.record;
    if (!r.categoryCode?.trim() || !r.categoryName?.trim() || !r.ackHours || !r.resolveHours) {
      this.notify.warn('Code, name and both targets are required.', 'Required');
      return;
    }
    if (r.id && r.parentId === r.id) {
      this.notify.warn('A category cannot be its own parent.');
      return;
    }
    this.saving = true;
    const response = await this.api.save('case-categories', r);
    this.saving = false;
    if (response.success) {
      this.dialogVisible = false;
      this.lookups.invalidate('case-categories');
      this.load();
    }
  }

  async remove(row: any) {
    if (await this.notify.confirmDelete(`the category ${row.categoryName}`)) {
      const response = await this.api.delete(`case-categories/${row.id}`);
      if (response.success) {
        this.lookups.invalidate('case-categories');
        this.load();
      }
    }
  }
}
