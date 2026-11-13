import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Menu, MenuModule } from 'primeng/menu';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ApiService } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { NotifyService } from '../../../core/notify.service';
import { ReportData } from '../../../core/report-data';
import { SessionService } from '../../../core/session.service';
import { ReportViewerComponent } from '../../../shared/report-viewer/report-viewer.component';
import { InvestorUploadComponent } from '../investor-upload/investor-upload.component';
import { FLAG_LABELS, STAGE_LABELS, stageOf } from '../shared/investor-kyc';

/**
 * Investor register: status filters with counts, a filter bar (search, type,
 * needs-attention, registration date) and a table whose rows open the
 * investor's profile. Edit, stage actions and delete sit in each row's menu;
 * add and edit use the one-page investor form.
 */
@Component({
  selector: 'app-investors',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, DialogModule, InputTextModule, MenuModule, SelectModule, TableModule,
    ReportViewerComponent, InvestorUploadComponent],
  templateUrl: './investors.component.html',
  styleUrls: ['../shared/investor-ui.scss', './investors.component.scss'],
})
export class InvestorsComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotifyService);
  private session = inject(SessionService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  private lastEvent: any = { first: 0, rows: 10 };

  status = '';
  keyword = this.route.snapshot.queryParamMap.get('keyword') || '';
  investorType: string | null = null;
  flag: string | null = null;
  fromDate: string | null = null;
  summary: any = {};

  rowMenu: MenuItem[] = [];
  printing = false;
  reportData = new ReportData();
  showUpload = false;
  readonly canUpload = this.session.can('accounts.investor-upload');

  readonly types = [
    { id: 'INDIVIDUAL', itemName: 'Individual' },
    { id: 'CORPORATE', itemName: 'Corporate' },
  ];
  readonly flags = [
    { id: 'ID_ISSUE', itemName: 'ID expired or expiring' },
    { id: 'PEP', itemName: 'PEP flagged' },
    { id: 'NO_BANK', itemName: 'No bank details' },
    { id: 'NO_RISK_LEVEL', itemName: 'No risk level' },
    { id: 'LOGIN_DISABLED', itemName: 'Portal login disabled' },
  ];

  ngOnInit() {
    if (this.route.snapshot.queryParamMap.get('new') === '1') {
      this.router.navigate(['/accounts/investors/new'], { replaceUrl: true });
      return;
    }
    this.loadSummary();
  }

  get statusChips() {
    const s = this.summary || {};
    return [
      { key: '', label: 'All', count: s.total },
      { key: 'VERIFIED', label: 'Verified', count: s.verified },
      { key: 'AWAITING_ACCOUNT', label: 'Awaiting account', count: s.awaitingAccount },
      { key: 'PENDING', label: 'Awaiting verification', count: s.pending },
      { key: 'INCOMPLETE', label: 'Incomplete', count: s.incomplete },
    ];
  }

  get hasFilters(): boolean {
    return !!(this.keyword || this.investorType || this.flag || this.fromDate);
  }

  async loadSummary() {
    const response = await this.api.get('investors/summary');
    if (response.success) {
      this.summary = response.data;
    }
  }

  setStatus(key: string) {
    this.status = key;
    this.reload();
  }

  clearFilters() {
    this.keyword = '';
    this.investorType = null;
    this.flag = null;
    this.fromDate = null;
    this.reload();
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const response = await this.api.get('investors', {
      keyword: this.keyword,
      status: this.status,
      investorType: this.investorType,
      flag: this.flag,
      fromDate: this.fromDate,
      ...pageParams(event, 10),
    });
    this.loading = false;
    if (response.success) {
      this.rows = response.data || [];
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
  }

  stage(row: any) {
    return STAGE_LABELS[stageOf(row)];
  }

  flagChips(row: any) {
    return (row.flags || []).map((f: string) => FLAG_LABELS[f]).filter((f: any) => !!f);
  }

  idNote(row: any): { text: string; tone: string } {
    if (!row.validIdName && !row.idNumber) return { text: 'Not provided', tone: 'bad' };
    if (!row.idExpiryDate) return { text: row.idNumber || 'No expiry date', tone: '' };
    const flags: string[] = row.flags || [];
    const date = new Date(row.idExpiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (flags.includes('ID_EXPIRED')) return { text: `Expired ${date}`, tone: 'bad' };
    if (flags.includes('ID_EXPIRING')) return { text: `Expires ${date}`, tone: 'warn' };
    return { text: `Expires ${date}`, tone: '' };
  }

  accountNote(row: any): string {
    switch (stageOf(row)) {
      case 'AWAITING_ACCOUNT': return row.verifiedDate ? `Verified ${new Date(row.verifiedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Verified';
      case 'PENDING': return 'Waiting for verification';
      case 'INCOMPLETE': return 'Registration not finished';
      default: return row.principalAccountTypeName ? `${row.principalAccountTypeName} · principal` : '';
    }
  }

  open(row: any) {
    this.router.navigate(['/accounts/investors', row.id]);
  }

  create() {
    this.router.navigate(['/accounts/investors/new']);
  }

  openMenu(event: Event, menu: Menu, row: any) {
    event.stopPropagation();
    const items: MenuItem[] = [
      { label: 'View profile', icon: 'pi pi-user', command: () => this.open(row) },
      { label: 'Edit details', icon: 'pi pi-pencil', command: () => this.router.navigate(['/accounts/investors', row.id, 'edit']) },
    ];
    const stage = stageOf(row);
    if (stage === 'PENDING' && this.session.can('accounts.verifications')) {
      items.push({ label: 'Go to verification', icon: 'pi pi-verified', command: () => this.router.navigate(['/accounts/verifications'], { queryParams: { investorId: row.id } }) });
    }
    if (stage === 'AWAITING_ACCOUNT' && this.session.can('accounts.account-creation')) {
      items.push({ label: 'Create account', icon: 'pi pi-id-card', command: () => this.router.navigate(['/accounts/account-creation'], { queryParams: { investorId: row.id } }) });
    }
    if (row.principalAccountId && this.session.can('accounts.portfolio')) {
      items.push({ label: 'Open portfolio', icon: 'pi pi-briefcase', command: () => this.router.navigate(['/accounts/portfolio'], { queryParams: { accountId: row.principalAccountId } }) });
    }
    items.push({ separator: true }, { label: 'Delete investor…', icon: 'pi pi-trash', styleClass: 'danger-item', command: () => this.remove(row) });
    this.rowMenu = items;
    menu.toggle(event);
  }

  async remove(row: any) {
    const check = await this.api.get(`investors/${row.id}/linked-records`);
    if (!check.success) {
      return;
    }
    const blocking = check.data?.blocking || {};
    const blockingKeys = Object.keys(blocking);
    if (blockingKeys.length) {
      this.notify.error(`${row.displayName} still has ${blockingKeys.map((k) => blocking[k] + ' ' + k.toLowerCase()).join(', ')}. ` +
        'Investors with trading or client history cannot be deleted; disable their portal login instead.', 'Cannot delete');
      return;
    }
    const removable = check.data?.removable || {};
    const extra = Object.keys(removable).filter((k) => removable[k] > 0).map((k) => `${removable[k]} ${k.toLowerCase()}`);
    const what = `${row.displayName}${extra.length ? ' together with ' + extra.join(', ') : ''}`;
    if (await this.notify.confirmDelete(what)) {
      const response = await this.api.delete(`investors/${row.id}`);
      if (response.success) {
        this.load(this.lastEvent);
        this.loadSummary();
      }
    }
  }

  onImported() {
    this.load(this.lastEvent);
    this.loadSummary();
  }

  async print() {
    this.printing = true;
    const response = await this.api.get('investors/report', { keyword: this.keyword, status: this.status });
    this.printing = false;
    if (response.success) {
      this.reportData.showPdfReport('Investor Report', response.data);
    }
  }
}
