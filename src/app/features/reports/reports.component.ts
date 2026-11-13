import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ApiService, today } from '../../core/api.service';
import { LookupService } from '../../core/lookup.service';
import { NotifyService } from '../../core/notify.service';
import { ReportData } from '../../core/report-data';
import { SessionService } from '../../core/session.service';
import { EntityPickerComponent } from '../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../shared/report-viewer/report-viewer.component';
import { StatTile, StatTilesComponent } from '../../shared/stat-tiles/stat-tiles.component';

type ReportKey = 'running' | 'statement' | 'cash' | 'fixedIncome';

/**
 * Reports launcher (JSF report/reports.xhtml). Each report has its own filters
 * (the JSF page printed whatever the FI history page last searched).
 * "Running Investment" lists authorised, unmatured fixed-income positions as
 * at a date with computed days run and accrued interest; the other entries
 * print the cash and statement PDFs and link to their screens.
 */
@Component({
  selector: 'app-reports',
  imports: [
    FormsModule, DatePipe, DecimalPipe, RouterLink, ButtonModule, InputTextModule, SelectModule, TableModule,
    EntityPickerComponent, PageHeaderComponent, ReportViewerComponent, StatTilesComponent,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);
  session = inject(SessionService);

  catalog: { key: ReportKey; title: string; description: string; path: string; route?: string; permission?: string; screen?: string }[] = [
    { key: 'running', title: 'Running Investment', description: 'Unmatured fixed-income positions as at a date', path: 'reports/running-investments/pdf' },
    { key: 'statement', title: 'Account Statement', description: 'Ledger with running balance', path: 'reports/account-statement', route: '/history/account-transactions', permission: 'history.account-transactions', screen: 'Account Transactions' },
    { key: 'cash', title: 'Cash Transaction Report', description: 'Cash movements for an account', path: 'reports/cash-transactions', route: '/cash/transactions', permission: 'cash.transactions', screen: 'Cash Transactions' },
    { key: 'fixedIncome', title: 'Fixed Income Transaction Report', description: 'Fixed-income trades by value date', path: 'reports/fixed-income-transactions', route: '/history/fixed-income-transactions', permission: 'history.fixed-income-transactions', screen: 'Fixed Income Transaction History' },
  ];

  selected: ReportKey = 'running';
  asAtDate = today();
  runningAccount: any = null;
  running: any = null;
  account: any = null;
  portfolio: string | null = null;
  fromDate: string | null = null;
  toDate: string | null = null;
  portfolios: any[] = [];
  loading = false;
  printing = false;
  reportData = new ReportData();

  async ngOnInit() {
    this.portfolios = await this.lookups.enum('Portfolio');
  }

  get current() {
    return this.catalog.find((c) => c.key === this.selected)!;
  }

  get runningTiles(): StatTile[] {
    const r = this.running || {};
    return [
      { label: 'Positions', value: r.count, format: 'number' },
      { label: 'Face value', value: r.totalFaceValue },
      { label: 'Cost', value: r.totalCost },
      { label: 'Accrued interest', value: r.totalAccruedInterest },
      { label: 'Market value', value: r.totalMarketValue },
    ];
  }

  private runningParams() {
    return { asAtDate: this.asAtDate, accountId: this.runningAccount?.id };
  }

  async previewRunning() {
    if (!this.asAtDate) {
      this.notify.warn('Enter the as-at date');
      return;
    }
    this.loading = true;
    const response = await this.api.get('reports/running-investments', this.runningParams());
    this.loading = false;
    if (response.success) {
      this.running = response.data;
    }
  }

  async printRunning() {
    if (!this.asAtDate) {
      this.notify.warn('Enter the as-at date');
      return;
    }
    await this.run('Running Investment', 'reports/running-investments/pdf', this.runningParams());
  }

  async print(key: ReportKey) {
    const entry = this.catalog.find((c) => c.key === key)!;
    if ((key === 'statement' || key === 'cash') && !this.account) {
      this.notify.warn('Choose an account');
      return;
    }
    if (key === 'fixedIncome' && !this.account && !this.fromDate && !this.toDate) {
      this.notify.warn('Choose an account or a date range');
      return;
    }
    await this.run(entry.title, entry.path, {
      accountId: this.account?.id,
      portfolio: key === 'cash' ? this.portfolio : null,
      fromDate: this.fromDate,
      toDate: this.toDate,
    });
  }

  private async run(title: string, path: string, params: any) {
    this.printing = true;
    const response = await this.api.get(path, params);
    this.printing = false;
    if (response.success) {
      this.reportData.showPdfReport(title, response.data);
    }
  }
}
