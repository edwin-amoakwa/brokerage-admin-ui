import { formatDate } from '@angular/common';
import { Component, ViewChild, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { NotifyService } from '../../../core/notify.service';
import { ExcelService } from '../../../services/excel.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { CsdUploadComponent } from '../csd-upload/csd-upload.component';
import { InvestorTableComponent } from '../shared/investor-table.component';

/**
 * Columns written to the export, in order. An allow-list: only these fields
 * leave the app, so ids, UI-only fields and anything the backend adds later
 * stay out of the file.
 */
const EXPORT_COLUMNS: { header: string; value: (r: any) => any }[] = [
  { header: 'INVESTOR_CODE', value: (r) => r.investorCode },
  { header: 'DISPLAY_NAME', value: (r) => r.displayName || r.corporateName || `${r.surname ?? ''} ${r.firstName ?? ''}`.trim() },
  { header: 'EMAIL_ADDRESS', value: (r) => r.emailAddress },
  { header: 'MOBILE_PHONE', value: (r) => r.mobilePhone },
  { header: 'REGISTRATION_DATE', value: (r) => (r.registrationDate ? formatDate(r.registrationDate, 'dd/MM/yyyy', 'en-US') : '') },
  { header: 'CSD_NUMBER', value: () => '' },
];

/**
 * Read-only queue of investors whose registration is not complete
 * (JSF accounts/incomplete-kycs.xhtml). Loaded fresh on every visit and
 * paged on the server; the JSF list was cached for the whole session.
 * Export writes every matching investor (honouring the search) to Excel.
 */
@Component({
  selector: 'app-incomplete-registrations',
  imports: [PageHeaderComponent, InvestorTableComponent, ButtonModule, DialogModule, CsdUploadComponent],
  templateUrl: './incomplete-registrations.component.html',
  styleUrl: './incomplete-registrations.component.scss',
})
export class IncompleteRegistrationsComponent {
  private notify = inject(NotifyService);

  @ViewChild(InvestorTableComponent) table?: InvestorTableComponent;

  exporting = false;
  showCsdUpload = false;

  onImported() {
    this.showCsdUpload = false;
    this.table?.refresh();
  }

  async export() {
    if (!this.table || this.exporting) {
      return;
    }
    this.exporting = true;
    try {
      const rows = await this.table.fetchAll();
      if (rows === null) {
        this.notify.error('Could not load registrations for export.');
        return;
      }
      if (rows.length === 0) {
        this.notify.info('There are no incomplete registrations to export.');
        return;
      }
      const headers = EXPORT_COLUMNS.map((c) => c.header);
      const data = rows.map((r) => EXPORT_COLUMNS.map((c) => c.value(r) ?? ''));
      ExcelService.exportRowsAsExcelFile(headers, data, 'incomplete-registrations');
      this.notify.success(`Exported ${rows.length} registration${rows.length === 1 ? '' : 's'}.`);
    } finally {
      this.exporting = false;
    }
  }
}
