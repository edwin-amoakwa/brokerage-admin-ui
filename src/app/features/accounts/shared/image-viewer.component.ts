import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';

const MIN = 0.25;
const MAX = 6;
const STEP = 1.25;

/**
 * A dialog that shows one image large, for checking a photo or signature:
 * zoom with the buttons, the mouse wheel or a double-click, drag (or scroll)
 * to move around a zoomed image, and rotate a sideways photo.
 */
@Component({
  selector: 'app-image-viewer',
  imports: [DialogModule, ButtonModule, TooltipModule],
  template: `
    <p-dialog [visible]="!!src" (visibleChange)="!$event && close()" [modal]="true" [dismissableMask]="true"
              [draggable]="false" [resizable]="false" [header]="title" styleClass="image-viewer"
              [style]="{ width: 'min(960px, 96vw)' }" (onShow)="reset()">
      <div class="tools" role="toolbar" aria-label="Image controls">
        <p-button icon="pi pi-search-minus" [text]="true" [rounded]="true" (onClick)="zoomBy(1 / STEP)"
                  [disabled]="scale <= MIN" pTooltip="Zoom out" ariaLabel="Zoom out" />
        <span class="pct" aria-live="polite">{{ round(scale * 100) }}%</span>
        <p-button icon="pi pi-search-plus" [text]="true" [rounded]="true" (onClick)="zoomBy(STEP)"
                  [disabled]="scale >= MAX" pTooltip="Zoom in" ariaLabel="Zoom in" />
        <span class="sep"></span>
        <p-button icon="pi pi-refresh" [text]="true" [rounded]="true" (onClick)="rotate()"
                  pTooltip="Rotate" ariaLabel="Rotate 90 degrees" />
        <p-button label="Fit" [text]="true" size="small" (onClick)="reset()" [disabled]="scale === 1 && !rotation" />
      </div>
      <div class="stage" [class.zoomed]="scale > 1" [class.dragging]="dragging" (wheel)="onWheel($event)"
           (dblclick)="scale > 1 ? reset() : zoomBy(2)" (pointerdown)="startDrag($event)" (pointermove)="drag($event)"
           (pointerup)="endDrag()" (pointercancel)="endDrag()" (pointerleave)="endDrag()" #stage>
        @if (src) {
          <img [src]="src" [alt]="title" draggable="false"
               [style.transform]="'translate(' + x + 'px,' + y + 'px) rotate(' + rotation + 'deg) scale(' + scale + ')'" />
        }
      </div>
      <div class="hint">Scroll or double-click to zoom · drag to move</div>
    </p-dialog>
  `,
  styles: `
    .tools { display: flex; align-items: center; gap: 4px; margin: -4px 0 8px; }
    .pct { min-width: 48px; text-align: center; font-size: 12.5px; font-variant-numeric: tabular-nums; color: var(--app-muted); }
    .sep { width: 1px; height: 20px; background: var(--app-border, #e3e7e5); margin: 0 6px; }
    .stage {
      position: relative; height: min(68vh, 640px); overflow: hidden; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; cursor: zoom-in; touch-action: none; user-select: none;
      background-color: #fff;
      background-image: linear-gradient(45deg, #f1f3f2 25%, transparent 25%), linear-gradient(-45deg, #f1f3f2 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #f1f3f2 75%), linear-gradient(-45deg, transparent 75%, #f1f3f2 75%);
      background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0;
      border: 1px solid var(--app-border, #e3e7e5);
    }
    .stage.zoomed { cursor: grab; }
    .stage.dragging { cursor: grabbing; }
    .stage img { max-width: 100%; max-height: 100%; object-fit: contain; transition: transform 0.12s ease-out; transform-origin: center; }
    .stage.dragging img { transition: none; }
    .hint { margin-top: 8px; font-size: 12px; color: var(--app-muted); text-align: center; }
  `,
})
export class ImageViewerComponent {
  /** The image to show; null closes the dialog. */
  @Input() src: string | null = null;
  @Input() title = '';
  @Output() closed = new EventEmitter<void>();

  readonly MIN = MIN;
  readonly MAX = MAX;
  readonly STEP = STEP;

  scale = 1;
  rotation = 0;
  x = 0;
  y = 0;
  dragging = false;
  private from: { px: number; py: number; x: number; y: number } | null = null;

  close() {
    this.closed.emit();
  }

  reset() {
    this.scale = 1;
    this.rotation = 0;
    this.x = 0;
    this.y = 0;
  }

  zoomBy(factor: number) {
    this.scale = Math.min(MAX, Math.max(MIN, this.scale * factor));
    if (this.scale <= 1) {
      this.x = 0;
      this.y = 0;
    }
  }

  rotate() {
    this.rotation = (this.rotation + 90) % 360;
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    this.zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15);
  }

  startDrag(event: PointerEvent) {
    if (this.scale <= 1) {
      return;
    }
    this.dragging = true;
    this.from = { px: event.clientX, py: event.clientY, x: this.x, y: this.y };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  drag(event: PointerEvent) {
    if (!this.dragging || !this.from) {
      return;
    }
    this.x = this.from.x + (event.clientX - this.from.px);
    this.y = this.from.y + (event.clientY - this.from.py);
  }

  endDrag() {
    this.dragging = false;
    this.from = null;
  }

  round(n: number) {
    return Math.round(n);
  }
}
