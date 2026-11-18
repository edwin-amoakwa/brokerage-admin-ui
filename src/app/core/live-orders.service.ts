import { Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';

/** One order change, as the server sends it (same shape as the investor stream). */
export interface OrderChange {
  orderId: string;
  orderNo?: number;
  assetClass: 'EQUITY' | 'FIXED_INCOME';
  event: string;
  label: string;
  text?: string;
  actor?: string;
  time?: string;
  orderStatus?: string;
  filled?: number;
  remaining?: number;
}

/** Renew the stream token this often while a page uses it (it lasts 12 hours). */
const RENEW_MS = 60 * 60 * 1000;
/** After the stream fails outright, try again after this long. */
const RETRY_MS = 15_000;

/**
 * The back office's live order stream (Server-Sent Events) for the working orders pages. Pages call
 * acquire() on init and release() on destroy; the stream is open while at least one page uses it.
 * {@link changes$} carries every order change; {@link resync$} fires when the stream (re)connects, so a
 * page reloads anything it may have missed while disconnected.
 */
@Injectable({ providedIn: 'root' })
export class LiveOrdersService implements OnDestroy {
  private api = inject(ApiService);
  private zone = inject(NgZone);

  readonly connected = signal(false);
  readonly changes$ = new Subject<OrderChange>();
  readonly resync$ = new Subject<void>();

  private users = 0;
  private source: EventSource | null = null;
  private renewTimer: any = null;
  private retryTimer: any = null;
  private everConnected = false;

  acquire() {
    this.users++;
    if (this.users === 1) {
      this.open();
      this.zone.runOutsideAngular(() => {
        this.renewTimer = setInterval(() => this.open(), RENEW_MS); // reopen with a fresh token
      });
    }
  }

  release() {
    this.users = Math.max(0, this.users - 1);
    if (this.users === 0) {
      clearInterval(this.renewTimer);
      clearTimeout(this.retryTimer);
      this.renewTimer = this.retryTimer = null;
      this.close();
      this.connected.set(false);
      this.everConnected = false;
    }
  }

  ngOnDestroy() {
    this.users = 1;
    this.release();
  }

  /** Gets a stream token through the normal signed-in API, then opens the stream with it. */
  private async open() {
    if (this.users === 0 || typeof EventSource === 'undefined') {
      return;
    }
    const r = await this.api.postQuiet('stream/token');
    if (this.users === 0) {
      return;
    }
    if (!r.success || !r.data?.token) {
      this.scheduleRetry(); // no access or signed out: pages keep working without live updates
      return;
    }
    this.close();
    const source = new EventSource(`${environment.baseApi}/stream?token=${encodeURIComponent(r.data.token)}`);
    this.source = source;
    source.addEventListener('ready', () => this.zone.run(() => {
      this.connected.set(true);
      if (this.everConnected) {
        this.resync$.next(); // reconnected: reload what may have changed meanwhile
      }
      this.everConnected = true;
    }));
    source.addEventListener('order', (e: MessageEvent) => this.zone.run(() => {
      try {
        this.changes$.next(JSON.parse(e.data));
      } catch {
        // ignore a malformed event
      }
    }));
    source.addEventListener('unauthorised', () => this.zone.run(() => {
      this.close();
      this.connected.set(false);
      this.scheduleRetry();
    }));
    source.onerror = () => this.zone.run(() => {
      this.connected.set(false);
      if (source.readyState === EventSource.CLOSED) {
        this.scheduleRetry();
      }
    });
  }

  private close() {
    if (this.source) {
      this.source.close();
      this.source = null;
    }
  }

  private scheduleRetry() {
    clearTimeout(this.retryTimer);
    if (this.users > 0) {
      this.retryTimer = setTimeout(() => this.open(), RETRY_MS);
    }
  }
}
