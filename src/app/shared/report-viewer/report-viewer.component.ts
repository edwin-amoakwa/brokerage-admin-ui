import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ReportData } from '../../core/report-data';
import { SanitizerPipe } from '../sanitise.pipe';

/** Shows a PDF held in a ReportData in a maximisable dialog (astra-app's app-report-viewer). */
@Component({
  selector: 'app-report-viewer',
  imports: [FormsModule, DialogModule, SanitizerPipe],
  templateUrl: './report-viewer.component.html',
  styleUrl: './report-viewer.component.scss',
})
export class ReportViewerComponent {
  @Input() reportData!: ReportData;
}
