import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ApiService } from '../../core/api.service';
import { pageParams } from '../../core/api-response';
import { LookupService } from '../../core/lookup.service';
import { NotifyService } from '../../core/notify.service';
import { SessionService } from '../../core/session.service';
import { PageHeaderComponent } from '../page-header/page-header.component';

export interface CrudColumn {
  field: string;
  header: string;
  type?: 'text' | 'money' | 'number' | 'date' | 'boolean';
}

export interface CrudField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'decimal' | 'checkbox' | 'select' | 'date' | 'textarea';
  required?: boolean;
  /** Dropdown source: an enum in entities.constants, a lookup list, or fixed values. */
  enum?: string;
  list?: string;
  values?: { id: any; itemName: string }[];
  /** Read-only once the record exists (e.g. a code). */
  lockOnEdit?: boolean;
  /** Bootstrap grid width out of 12. Default 6. */
  col?: number;
  hint?: string;
}

export interface CrudConfig {
  title: string;
  subtitle?: string;
  /** API path under v1/admin, e.g. 'banks'. */
  resource: string;
  /** Singular noun for buttons and messages, e.g. 'bank'. */
  noun: string;
  columns: CrudColumn[];
  fields: CrudField[];
  /** Server paging and keyword search (default true). */
  paginated?: boolean;
  defaults?: () => any;
  /** Lookup lists to drop from the cache after a save or delete. */
  invalidates?: string[];
  canDelete?: boolean;
}

/**
 * A list plus a create/edit dialog driven by a CrudConfig, for the simple
 * reference-data screens (astra-app's generic-lookup approach). Expects the
 * standard admin endpoints: GET (paged, ?keyword), POST, PUT, DELETE /{id}.
 */
@Component({
  selector: 'app-crud-page',
  imports: [FormsModule, ButtonModule, CheckboxModule, DialogModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule, TextareaModule, DatePipe, DecimalPipe, PageHeaderComponent],
  templateUrl: './crud-page.component.html',
  styleUrl: './crud-page.component.scss',
})
export class CrudPageComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);
  session = inject(SessionService);

  @Input({ required: true }) config!: CrudConfig;

  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  saving = false;
  keyword = '';
  record: any = null;
  dialogVisible = false;
  options: Record<string, any[]> = {};
  private lastEvent: any = { first: 0, rows: 20 };

  get paginated() {
    return this.config.paginated !== false;
  }

  async ngOnInit() {
    for (const f of this.config.fields) {
      if (f.type !== 'select') {
        continue;
      }
      if (f.values) {
        this.options[f.key] = f.values;
      } else if (f.enum) {
        this.options[f.key] = await this.lookups.enum(f.enum);
      } else if (f.list) {
        this.options[f.key] = await this.lookups.list(f.list);
      }
    }
    if (!this.paginated) {
      this.load({ first: 0, rows: 20 });
    }
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const params: any = { keyword: this.keyword };
    if (this.paginated) {
      Object.assign(params, pageParams(event));
    } else {
      params.paginated = false;
    }
    const response = await this.api.get(this.config.resource, params);
    this.loading = false;
    if (response.success) {
      this.rows = response.data || [];
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
  }

  create() {
    this.record = { ...(this.config.defaults ? this.config.defaults() : {}) };
    this.dialogVisible = true;
  }

  edit(row: any) {
    this.record = { ...row };
    this.dialogVisible = true;
  }

  locked(f: CrudField) {
    return !!(f.lockOnEdit && this.record?.id);
  }

  async save() {
    const missing = this.config.fields.filter((f) => f.required && (this.record[f.key] === null || this.record[f.key] === undefined || this.record[f.key] === ''));
    if (missing.length) {
      this.notify.warn(`Enter ${missing.map((f) => f.label).join(', ')}`, 'Required');
      return;
    }
    this.saving = true;
    const response = await this.api.save(this.config.resource, this.record);
    this.saving = false;
    if (response.success) {
      this.dialogVisible = false;
      (this.config.invalidates || []).forEach((n) => this.lookups.invalidate(n));
      this.load(this.lastEvent);
    }
  }

  async remove(row: any) {
    if (!(await this.notify.confirmDelete(`this ${this.config.noun}`))) {
      return;
    }
    const response = await this.api.delete(`${this.config.resource}/${row.id}`);
    if (response.success) {
      (this.config.invalidates || []).forEach((n) => this.lookups.invalidate(n));
      this.load(this.lastEvent);
    }
  }
}
