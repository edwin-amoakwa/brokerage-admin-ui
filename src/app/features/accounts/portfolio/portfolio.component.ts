import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiService, isoDate, today } from '../../../core/api.service';
import { LookupService } from '../../../core/lookup.service';
import { ReportData } from '../../../core/report-data';
import { EntityPickerComponent } from '../../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { ReportViewerComponent } from '../../../shared/report-viewer/report-viewer.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';
import { accountTypeSeverity } from '../shared/accounts-common';

/**
 * Account portfolio (JSF accounts/account-portfolio.xhtml): valuation tiles,
 * equity and fixed-income holdings, cash and pending settlement, investor and
 * bank details, filterable trade history, and the three PDFs. All figures
 * come from GET portfolios/{accountId}; nothing is calculated here.
 */
@Component({
  selector: 'app-portfolio',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputTextModule, SelectModule, TableModule, TagModule,
    PageHeaderComponent, EntityPickerComponent, StatTilesComponent, ReportViewerComponent],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss',
})
export class PortfolioComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private route = inject(ActivatedRoute);

  account: any = null;
  data: any = null;
  trades: any = null;
  loading = false;
  loadingTrades = false;
  tiles: StatTile[] = [];
  sides: any[] = [];
  stocks: any[] = [];
  buySell: string | null = null;
  stockId: string | null = null;
  fromDate: string | null = null;
  toDate: string | null = null;
  reportData = new ReportData();

  async ngOnInit() {
    // Deep link from the investor profile / register: ?accountId= opens that account.
    const accountId = this.route.snapshot.queryParamMap.get('accountId');
    if (accountId) {
      this.select({ id: accountId });
    }
    [this.sides, this.stocks] = await Promise.all([this.lookups.enum('BuySell'), this.lookups.list('stocks')]);
  }

  get acc() {
    return this.data?.account || {};
  }

  get s() {
    return this.data?.summary || {};
  }

  get footerSides() {
    return [
      { label: 'Buys', t: this.trades?.buys },
      { label: 'Sells', t: this.trades?.sells },
    ];
  }

  typeSeverity(type: string) {
    return accountTypeSeverity(type);
  }

  gainClass(style: string) {
    return style || '';
  }

  cashWidth() {
    return Math.max(0, this.s.cashPercent || 0);
  }

  async select(account: any) {
    if (!account) {
      return;
    }
    this.account = account;
    const now = new Date();
    this.fromDate = isoDate(new Date(now.getFullYear(), now.getMonth() - 3, 1));
    this.toDate = today();
    this.buySell = null;
    this.stockId = null;
    await this.refresh();
    this.loadTrades();
  }

  change() {
    this.account = null;
    this.data = null;
    this.trades = null;
  }

  async refresh() {
    this.loading = true;
    const response = await this.api.get(`portfolios/${this.account.id}`);
    this.loading = false;
    if (response.success) {
      this.data = response.data;
      const s = this.s;
      this.tiles = [
        { label: 'Portfolio Value', value: s.portfolioValue },
        { label: 'Equities', value: s.equityValue, foot: `${s.stockCount} stock(s) · ${(s.equityPercent ?? 0).toFixed(1)}%` },
        { label: 'Fixed Income', value: s.fixedIncomeValue, foot: `${s.fixedIncomeCount} holding(s) · ${(s.fixedIncomePercent ?? 0).toFixed(1)}%` },
        { label: 'Cash Balance', value: s.cashBalance, foot: `${(s.cashPercent ?? 0).toFixed(1)}% of portfolio`, tone: s.cashBalance < 0 ? 'bad' : '' },
        { label: 'Pending Settlement', value: s.pendingSettlement, tone: s.pendingSettlement > 0 ? 'warn' : '' },
      ];
    }
  }

  private tradeParams() {
    return { buySell: this.buySell, stockId: this.stockId, fromDate: this.fromDate, toDate: this.toDate };
  }

  async loadTrades() {
    this.loadingTrades = true;
    const response = await this.api.get(`portfolios/${this.account.id}/trades`, this.tradeParams());
    this.loadingTrades = false;
    if (response.success) {
      this.trades = response.data;
    }
  }

  async printStatement() {
    const response = await this.api.get(`portfolios/${this.account.id}/statement`);
    if (response.success) {
      this.reportData.showPdfReport('Portfolio Statement', response.data);
    }
  }

  async printTrades() {
    const response = await this.api.get(`portfolios/${this.account.id}/trades-report`, this.tradeParams());
    if (response.success) {
      this.reportData.showPdfReport('Account Trades Report', response.data);
    }
  }

  async printCash() {
    const response = await this.api.get(`portfolios/${this.account.id}/cash-report`);
    if (response.success) {
      this.reportData.showPdfReport('Cash Transactions Statement', response.data);
    }
  }
}
