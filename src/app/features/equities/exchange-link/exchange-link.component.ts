import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { PasswordModule } from 'primeng/password';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ApiService } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { SessionService } from '../../../core/session.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';
import { sideSeverity } from '../equities-shared';

/**
 * The exchange link (FIX gateway): connection status, the routing and STP switches with the other
 * exchange-link settings, and, while STP is off, the orders waiting for the dealing desk to release
 * them to the exchange or keep them for manual dealing.
 */
@Component({
  selector: 'app-exchange-link',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputNumberModule, PasswordModule, TableModule, TagModule,
    ToggleSwitchModule, PageHeaderComponent, StatTilesComponent],
  templateUrl: './exchange-link.component.html',
  styleUrl: './exchange-link.component.scss',
})
export class ExchangeLinkComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private notify = inject(NotifyService);
  private session = inject(SessionService);

  status: any = {};
  tiles: StatTile[] = [];
  settings: any[] = [];
  history: any[] = [];
  canEdit = false;
  canRelease = this.session.can('equities.exchange-link');
  form: any = {};
  held: any[] = [];
  saving = false;
  busyId: string | null = null;
  private timer: any;

  side = sideSeverity;

  ngOnInit() {
    this.loadAll();
    this.timer = setInterval(() => this.refresh(), 10000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  async loadAll() {
    await Promise.all([this.refresh(), this.loadSettings()]);
  }

  /** Status and held orders; refreshed every 10 seconds. */
  async refresh() {
    const [status, held] = await Promise.all([this.api.get('exchange-link/status'), this.api.get('exchange-link/held-orders')]);
    if (status.success) {
      this.status = status.data;
      const s = this.status;
      this.tiles = [
        { label: 'Gateway', value: s.connected ? 'Connected' : 'Not connected', format: 'text', tone: s.connected ? 'ok' : 'bad',
          foot: s.gatewayId || '' },
        { label: 'Exchange FIX session', value: s.fixSessionUp ? 'Up' : 'Down', format: 'text', tone: s.fixSessionUp ? 'ok' : 'warn' },
        { label: 'Market data', value: s.marketDataUp ? 'Up' : 'Down', format: 'text', tone: s.marketDataUp ? 'ok' : 'warn',
          foot: s.marketPhase || '' },
        { label: 'Order flow', value: this.flowLabel(), format: 'text', tone: s.routingEnabled ? (s.stpEnabled ? 'ok' : 'warn') : '' },
        { label: 'Waiting for release', value: s.heldCount ?? 0, format: 'number', tone: s.heldCount ? 'warn' : '' },
      ];
    }
    if (held.success) {
      this.held = held.data || [];
    }
  }

  flowLabel(): string {
    if (!this.status.routingEnabled) {
      return 'Manual dealing';
    }
    return this.status.stpEnabled ? 'Straight through (STP)' : 'Held for the desk';
  }

  async loadSettings() {
    const response = await this.api.get('exchange-link/settings');
    if (response.success) {
      this.settings = response.data.settings || [];
      this.history = response.data.history || [];
      this.canEdit = !!response.data.canEdit;
      this.form = {};
      for (const s of this.settings) {
        this.form[s.name] = s.kind === 'SECRET' ? '' : s.kind === 'NUMBER' ? Number(s.value) : s.value;
      }
    }
  }

  setting(name: string): any {
    return this.settings.find((s) => s.name === name) || {};
  }

  async save() {
    const routing = this.form['ORBIT_FIX_ROUTING'];
    const stp = this.form['ORBIT_FIX_STP'];
    const was = { routing: this.setting('ORBIT_FIX_ROUTING').value, stp: this.setting('ORBIT_FIX_STP').value };
    if (routing && !was.routing) {
      const ok = await this.notify.confirm(stp
        ? 'Turn the exchange link on? New orders will go straight to the exchange as soon as they are saved.'
        : 'Turn the exchange link on? New orders will wait on this page for the dealing desk to release them.', 'Exchange link');
      if (!ok) {
        return;
      }
    } else if (routing && stp && !was.stp) {
      const ok = await this.notify.confirm('Turn straight-through processing on? New orders will go to the exchange as soon as they are '
        + 'saved. Orders already waiting here still need to be released or kept.', 'Straight-through processing');
      if (!ok) {
        return;
      }
    }
    this.saving = true;
    const response = await this.api.put('exchange-link/settings', this.form);
    this.saving = false;
    if (response.success) {
      this.notify.success(response.message || 'Saved');
      await this.loadAll();
    }
  }

  async release(row: any) {
    const ok = await this.notify.confirm(`Send order ${row.orderNo ?? ''} (${row.buySellName} ${row.orderQuantity} ${row.stockSymbol}) `
      + 'to the exchange now?', 'Release to the exchange', 'Send');
    if (!ok) {
      return;
    }
    await this.act(row, 'release');
  }

  async keep(row: any) {
    const ok = await this.notify.confirm(`Keep order ${row.orderNo ?? ''} with the dealing desk? It will not be sent to the exchange.`,
      'Keep with the dealing desk', 'Keep');
    if (!ok) {
      return;
    }
    await this.act(row, 'keep');
  }

  private async act(row: any, action: 'release' | 'keep') {
    this.busyId = row.id;
    const response = await this.api.post(`exchange-link/held-orders/${row.id}/${action}`);
    this.busyId = null;
    if (response.success) {
      this.notify.success(response.message || 'Done');
    }
    await this.refresh();
  }
}
