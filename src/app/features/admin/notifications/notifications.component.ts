import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { StatTile, StatTilesComponent } from '../../../shared/stat-tiles/stat-tiles.component';

type WordingField = 'title' | 'body' | 'sms' | 'whatsapp';

/**
 * Notifications admin, modelled on astra-app's config/notifications: the type
 * catalogue with per-channel switches, a wording editor with token chips and a
 * live preview, test sends, and the delivery log with retry.
 */
@Component({
  selector: 'app-notifications',
  imports: [
    DatePipe, DecimalPipe, FormsModule, ButtonModule, DialogModule, InputTextModule, SelectModule, TableModule,
    Tabs, TabList, Tab, TabPanels, TabPanel, TagModule, TextareaModule, ToggleSwitchModule, TooltipModule, PageHeaderComponent, StatTilesComponent,
  ],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotifyService);

  tab = 'types';

  // types
  types: any[] = [];
  loadingTypes = false;

  // wording editor
  editing: any = null;
  wording: Record<WordingField, string> = { title: '', body: '', sms: '', whatsapp: '' };
  activeField: WordingField = 'body';
  focused: HTMLInputElement | HTMLTextAreaElement | null = null;
  saving = false;

  // push notifications
  pushes: any[] = [];
  loadingPush = false;
  pushForm: { id?: string; title: string; message: string } | null = null;
  savingPush = false;

  // delivery log
  deliveries: any[] = [];
  total = 0;
  first = 0;
  loadingDeliveries = false;
  filters: any = { fromDate: '', toDate: '', channel: null, status: null, keyword: '' };
  tiles: StatTile[] = [];
  viewing: any = null;
  private lastEvent: any = { first: 0, rows: 20 };

  readonly channels = [
    { id: 'EMAIL', itemName: 'Email' },
    { id: 'SMS', itemName: 'SMS' },
    { id: 'WHATSAPP', itemName: 'WhatsApp' },
  ];
  readonly statuses = [
    { id: 'PENDING', itemName: 'Pending' },
    { id: 'SENT', itemName: 'Sent' },
    { id: 'CANCELLED', itemName: 'Cancelled' },
    { id: 'FAILED', itemName: 'Failed' },
  ];
  /** Row keys of the per-channel fields (emailStatus, smsStatus, whatsappStatus...). */
  readonly channelKeys = [
    { key: 'email', label: 'Email', icon: 'pi pi-envelope', id: 'EMAIL' },
    { key: 'sms', label: 'SMS', icon: 'pi pi-mobile', id: 'SMS' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'pi pi-whatsapp', id: 'WHATSAPP' },
  ];

  ngOnInit() {
    this.loadTypes();
    this.loadPush();
    this.loadSummary();
  }

  // ---------------------------------------------------------------- types

  async loadTypes() {
    this.loadingTypes = true;
    const response = await this.api.get('notifications/types');
    this.loadingTypes = false;
    if (response.success) {
      this.types = response.data;
    }
  }

  async toggle(type: any, field: 'enabled' | 'email' | 'sms' | 'whatsapp', value: boolean) {
    const response = await this.api.put(`notifications/types/${encodeURIComponent(type.code)}`, { [field]: value });
    if (response.success) {
      this.replaceType(response.data);
    } else {
      type[field] = !value;
    }
  }

  async reset(type: any) {
    if (!(await this.notify.confirm(`Put "${type.label}" back to its default channels and wording?`, 'Reset to default', 'Reset'))) {
      return;
    }
    const response = await this.api.put(`notifications/types/${encodeURIComponent(type.code)}`, { reset: true });
    if (response.success) {
      this.replaceType(response.data);
    }
  }

  async sendTest(type: any) {
    await this.api.post(`notifications/types/${encodeURIComponent(type.code)}/test`);
    setTimeout(() => this.refreshDeliveries(), 4000);
  }

  private replaceType(row: any) {
    this.types = this.types.map((t) => (t.code === row.code ? row : t));
    if (this.editing?.code === row.code) {
      this.editing = row;
    }
  }

  // --------------------------------------------------------------- wording

  edit(type: any) {
    this.editing = type;
    this.wording = { title: type.wording.title, body: type.wording.body, sms: type.wording.sms, whatsapp: type.wording.whatsapp };
    this.activeField = 'body';
  }

  /** Inserts {{token}} at the caret of the field last focused. */
  insertToken(token: string, el?: HTMLInputElement | HTMLTextAreaElement | null) {
    const text = `{{${token}}}`;
    const value = this.wording[this.activeField] || '';
    if (el && el.selectionStart != null) {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      this.wording[this.activeField] = value.slice(0, start) + text + value.slice(end);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + text.length, start + text.length);
      });
    } else {
      this.wording[this.activeField] = value + text;
    }
  }

  restoreDefault(field: WordingField) {
    const w = this.editing.wording;
    this.wording[field] = { title: w.defaultTitle, body: w.defaultBody, sms: w.defaultSms, whatsapp: w.defaultWhatsapp }[field];
  }

  /** Preview with sample values: each token shows as its name in brackets. */
  preview(text: string): string {
    return (text || '').replace(/\{\{\s*([A-Za-z0-9_.]+)\s*}}/g, (_m, name) => (name === 'companyName' && this.editing?.companyName ? this.editing.companyName : `[${name}]`));
  }

  smsSegments(text: string): number {
    const length = this.preview(text).length;
    return length <= 160 ? 1 : Math.ceil(length / 153);
  }

  async saveWording() {
    this.saving = true;
    const response = await this.api.put(`notifications/types/${encodeURIComponent(this.editing.code)}`, {
      title: this.wording.title,
      body: this.wording.body,
      smsText: this.wording.sms,
      whatsappText: this.wording.whatsapp,
    });
    this.saving = false;
    if (response.success) {
      this.replaceType(response.data);
      this.editing = null;
    }
  }

  // ---------------------------------------------------- push notifications

  async loadPush() {
    this.loadingPush = true;
    const response = await this.api.get('notifications/push');
    this.loadingPush = false;
    if (response.success) {
      this.pushes = response.data;
    }
  }

  newPush() {
    this.pushForm = { title: '', message: '' };
  }

  editPush(row: any) {
    this.pushForm = { id: row.id, title: row.title, message: row.message };
  }

  async savePush() {
    if (!this.pushForm) {
      return;
    }
    this.savingPush = true;
    const response = await this.api.save('notifications/push', this.pushForm);
    this.savingPush = false;
    if (response.success) {
      this.pushForm = null;
      this.loadPush();
    }
  }

  async publish(row: any) {
    if (!(await this.notify.confirm(`Publish "${row.title}" to clients?`, 'Publish push notification', 'Publish'))) {
      return;
    }
    await this.api.post(`notifications/push/${encodeURIComponent(row.id)}/publish`);
  }

  async deletePush(row: any) {
    if (!(await this.notify.confirmDelete(`"${row.title}"`))) {
      return;
    }
    const response = await this.api.delete(`notifications/push/${encodeURIComponent(row.id)}`);
    if (response.success) {
      this.loadPush();
    }
  }

  // ---------------------------------------------------------- delivery log

  async loadSummary() {
    const response = await this.api.get('notifications/deliveries/summary');
    if (response.success) {
      const s = response.data;
      this.tiles = [
        { label: 'Messages this month', value: s.messages, format: 'number' },
        { label: 'Email sent', value: s.emailSent, format: 'number', foot: 'This month' },
        { label: 'SMS sent', value: s.smsSent, format: 'number', foot: 'This month' },
        { label: 'WhatsApp logged', value: s.whatsappSent, format: 'number', foot: 'Logged only, no provider yet' },
        { label: 'Failed', value: s.failed, format: 'number', tone: s.failed ? 'bad' : '', foot: 'Channels this month' },
        { label: 'Cancelled', value: s.cancelled, format: 'number', foot: 'No address, or channel off' },
        { label: 'Waiting to send', value: s.pending, format: 'number', tone: s.pending ? 'warn' : '' },
      ];
    }
  }

  refreshDeliveries() {
    this.first = 0;
    this.loadDeliveries({ ...this.lastEvent, first: 0 });
    this.loadSummary();
  }

  async loadDeliveries(event: any) {
    this.lastEvent = event;
    this.loadingDeliveries = true;
    const response = await this.api.get('notifications/deliveries', { ...this.filters, ...pageParams(event) });
    this.loadingDeliveries = false;
    if (response.success) {
      this.deliveries = response.data;
      this.total = response.pager?.totalRecords ?? this.deliveries.length;
    }
  }

  /** Retries every failed channel of a message, or just one channel when given. */
  async retry(row: any, channel?: string) {
    const query = channel ? `?channel=${channel}` : '';
    const response = await this.api.post(`notifications/deliveries/${row.id}/retry${query}`);
    if (response.success) {
      if (this.viewing?.id === row.id) {
        this.viewing = response.data;
      }
      setTimeout(() => this.loadDeliveries(this.lastEvent), 3000);
      this.loadDeliveries(this.lastEvent);
    }
  }

  statusSeverity(status: string): 'success' | 'warn' | 'danger' | 'secondary' | 'info' {
    return status === 'SENT' ? 'success' : status === 'FAILED' ? 'danger' : status === 'PENDING' ? 'warn' : 'secondary';
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'SENT': return 'pi pi-check-circle';
      case 'PENDING': return 'pi pi-clock';
      case 'FAILED': return 'pi pi-times-circle';
      case 'CANCELLED': return 'pi pi-ban';
      default: return 'pi pi-minus';
    }
  }

  /** Tooltip for a channel cell: its status, note and attempts. */
  channelTip(row: any, key: string): string {
    const status = row[key + 'StatusName'];
    if (!status) {
      return 'Not used by this notification';
    }
    const parts = [status];
    if (row[key + 'Note']) {
      parts.push(row[key + 'Note']);
    }
    if (row[key + 'Attempts'] > 1) {
      parts.push(row[key + 'Attempts'] + ' attempts');
    }
    return parts.join(' · ');
  }

  channelAddress(row: any, key: string): string {
    return key === 'email' ? row.recipientEmail : row.recipientPhone;
  }
}
