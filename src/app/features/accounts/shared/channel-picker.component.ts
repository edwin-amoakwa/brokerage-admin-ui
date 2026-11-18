import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';

export interface ChannelOption {
  id: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP';
  key: 'email' | 'sms' | 'whatsapp' | 'inapp';
  label: string;
  icon: string;
}

export const MESSAGE_CHANNELS: ChannelOption[] = [
  { id: 'EMAIL', key: 'email', label: 'Email', icon: 'pi pi-envelope' },
  { id: 'SMS', key: 'sms', label: 'SMS', icon: 'pi pi-mobile' },
  { id: 'WHATSAPP', key: 'whatsapp', label: 'WhatsApp', icon: 'pi pi-whatsapp' },
  { id: 'IN_APP', key: 'inapp', label: 'In-app', icon: 'pi pi-bell' },
];

/**
 * The channels an investor can be reached on: email needs an email address,
 * SMS and WhatsApp a mobile number; in-app always works (it waits in their
 * inbox until they next sign in).
 */
export function reachableChannels(investor: any): string[] {
  return MESSAGE_CHANNELS.filter((c) => channelAddress(investor, c.id)).map((c) => c.id);
}

export function channelAddress(investor: any, id: string): string {
  if (id === 'IN_APP') {
    return investor?.id ? 'App inbox' : '';
  }
  return (id === 'EMAIL' ? investor?.emailAddress : investor?.mobilePhone)?.trim() || '';
}

/**
 * Toggle buttons for email / SMS / WhatsApp, each showing the address it goes
 * to. A channel the investor has no address for is disabled.
 */
@Component({
  selector: 'app-channel-picker',
  imports: [TooltipModule],
  template: `
    <div class="channels" role="group" aria-label="Send by">
      @for (c of options; track c.id) {
        <button type="button" class="channel" [class.on]="isOn(c.id)" [disabled]="!address(c.id)"
                [attr.aria-pressed]="isOn(c.id)" (click)="toggle(c.id)"
                [pTooltip]="address(c.id) ? '' : (c.id === 'EMAIL' ? 'No email address on file' : 'No mobile number on file')">
          <i [class]="c.icon"></i>
          <span class="label">{{ c.label }}</span>
          <span class="addr">{{ address(c.id) || 'not on file' }}</span>
          @if (isOn(c.id)) { <i class="pi pi-check tick"></i> }
        </button>
      }
    </div>
  `,
  styles: `
    .channels { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
    .channel {
      position: relative; display: grid; grid-template-columns: auto 1fr; column-gap: 8px; align-items: center; text-align: left;
      padding: 9px 12px; border: 1px solid var(--app-border, #e3e7e5); border-radius: 10px; background: #fff; cursor: pointer;
      font: inherit; color: inherit;
      > i:first-child { grid-row: span 2; font-size: 16px; color: var(--app-muted); }
      .label { font-weight: 600; font-size: 13px; }
      .addr { font-size: 11.5px; color: var(--app-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tick { position: absolute; top: 8px; right: 10px; font-size: 12px; }
      &.on { border-color: #0b3c2b; background: #eef5f1; > i:first-child, .tick { color: #0b3c2b; } }
      &:disabled { cursor: not-allowed; opacity: 0.55; background: #f6f8f7; }
      &:focus-visible { outline: 2px solid #0b3c2b; outline-offset: 2px; }
    }
  `,
})
export class ChannelPickerComponent implements OnChanges {
  @Input() investor: any;
  @Input() channels: string[] = [];
  @Output() channelsChange = new EventEmitter<string[]>();

  readonly options = MESSAGE_CHANNELS;

  ngOnChanges() {
    // Drop anything the investor cannot be reached on.
    const usable = (this.channels || []).filter((c) => this.address(c));
    if (usable.length !== (this.channels || []).length) {
      this.channels = usable;
      queueMicrotask(() => this.channelsChange.emit(usable));
    }
  }

  address(id: string): string {
    return channelAddress(this.investor, id);
  }

  isOn(id: string): boolean {
    return (this.channels || []).includes(id);
  }

  toggle(id: string) {
    this.channels = this.isOn(id) ? this.channels.filter((c) => c !== id) : [...(this.channels || []), id];
    this.channelsChange.emit(this.channels);
  }
}
