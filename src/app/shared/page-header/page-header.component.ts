import { Component, Input } from '@angular/core';

/** Title bar of a screen; projected content becomes the action buttons on the right. */
@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
