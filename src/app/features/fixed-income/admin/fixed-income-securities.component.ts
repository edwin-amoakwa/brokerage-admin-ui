import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, today } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';
import { FixedIncomeOptionsService, addDays } from '../fixed-income-options.service';

/**
 * Fixed-income securities register and the two-step wizard that generates the
 * coupon / principal schedule (JSF sysadmin/fixed-income.xhtml). Saving an
 * edited security replaces its schedule (the JSF page appended a second copy);
 * delete removes schedule and security together.
 */
@Component({
  selector: 'app-fixed-income-securities',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, CheckboxModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule,
    PageHeaderComponent, StatTilesComponent],
  templateUrl: './fixed-income-securities.component.html',
  styleUrl: './fixed-income-securities.component.scss',
})
export class FixedIncomeSecuritiesComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private options = inject(FixedIncomeOptionsService);
  private notify = inject(NotifyService);

  step = 0;
  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  busy = false;
  fromDate: string | null = null;
  toDate: string | null = null;
  filterSubClass: string | null = null;
  filterRatePolicy: string | null = null;
  keyword = '';
  tiles: StatTile[] = [];
  record: any = null;
  preview: any = null;
  subClasses: any[] = [];
  tenors: any[] = [];
  currencies: any[] = [];
  ratePolicies: any[] = [];
  dayCounts: any[] = [];
  issuers: any[] = [];
  private lastEvent: any = { first: 0, rows: 20 };

  async ngOnInit() {
    const [options, ratePolicies, dayCounts] = await Promise.all([
      this.options.load(), this.lookups.enum('RatePolicy'), this.lookups.enum('FixedIncomeDayCount'),
    ]);
    this.subClasses = options.subClasses;
    this.tenors = options.tenors;
    this.currencies = options.currencies;
    this.ratePolicies = ratePolicies;
    this.dayCounts = dayCounts;
  }

  private filters() {
    return { fromDate: this.fromDate, toDate: this.toDate, assetSubClass: this.filterSubClass, ratePolicy: this.filterRatePolicy, keyword: this.keyword };
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const [response, summary] = await Promise.all([
      this.api.get('fixed-income-securities', { ...this.filters(), ...pageParams(event) }),
      this.api.get('fixed-income-securities/summary', this.filters()),
    ]);
    this.loading = false;
    if (response.success) {
      this.rows = response.data;
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
    if (summary.success) {
      const s = summary.data;
      this.tiles = [
        { label: 'On the register', value: s.totalCount, format: 'number' },
        { label: 'Active', value: s.activeCount, format: 'number', tone: 'ok' },
        { label: 'Maturing in 90 days', value: s.maturingCount, format: 'number', tone: 'warn' },
        { label: 'Matured', value: s.maturedCount, format: 'number' },
      ];
    }
  }

  statusSeverity(status: string): 'success' | 'warn' | 'secondary' {
    return status === 'Active' ? 'success' : status === 'Maturing' ? 'warn' : 'secondary';
  }

  private async loadIssuers() {
    this.lookups.invalidate('security-issuers');
    this.issuers = await this.lookups.list('security-issuers');
  }

  /** initiateSecurityCreation */
  async create() {
    await this.loadIssuers();
    this.record = { issueDate: today(), interestPaymentInterval: 182, ratePolicy: 'FIXED_RATE', dayCount: 'ACT_365', currency: 'GHS', leapYearAdjustment: false };
    this.preview = null;
    this.step = 1;
  }

  /** editFixedIncome */
  async edit(row: any) {
    await this.loadIssuers();
    this.record = { ...row };
    this.preview = null;
    this.step = 1;
  }

  /** suggestMaturityDate: issue date + tenor days. */
  suggestMaturityDate() {
    const tenor = this.tenors.find((t) => t.id === this.record?.tenor);
    if (tenor && this.record.issueDate) {
      this.record.maturityDate = addDays(this.record.issueDate, tenor.days);
    }
  }

  /** FixedIncomeService.generateSecurityCode: <subclass code>-<tenor code>-<ddMMyy>; an existing code is kept. */
  get codePreview(): string {
    if (this.record?.id && this.record.securityCode) {
      return this.record.securityCode;
    }
    const sub = this.subClasses.find((s) => s.id === this.record?.assetSubClass);
    const tenor = this.tenors.find((t) => t.id === this.record?.tenor);
    const issue: string | undefined = this.record?.issueDate;
    if (!sub || !tenor || !issue) {
      return 'Set subclass, tenor and issue date';
    }
    const [y, m, d] = issue.split('-');
    return `${sub.code}-${tenor.code}-${d}${m}${y.substring(2)}`;
  }

  get tenorDays(): number {
    return this.tenors.find((t) => t.id === this.record?.tenor)?.days ?? 0;
  }

  get derivedPaymentCount(): number {
    const interval = this.record?.interestPaymentInterval;
    if (!this.tenorDays || !interval || interval <= 0) {
      return 0;
    }
    if (this.record.ratePolicy === 'FLOATING_RATE' && this.record.noOfInterestPayment) {
      return this.record.noOfInterestPayment;
    }
    return Math.floor(this.tenorDays / interval);
  }

  get couponPerPayment(): number {
    const interval = this.record?.interestPaymentInterval;
    if (this.record?.coupon == null || !interval || interval <= 0) {
      return 0;
    }
    return this.record.coupon / (365 / interval);
  }

  async generateSchedule() {
    this.busy = true;
    const response = await this.api.post('fixed-income-securities/schedule', this.record);
    this.busy = false;
    if (response.success) {
      this.preview = response.data;
      this.record.maturityDate = this.preview.maturityDate;
      this.step = 2;
    }
  }

  async save() {
    this.busy = true;
    const response = await this.api.save('fixed-income-securities', this.record);
    this.busy = false;
    if (response.success) {
      this.lookups.invalidate('fixed-income-securities');
      this.close();
    }
  }

  close() {
    this.step = 0;
    this.record = null;
    this.preview = null;
  }

  async remove(row: any) {
    if (await this.notify.confirmDelete(`${row.securityCode} and its whole coupon schedule`)) {
      const response = await this.api.delete(`fixed-income-securities/${row.id}`);
      if (response.success) {
        this.lookups.invalidate('fixed-income-securities');
        this.load(this.lastEvent);
      }
    }
  }
}
