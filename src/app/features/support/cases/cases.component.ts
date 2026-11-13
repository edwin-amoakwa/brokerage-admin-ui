import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ApiService, isoDate, today } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { ReportData } from '../../../core/report-data';
import { EntityPickerComponent } from '../../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../../shared/report-viewer/report-viewer.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';
import { prioritySeverity, slaColor, statusSeverity } from '../support-ui';

function defaultFilters(): any {
  const from = new Date();
  from.setMonth(from.getMonth() - 3);
  return { fromDate: isoDate(from), toDate: today(), status: null, caseType: null, priority: null, teamId: null, breachedOnly: false, mineOnly: false, unassignedOnly: false, openOnly: false };
}

/** Filters survive a trip to the desk and back, as the session-scoped JSF bean did. */
let savedFilters: any = null;

/**
 * Client care register (JSF support/cases.xhtml, register and "Log a case"
 * views). Filtering, paging and the summary tiles are server side; the case
 * desk is its own route (/support/cases/:id).
 */
@Component({
  selector: 'app-cases',
  imports: [FormsModule, DatePipe, ButtonModule, CheckboxModule, DialogModule, InputTextModule, SelectModule, TableModule, TagModule, TextareaModule, EntityPickerComponent, PageHeaderComponent, ReportViewerComponent, StatTilesComponent],
  templateUrl: './cases.component.html',
  styleUrl: './cases.component.scss',
})
export class CasesComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  sev = { priority: prioritySeverity, status: statusSeverity, sla: slaColor };
  f: any = savedFilters ? { ...savedFilters } : defaultFilters();
  keyword = '';
  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  tiles: StatTile[] = [];
  reportData = new ReportData();
  printing = false;

  statuses: any[] = [];
  types: any[] = [];
  priorities: any[] = [];
  teams: any[] = [];
  channels: any[] = [];
  categories: any[] = [];

  createVisible = false;
  saving = false;
  draft: any = null;
  draftInvestor: any = null;
  clientAccounts: any[] = [];
  sla: any = null;

  private lastEvent: any = { first: 0, rows: 15 };

  async ngOnInit() {
    // Dashboard links: /support/cases?view=breached|unassigned
    const view = this.route.snapshot.queryParamMap.get('view');
    if (view === 'breached' || view === 'unassigned') {
      this.f = { ...defaultFilters(), fromDate: null, toDate: null, openOnly: true, breachedOnly: view === 'breached', unassignedOnly: view === 'unassigned' };
    }
    [this.statuses, this.types, this.priorities, this.teams, this.channels, this.categories] = await Promise.all([
      this.lookups.enum('CaseStatus'),
      this.lookups.enum('CaseType'),
      this.lookups.enum('CasePriority'),
      this.lookups.list('case-teams'),
      this.lookups.enum('CaseChannel'),
      this.lookups.list('case-categories'),
    ]);
  }

  private params() {
    savedFilters = { ...this.f };
    return { ...this.f, keyword: this.keyword };
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const params = this.params();
    const [list, stats] = await Promise.all([this.api.get('support-cases', { ...params, ...pageParams(event, 15) }), this.api.get('support-cases/stats', params)]);
    this.loading = false;
    if (list.success) {
      this.rows = list.data || [];
      this.total = list.pager?.totalRecords ?? this.rows.length;
    }
    if (stats.success) {
      const s = stats.data;
      this.tiles = [
        { label: 'Open', value: s.openCount, format: 'number', foot: `of ${s.totalCount} in view` },
        { label: 'Unassigned', value: s.unassignedCount, format: 'number', tone: s.unassignedCount ? 'warn' : '' },
        { label: 'Past target', value: s.breachedCount, format: 'number', tone: s.breachedCount ? 'bad' : 'ok' },
        { label: 'At risk', value: s.atRiskCount, format: 'number', foot: '75% of the window used', tone: s.atRiskCount ? 'warn' : '' },
        { label: 'Escalated', value: s.escalatedCount, format: 'number' },
        { label: 'Complaints', value: s.complaintCount, format: 'number', foot: 'any status' },
      ];
    }
  }

  reset() {
    this.f = defaultFilters();
    this.keyword = '';
    this.router.navigate([], { queryParams: {} });
    this.reload();
  }

  myQueue() {
    this.f = { ...defaultFilters(), mineOnly: true };
    this.keyword = '';
    this.reload();
  }

  async print() {
    this.printing = true;
    const response = await this.api.get('support-cases/report', this.params());
    this.printing = false;
    if (response.success) {
      this.reportData.showPdfReport('Complaints & Cases Register', response.data);
    }
  }

  open(row: any) {
    this.router.navigate(['/support/cases', row.id]);
  }

  // ---- Log a case -------------------------------------------------------

  newCase() {
    this.draft = { caseType: 'COMPLAINT', channel: 'PHONE', priority: 'MEDIUM', accountId: null, categoryId: null, teamId: null };
    this.draftInvestor = null;
    this.clientAccounts = [];
    this.sla = null;
    this.createVisible = true;
    this.preview();
  }

  async pickInvestor(investor: any) {
    this.draftInvestor = investor;
    this.draft.accountId = null;
    this.clientAccounts = [];
    if (!investor) {
      return;
    }
    const response = await this.api.get(`support-cases/client-accounts/${investor.id}`);
    if (response.success) {
      this.clientAccounts = response.data || [];
      if (this.clientAccounts.length === 1) {
        this.draft.accountId = this.clientAccounts[0].id;
      }
    }
  }

  /** A new category brings its default priority and team; changing priority alone does not reset it. */
  async categoryChanged() {
    const response = await this.api.get('support-cases/sla-preview', { categoryId: this.draft.categoryId });
    if (response.success) {
      this.draft.priority = response.data.priority;
      this.draft.teamId = response.data.teamId ?? null;
      this.sla = response.data;
    }
  }

  async preview() {
    const response = await this.api.get('support-cases/sla-preview', { categoryId: this.draft.categoryId, priority: this.draft.priority });
    if (response.success) {
      this.sla = response.data;
    }
  }

  async saveCase() {
    const d = this.draft;
    if (!this.draftInvestor) {
      this.notify.warn('Select the client this case belongs to.', 'Required');
      return;
    }
    if (!d.categoryId || !d.caseType || !d.channel || !d.subject?.trim() || !d.description?.trim()) {
      this.notify.warn('Type, category, channel, subject and description are required.', 'Required');
      return;
    }
    this.saving = true;
    const response = await this.api.post('support-cases', { ...d, investorId: this.draftInvestor.id });
    this.saving = false;
    if (response.success) {
      this.createVisible = false;
      this.router.navigate(['/support/cases', response.data.id]);
    }
  }
}
