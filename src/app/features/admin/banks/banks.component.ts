import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { LookupService } from '../../../core/lookup.service';
import { SessionService } from '../../../core/session.service';
import { CrudConfig, CrudPageComponent } from '../../../shared/crud-page/crud-page.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';

/**
 * Banks and Bank Branches on one page (JSF sysadmin/bank.xhtml and
 * sysadmin/bank-branches.xhtml), one tab each. Each tab still needs its own
 * permission (admin.banks / admin.bank-branches); with only one, that table
 * shows without tabs. ?tab=branches opens the Branches tab, and the old
 * /admin/bank-branches route redirects there.
 *
 * Branches work one bank at a time: pick a bank (the picker filters as you
 * type), its saved branches are listed, and "Add bank branch" adds one to that
 * bank. The bank list is re-read each time the Branches tab opens, so a bank
 * added on the Banks tab is selectable at once.
 */
@Component({
  selector: 'app-banks',
  imports: [NgTemplateOutlet, FormsModule, SelectModule, CrudPageComponent, PageHeaderComponent, Tabs, TabList, Tab, TabPanels, TabPanel],
  templateUrl: './banks.component.html',
  styleUrl: './banks.component.scss',
})
export class BanksComponent implements OnInit {
  private session = inject(SessionService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lookups = inject(LookupService);

  readonly canBanks = this.session.can('admin.banks');
  readonly canBranches = this.session.can('admin.bank-branches');
  tab = 'banks';

  readonly banks: CrudConfig = {
    title: 'Banks',
    resource: 'banks',
    noun: 'bank',
    invalidates: ['banks', 'banks-all'],
    defaults: () => ({ bankActive: true, viewOrder: 0 }),
    columns: [
      { field: 'bankName', header: 'Bank Name' },
      { field: 'sortCode', header: 'Sort Code' },
      { field: 'swiftCode', header: 'SWIFT Code' },
      { field: 'countryName', header: 'Country' },
      { field: 'bankActive', header: 'Active', type: 'boolean' },
      { field: 'viewOrder', header: 'View Order', type: 'number' },
    ],
    fields: [
      { key: 'bankName', label: 'Name', type: 'text', required: true, col: 12 },
      { key: 'sortCode', label: 'Sort code', type: 'text' },
      { key: 'swiftCode', label: 'SWIFT code', type: 'text' },
      { key: 'countryId', label: 'Country', type: 'select', list: 'countries' },
      { key: 'viewOrder', label: 'View order', type: 'number' },
      { key: 'bankActive', label: 'Active', type: 'checkbox' },
      { key: 'mobileMoney', label: 'Mobile money', type: 'checkbox' },
    ],
  };

  /** Banks to pick from on the Branches tab. */
  bankOptions: any[] = [];
  selectedBankId: string | null = null;
  /** The branch list and form for the selected bank; null until a bank is picked. */
  branches: CrudConfig | null = null;

  get selectedBankName(): string {
    return this.bankOptions.find((b) => b.id === this.selectedBankId)?.itemName ?? '';
  }

  async loadBankOptions() {
    this.bankOptions = await this.lookups.list('banks-all');
    // A bank deleted on the Banks tab is no longer selectable.
    if (this.selectedBankId && !this.bankOptions.some((b) => b.id === this.selectedBankId)) {
      this.selectBank(null);
    }
  }

  /** Lists the chosen bank's branches; a new branch is added to that bank. */
  selectBank(bankId: string | null) {
    this.selectedBankId = bankId;
    this.branches = bankId ? this.branchesOf(bankId) : null;
  }

  private branchesOf(bankId: string): CrudConfig {
    return {
      title: 'Bank Branches',
      resource: 'bank-branches',
      noun: 'bank branch',
      params: { bankId },
      invalidates: ['bank-branches'],
      // The bank is the one selected, so it is neither a column nor a form field.
      defaults: () => ({ branchActive: true, bankId }),
      columns: [
        { field: 'branchName', header: 'Branch Name' },
        { field: 'sortCode', header: 'Sort Code' },
        { field: 'swiftCode', header: 'SWIFT Code' },
        { field: 'branchActive', header: 'Active', type: 'boolean' },
      ],
      fields: [
        { key: 'branchName', label: 'Branch name', type: 'text', required: true, col: 12 },
        { key: 'sortCode', label: 'Sort code', type: 'text' },
        { key: 'swiftCode', label: 'SWIFT code', type: 'text' },
        { key: 'branchActive', label: 'Active', type: 'checkbox' },
      ],
    };
  }

  ngOnInit() {
    if (this.route.snapshot.queryParamMap.get('tab') === 'branches') {
      this.tab = 'branches';
    }
    if (this.canBranches && (this.tab === 'branches' || !this.canBanks)) {
      this.loadBankOptions();
    }
  }

  /** Keeps ?tab= in the URL so a refresh or shared link opens the same tab. */
  selectTab(value: string | number | undefined) {
    this.tab = String(value ?? 'banks');
    if (this.tab === 'branches') {
      this.loadBankOptions();
    }
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: this.tab === 'branches' ? 'branches' : null }, replaceUrl: true });
  }
}
