import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ApiService } from '../../../core/api.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';

/** How often the page asks for the latest quotes while it is open and visible. */
const REFRESH_MS = 3000;
/** How long a changed price stays highlighted. */
const FLASH_MS = 1500;

interface QuoteRow {
  symbol: string;
  name: string | null;
  lastPrice: number | null;
  lastQuantity: number | null;
  change: number | null;
  changePercent: number | null;
  bidPrice: number | null;
  bidSize: number | null;
  askPrice: number | null;
  askSize: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  volume: number;
  phase: string | null;
  stale: boolean;
  time: string | null;
  /** 'up' or 'down' for a moment after the last price moves. */
  flash?: 'up' | 'down';
}

/**
 * Live Quotes: the latest quote for every symbol on the exchange feed (FAST,
 * through the FIX gateway), refreshed every few seconds. Prices that move
 * flash green or red; quotes the gateway marks out of date are greyed out.
 */
@Component({
  selector: 'app-live-quotes',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputTextModule, TableModule, TagModule, ToggleSwitchModule,
    PageHeaderComponent, StatTilesComponent],
  templateUrl: './live-quotes.component.html',
  styleUrl: './live-quotes.component.scss',
})
export class LiveQuotesComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);

  rows: QuoteRow[] = [];
  tiles: StatTile[] = [];
  status: any = {};
  search = '';
  autoRefresh = true;
  loading = false;
  loaded = false;
  failed = false;
  updatedAt: Date | null = null;

  private timer: any;
  private lastPrices = new Map<string, number | null>();
  private flashTimers = new Map<string, any>();
  private readonly onVisible = () => {
    if (document.visibilityState === 'visible' && this.autoRefresh) {
      this.refresh();
    }
  };

  ngOnInit() {
    this.refresh();
    this.timer = setInterval(() => {
      if (this.autoRefresh && document.visibilityState === 'visible') {
        this.refresh(true);
      }
    }, REFRESH_MS);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    this.flashTimers.forEach((t) => clearTimeout(t));
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  async refresh(background = false) {
    if (this.loading) {
      return;
    }
    this.loading = !background || !this.loaded;
    try {
      const r = await this.api.get('trading/quotes');
      if (r.success) {
        this.failed = false;
        this.status = r.data || {};
        this.apply(this.status.quotes || []);
        this.updatedAt = new Date();
        this.loaded = true;
        this.buildTiles();
      } else {
        this.failed = true;
      }
    } catch {
      this.failed = true;
    } finally {
      this.loading = false;
    }
  }

  get shown(): QuoteRow[] {
    const q = this.search.trim().toLowerCase();
    return q ? this.rows.filter((r) => r.symbol.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q)) : this.rows;
  }

  get feedLive(): boolean {
    return !!this.status.connected && !!this.status.marketDataUp;
  }

  /** Converts the API's price strings to numbers and flags the prices that moved. */
  private apply(quotes: any[]) {
    const next: QuoteRow[] = quotes.map((q) => ({
      symbol: q.symbol,
      name: q.name ?? null,
      lastPrice: num(q.lastPrice),
      lastQuantity: num(q.lastQuantity),
      change: num(q.change),
      changePercent: num(q.changePercent),
      bidPrice: num(q.bidPrice),
      bidSize: num(q.bidSize),
      askPrice: num(q.askPrice),
      askSize: num(q.askSize),
      open: num(q.open),
      high: num(q.high),
      low: num(q.low),
      prevClose: num(q.prevClose),
      volume: num(q.volume) ?? 0,
      phase: q.phase ?? null,
      stale: !!q.stale,
      time: q.time ?? null,
    }));

    for (const row of next) {
      const before = this.lastPrices.get(row.symbol);
      if (before != null && row.lastPrice != null && row.lastPrice !== before) {
        this.flash(row, row.lastPrice > before ? 'up' : 'down');
      } else {
        // Keep a flash that is still running across refreshes.
        const old = this.rows.find((r) => r.symbol === row.symbol);
        row.flash = old?.flash;
      }
      this.lastPrices.set(row.symbol, row.lastPrice);
    }
    this.rows = next;
  }

  private flash(row: QuoteRow, direction: 'up' | 'down') {
    row.flash = direction;
    clearTimeout(this.flashTimers.get(row.symbol));
    this.flashTimers.set(row.symbol, setTimeout(() => {
      const current = this.rows.find((r) => r.symbol === row.symbol);
      if (current) {
        current.flash = undefined;
      }
      this.flashTimers.delete(row.symbol);
    }, FLASH_MS));
  }

  private buildTiles() {
    const s = this.status;
    const traded = this.rows.filter((r) => r.volume > 0).length;
    const advancing = this.rows.filter((r) => (r.change ?? 0) > 0).length;
    const declining = this.rows.filter((r) => (r.change ?? 0) < 0).length;
    this.tiles = [
      { label: 'Market data', value: !s.connected ? 'Gateway offline' : s.marketDataUp ? 'Live' : 'Feed down', format: 'text',
        tone: this.feedLive ? 'ok' : 'bad', foot: s.lastMessageAt ? 'Last message ' + timeOf(s.lastMessageAt) : '' },
      { label: 'Market phase', value: phaseLabel(s.marketPhase), format: 'text', tone: phaseTone(s.marketPhase) },
      { label: 'Symbols', value: this.rows.length, format: 'number', foot: traded + ' traded today' },
      { label: 'Advancing / declining', value: advancing + ' / ' + declining, format: 'text',
        foot: (this.rows.length - advancing - declining) + ' unchanged' },
    ];
  }

  phaseLabel = phaseLabel;

  trackBySymbol(_: number, row: QuoteRow) {
    return row.symbol;
  }
}

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Trading (CONTINUOUS) is green, a halt red, pre-open and the opening auction amber, closed plain. */
function phaseTone(phase: string | null | undefined): 'ok' | 'warn' | 'bad' | '' {
  switch (phase) {
    case 'CONTINUOUS': return 'ok';
    case 'HALTED': return 'bad';
    case 'PRE_OPEN':
    case 'OPENING_AUCTION': return 'warn';
    default: return '';
  }
}

/** OPENING_AUCTION -> "Opening auction". */
function phaseLabel(phase: string | null | undefined): string {
  if (!phase) {
    return '-';
  }
  const text = phase.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
