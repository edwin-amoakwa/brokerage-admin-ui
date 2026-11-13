import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, today } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { EntityPickerComponent } from '../../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';
import { accountTypeSeverity } from '../shared/accounts-common';

/**
 * Trading accounts (JSF accounts/account.xhtml): list with type tiles,
 * create/edit with the principal investor picked by search, co-holders for
 * joint / in-trust-for accounts, and linked-record counts guarding delete.
 */
@Component({
  selector: 'app-accounts',
  imports: [FormsModule, DatePipe, ButtonModule, InputTextModule, SelectModule, TableModule, TagModule,
    PageHeaderComponent, StatTilesComponent, EntityPickerComponent],
  templateUrl: './accounts.component.html',
  styleUrl: './accounts.component.scss',
})
export class AccountsComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);
  private route = inject(ActivatedRoute);

  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  keyword = '';
  accountType = '';
  summary: any = {};
  tiles: StatTile[] = [];
  referenceTiles: StatTile[] = [];
  exchanges: any[] = [];
  accountTypes: any[] = [];
  classifications: any[] = [];

  record: any = null;
  private original: any = null;
  principal: any = null;
  newHolder: any = null;
  saving = false;
  private lastEvent: any = { first: 0, rows: 10 };

  async ngOnInit() {
    // Deep links from the Accounts Dashboard: ?keyword= searches, ?new=1 opens a blank form.
    const query = this.route.snapshot.queryParamMap;
    this.keyword = query.get('keyword') || '';
    this.loadSummary();
    [this.exchanges, this.accountTypes, this.classifications] = await Promise.all([
      this.lookups.list('stock-exchanges'),
      this.lookups.enum('AccountType'),
      this.lookups.enum('AccountClassification'),
    ]);
    if (query.get('new') === '1') {
      this.create();
    }
  }

  typeSeverity(type: string) {
    return accountTypeSeverity(type);
  }

  typeName(type: string) {
    return this.accountTypes.find((t) => t.id === type)?.itemName || type;
  }

  initials(p: any) {
    return (p?.displayName || '?').split(/[ ,]+/).filter((s: string) => s).slice(0, 2).map((s: string) => s[0]).join('').toUpperCase();
  }

  isMulti() {
    return this.record?.accountType === 'JOINT' || this.record?.accountType === 'ITF';
  }

  async loadSummary() {
    const response = await this.api.get('accounts/summary');
    if (response.success) {
      this.summary = response.data;
    }
    this.buildTiles();
  }

  private buildTiles() {
    const s = this.summary || {};
    this.tiles = [
      { label: 'Total Accounts', value: s.total, format: 'number', key: '', active: this.accountType === '' },
      { label: 'Individual', value: s.individual, format: 'number', key: 'INDIVIDUAL', active: this.accountType === 'INDIVIDUAL' },
      { label: 'Corporate', value: s.corporate, format: 'number', key: 'CORPORATE', active: this.accountType === 'CORPORATE' },
      { label: 'Joint & ITF', value: s.jointItf, format: 'number', key: 'JOINT_ITF', active: this.accountType === 'JOINT_ITF' },
    ];
  }

  filter(tile: StatTile) {
    this.accountType = tile.key;
    this.buildTiles();
    this.reload();
  }

  refresh() {
    this.loadSummary();
    this.reload();
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const response = await this.api.get('accounts', { keyword: this.keyword, accountType: this.accountType, ...pageParams(event, 10) });
    this.loading = false;
    if (response.success) {
      this.rows = response.data || [];
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
  }

  create() {
    this.original = { valueDate: today(), stockExchangeId: this.exchanges.length === 1 ? this.exchanges[0].id : null };
    this.setRecord({ ...this.original });
  }

  async edit(row: any) {
    const response = await this.api.get(`accounts/${row.id}`);
    if (response.success) {
      this.original = response.data;
      this.setRecord({ ...response.data });
    }
  }

  private setRecord(record: any) {
    this.record = record;
    this.newHolder = null;
    this.principal = record.principalInvestorId
      ? { id: record.principalInvestorId, displayName: record.principalInvestorName, emailAddress: record.principalInvestorEmail }
      : null;
    const refs = record.references || {};
    this.referenceTiles = Object.keys(refs).map((k) => ({ label: k, value: refs[k], format: 'number' as const, tone: refs[k] > 0 && k !== 'Co-holders' ? 'warn' as const : '' as const }));
  }

  close() {
    this.record = null;
  }

  clear() {
    this.setRecord({ ...this.original });
  }

  /** Names the account after the investor when the name is blank or still the previous investor's name. */
  selectPrincipal(investor: any) {
    const previous = this.principal?.displayName;
    this.principal = investor;
    this.record.principalInvestorId = investor?.id || null;
    if (!this.record.accountName || this.record.accountName === previous) {
      this.record.accountName = investor?.displayName || '';
    }
  }

  async save() {
    const r = this.record;
    if (!r.principalInvestorId) {
      this.notify.warn('Search for and select the principal investor first');
      return;
    }
    if (!r.accountName?.trim() || !r.depositoryCode?.trim() || !r.stockExchangeId || !r.accountType || !r.classification) {
      this.notify.warn('Fill in every required field');
      return;
    }
    this.saving = true;
    const response = await this.api.save('accounts', r);
    this.saving = false;
    if (response.success) {
      this.original = response.data;
      this.setRecord({ ...response.data });
      this.loadSummary();
    }
  }

  async remove(row: any) {
    if (await this.notify.confirmDelete(`account ${row.accountCode} - ${row.accountName}`)) {
      const response = await this.api.delete(`accounts/${row.id}`);
      if (response.success) {
        this.record = null;
        this.loadSummary();
        this.load(this.lastEvent);
      }
    }
  }

  async addHolder() {
    const response = await this.api.post(`accounts/${this.record.id}/holders`, { investorId: this.newHolder?.id });
    if (response.success) {
      this.original = response.data;
      this.setRecord({ ...response.data });
    }
  }

  async removeHolder(holder: any) {
    if (await this.notify.confirm(`Remove ${holder.investorName} from this account?`, 'Remove co-holder', 'Remove')) {
      const response = await this.api.delete(`accounts/${this.record.id}/holders/${holder.id}`);
      if (response.success) {
        this.original = response.data;
        this.setRecord({ ...response.data });
      }
    }
  }
}
