import { DatePipe } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../../core/api.service';
import { ChannelPickerComponent, MESSAGE_CHANNELS, channelAddress, reachableChannels } from './channel-picker.component';
import { CORRECTION_PRESETS, MAX_MESSAGE, MAX_SUBJECT, SMS_SEGMENT, appendPreset } from './investor-messages';

/**
 * The investor's message history (every notification sent to them, with each
 * channel's status and retry) plus "Message investor": a typed message sent by
 * email, SMS and/or WhatsApp. Call reload() after another action sends one
 * (verify, return for correction).
 */
@Component({
  selector: 'app-investor-messages',
  imports: [DatePipe, FormsModule, ButtonModule, DialogModule, InputTextModule, TextareaModule, TooltipModule, ChannelPickerComponent],
  templateUrl: './investor-messages.component.html',
  styleUrl: './investor-messages.component.scss',
})
export class InvestorMessagesComponent implements OnChanges {
  private api = inject(ApiService);

  @Input({ required: true }) investor: any;

  readonly channelKeys = MESSAGE_CHANNELS;
  readonly presets = CORRECTION_PRESETS;
  readonly maxSubject = MAX_SUBJECT;
  readonly maxMessage = MAX_MESSAGE;

  messages: any[] = [];
  loading = false;
  expanded: string | null = null;

  composing = false;
  sending = false;
  form = { subject: '', message: '', channels: [] as string[] };

  ngOnChanges(changes: SimpleChanges) {
    const prev = changes['investor']?.previousValue;
    if (this.investor?.id && prev?.id !== this.investor.id) {
      this.expanded = null;
      this.reload();
    }
  }

  async reload() {
    if (!this.investor?.id) {
      return;
    }
    this.loading = true;
    const response = await this.api.get(`investors/${this.investor.id}/messages`);
    this.loading = false;
    if (response.success) {
      this.messages = response.data || [];
    }
  }

  get reachable(): boolean {
    return reachableChannels(this.investor).length > 0;
  }

  compose() {
    this.form = { subject: '', message: '', channels: reachableChannels(this.investor) };
    this.composing = true;
  }

  addPreset(text: string) {
    this.form.message = appendPreset(this.form.message, text);
  }

  get smsSegments(): number {
    return Math.max(1, Math.ceil((this.form.message || '').length / SMS_SEGMENT));
  }

  get canSend(): boolean {
    return !!this.form.message.trim() && this.form.channels.length > 0 && this.form.message.length <= MAX_MESSAGE;
  }

  async send() {
    if (!this.canSend) {
      return;
    }
    this.sending = true;
    const response = await this.api.post(`investors/${this.investor.id}/messages`, this.form);
    this.sending = false;
    if (response.success) {
      this.messages = response.data || [];
      this.composing = false;
    }
  }

  async retry(row: any, channel?: string) {
    const query = channel ? `?channel=${channel}` : '';
    const response = await this.api.post(`investors/${this.investor.id}/messages/${row.id}/retry${query}`);
    if (response.success) {
      const i = this.messages.findIndex((m) => m.id === row.id);
      if (i >= 0) {
        this.messages[i] = response.data;
      }
    }
  }

  toggle(row: any) {
    this.expanded = this.expanded === row.id ? null : row.id;
  }

  address(row: any, key: string): string {
    return key === 'email' ? row.recipientEmail : key === 'inapp' ? 'App inbox' : row.recipientPhone;
  }

  investorAddress(id: string): string {
    return channelAddress(this.investor, id);
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

  channelTip(row: any, key: string, label: string): string {
    const parts = [label, row[key + 'StatusName']];
    if (key === 'inapp' && row.inappStatus === 'SENT') {
      parts.push(row.inappReadAt ? 'read' : 'not read yet');
    }
    if (row[key + 'Note']) {
      parts.push(row[key + 'Note']);
    }
    return parts.join(' · ');
  }
}
