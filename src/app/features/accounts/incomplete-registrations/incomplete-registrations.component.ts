import { Component } from '@angular/core';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { InvestorTableComponent } from '../shared/investor-table.component';

/**
 * Read-only queue of investors whose registration is not complete
 * (JSF accounts/incomplete-kycs.xhtml). Loaded fresh on every visit and
 * paged on the server; the JSF list was cached for the whole session.
 */
@Component({
  selector: 'app-incomplete-registrations',
  imports: [PageHeaderComponent, InvestorTableComponent],
  templateUrl: './incomplete-registrations.component.html',
  styleUrl: './incomplete-registrations.component.scss',
})
export class IncompleteRegistrationsComponent {}
