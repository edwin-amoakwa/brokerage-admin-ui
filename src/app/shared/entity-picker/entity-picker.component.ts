import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ApiService } from '../../core/api.service';
import { pageParams } from '../../core/api-response';

type PickerKind = 'account' | 'investor' | 'fixed-income';

const CONFIG: Record<PickerKind, { path: string; title: string; placeholder: string; columns: { field: string; header: string; date?: boolean }[] }> = {
  account: {
    path: 'pickers/accounts',
    title: 'Find account',
    placeholder: 'Account code, name or depository code',
    columns: [
      { field: 'accountCode', header: 'Account Code' },
      { field: 'accountName', header: 'Account Name' },
      { field: 'accountTypeName', header: 'Type' },
      { field: 'principalInvestorName', header: 'Principal Investor' },
    ],
  },
  investor: {
    path: 'pickers/investors',
    title: 'Find investor',
    placeholder: 'Name, code, email or phone',
    columns: [
      { field: 'investorCode', header: 'Code' },
      { field: 'displayName', header: 'Investor Name' },
      { field: 'emailAddress', header: 'Email' },
      { field: 'status', header: 'Status' },
    ],
  },
  'fixed-income': {
    path: 'pickers/fixed-income-securities',
    title: 'Find fixed income security',
    placeholder: 'Security code or ISIN',
    columns: [
      { field: 'securityCode', header: 'Security Code' },
      { field: 'issuerName', header: 'Issuer' },
      { field: 'issueDate', header: 'Issue Date', date: true },
      { field: 'maturityDate', header: 'Maturity Date', date: true },
    ],
  },
};

/**
 * Search-and-pick for accounts, investors and fixed-income securities,
 * replacing <brokerage:accountSearch>, <brokerage:investorSearch> and
 * <brokerage:fixedIncomeSearch>. The selection belongs to the host page only.
 *
 *   <app-entity-picker kind="account" [value]="account" (selected)="onAccount($event)" />
 */
@Component({
  selector: 'app-entity-picker',
  imports: [FormsModule, ButtonModule, DialogModule, InputTextModule, TableModule, DatePipe],
  templateUrl: './entity-picker.component.html',
  styleUrl: './entity-picker.component.scss',
})
export class EntityPickerComponent {
  private api = inject(ApiService);

  @Input() kind: PickerKind = 'account';
  @Input() value: any = null;
  @Input() placeholder = '';
  @Input() buttonLabel = '';
  @Input() disabled = false;
  @Input() clearable = true;
  @Output() selected = new EventEmitter<any>();

  visible = false;
  keyword = '';
  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  private lastEvent: any = { first: 0, rows: 10 };

  get config() {
    return CONFIG[this.kind];
  }

  get placeholderText() {
    return this.placeholder || `Select ${this.kind === 'fixed-income' ? 'a security' : 'an ' + this.kind}`;
  }

  open() {
    this.visible = true;
  }

  search() {
    this.first = 0;
    this.load({ first: 0, rows: this.lastEvent.rows || 10 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const response = await this.api.get(this.config.path, { keyword: this.keyword, ...pageParams(event, 10) });
    this.loading = false;
    if (response.success) {
      this.rows = response.data || [];
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
  }

  pick(row: any) {
    this.value = row;
    this.visible = false;
    this.selected.emit(row);
  }

  clear() {
    this.value = null;
    this.selected.emit(null);
  }
}
