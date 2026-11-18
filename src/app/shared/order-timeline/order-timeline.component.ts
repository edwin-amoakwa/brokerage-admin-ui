import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface TimelineEntry {
  time: string | null;
  event: string;
  label: string;
  actor: string | null;
  text: string | null;
}

/** One order's history (trading_activity_log) as a vertical timeline. */
@Component({
  selector: 'app-order-timeline',
  imports: [DatePipe],
  template: `
    @if (entries.length) {
      <ol class="tl">
        @for (e of entries; track $index) {
          <li class="tl-item" [class]="'tone-' + tone(e.event)">
            <span class="dot" aria-hidden="true"><i class="pi" [class]="'pi ' + icon(e.event)"></i></span>
            <div class="body">
              <div class="head">
                <span class="label">{{ e.label }}</span>
                @if (e.time) { <time class="time">{{ e.time | date: 'dd/MM/yyyy HH:mm:ss' }}</time> }
              </div>
              @if (e.text && e.text !== e.label) { <div class="text">{{ e.text }}</div> }
              @if (e.actor) { <div class="actor">{{ e.actor }}</div> }
            </div>
          </li>
        }
      </ol>
    } @else {
      <p class="empty">No history recorded for this order yet.</p>
    }
  `,
  styles: `
    :host { display: block; }
    .tl { list-style: none; margin: 0; padding: 0; }
    .tl-item { position: relative; display: flex; gap: 12px; padding-bottom: 14px; }
    .tl-item:not(:last-child)::before { content: ''; position: absolute; left: 13px; top: 28px; bottom: 0; width: 2px; background: var(--app-border); }
    .dot { flex: 0 0 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: #eef1f0; color: var(--app-muted); font-size: 12px; }
    .tone-good .dot { background: #e3f3ea; color: var(--app-ok); }
    .tone-bad .dot { background: #fde8e6; color: var(--app-bad); }
    .tone-wait .dot { background: #fff4df; color: var(--app-warn); }
    .body { flex: 1; min-width: 0; padding-top: 3px; }
    .head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 12px; }
    .label { font-weight: 600; }
    .time { font-size: 12px; color: var(--app-muted); font-variant-numeric: tabular-nums; }
    .text { font-size: 13px; color: var(--app-text); margin-top: 2px; overflow-wrap: anywhere; }
    .actor { font-size: 12px; color: var(--app-muted); margin-top: 2px; }
    .empty { color: var(--app-muted); margin: 0; }
  `,
})
export class OrderTimelineComponent {
  @Input() entries: TimelineEntry[] = [];

  tone(event: string): string {
    switch (event) {
      case 'ACKNOWLEDGED': case 'PARTIAL_FILL': case 'FILL': case 'SENT': case 'RELEASED':
      case 'EXECUTION': case 'TRADE_BOOKED': return 'good';
      case 'REJECTED': case 'CANCELLED': case 'EXPIRED': case 'NOT_DELIVERED': case 'TRADE_BUST':
      case 'CANCEL_REFUSED': case 'REPLACE_REFUSED': case 'DELETED': case 'EXECUTION_REMOVED': return 'bad';
      case 'HELD': case 'CANCEL_REQUESTED': case 'WITH_DESK': case 'BATCHED': return 'wait';
      default: return 'plain';
    }
  }

  icon(event: string): string {
    switch (event) {
      case 'CREATED': return 'pi-plus';
      case 'SENT': case 'RELEASED': return 'pi-send';
      case 'HELD': case 'WITH_DESK': return 'pi-user';
      case 'ACKNOWLEDGED': return 'pi-check';
      case 'PARTIAL_FILL': case 'FILL': return 'pi-chart-line';
      case 'CANCEL_REQUESTED': return 'pi-clock';
      case 'CANCELLED': return 'pi-ban';
      case 'CANCEL_REFUSED': case 'REPLACE_REFUSED': case 'REJECTED': case 'NOT_DELIVERED': return 'pi-times';
      case 'EXPIRED': return 'pi-hourglass';
      case 'REPLACED': case 'UPDATED': case 'EXECUTION_CHANGED': return 'pi-pencil';
      case 'BATCHED': case 'UNBATCHED': return 'pi-box';
      case 'EXECUTION': return 'pi-chart-line';
      case 'EXECUTION_REMOVED': return 'pi-minus-circle';
      case 'TRADE_BOOKED': return 'pi-book';
      case 'DELETED': return 'pi-trash';
      default: return 'pi-circle';
    }
  }
}
