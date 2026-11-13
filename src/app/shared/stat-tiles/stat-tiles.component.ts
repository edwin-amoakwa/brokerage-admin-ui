import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface StatTile {
  label: string;
  value: any;
  /** 'money' (2 dp), 'number' (0 dp) or 'text'. Default 'money'. */
  format?: 'money' | 'number' | 'text';
  foot?: string;
  tone?: 'ok' | 'warn' | 'bad' | '';
  /** Any value; passed back by (tileClick) for click-to-filter tiles. */
  key?: any;
  active?: boolean;
}

/** Summary tile strip, replacing <brokerage:stats> / <brokerage:statTile>. */
@Component({
  selector: 'app-stat-tiles',
  imports: [DecimalPipe],
  templateUrl: './stat-tiles.component.html',
  styleUrl: './stat-tiles.component.scss',
})
export class StatTilesComponent {
  @Input() tiles: StatTile[] = [];
  @Input() clickable = false;
  @Output() tileClick = new EventEmitter<StatTile>();
}
