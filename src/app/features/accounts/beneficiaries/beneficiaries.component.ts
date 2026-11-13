import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ApiService } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { EntityPickerComponent } from '../../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { InvestorOptionsService } from '../shared/accounts-common';
import { InvestorDetailComponent } from '../shared/investor-detail.component';

/**
 * An investor's beneficiaries and next of kin (JSF accounts/beneficiary.xhtml).
 * Pick the investor, then add, edit or delete beneficiaries. Allocations may
 * not exceed 100% in total.
 */
@Component({
  selector: 'app-beneficiaries',
  imports: [FormsModule, DecimalPipe, ButtonModule, DialogModule, InputNumberModule, InputTextModule, SelectModule, TableModule,
    PageHeaderComponent, EntityPickerComponent, InvestorDetailComponent],
  templateUrl: './beneficiaries.component.html',
  styleUrl: './beneficiaries.component.scss',
})
export class BeneficiariesComponent implements OnInit {
  private api = inject(ApiService);
  private options = inject(InvestorOptionsService);
  private notify = inject(NotifyService);

  picked: any = null;
  investor: any = null;
  rows: any[] = [];
  loading = false;
  record: any = null;
  dialogVisible = false;
  saving = false;
  relationships: any[] = [];

  async ngOnInit() {
    this.relationships = (await this.options.all())['Relationship'] || [];
  }

  get totalAllocation() {
    return this.rows.reduce((sum, r) => sum + (r.percentageAllocation || 0), 0);
  }

  async select(picked: any) {
    this.picked = picked;
    this.investor = null;
    this.rows = [];
    if (!picked) {
      return;
    }
    const response = await this.api.get(`investors/${picked.id}`);
    if (response.success) {
      this.investor = response.data;
      this.load();
    }
  }

  async load() {
    this.loading = true;
    const response = await this.api.get('beneficiaries', { investorId: this.investor.id, paginated: false });
    this.loading = false;
    if (response.success) {
      this.rows = response.data || [];
    }
  }

  create() {
    this.record = { investorId: this.investor.id, percentageAllocation: Math.max(0, 100 - this.totalAllocation) };
    this.dialogVisible = true;
  }

  edit(row: any) {
    this.record = { ...row };
    this.dialogVisible = true;
  }

  async save() {
    const r = this.record;
    if (!r.beneficiaryName?.trim() || !r.beneficiaryPhone?.trim() || r.percentageAllocation == null) {
      this.notify.warn('Name, phone and percentage allocation are required');
      return;
    }
    this.saving = true;
    const response = await this.api.save('beneficiaries', r);
    this.saving = false;
    if (response.success) {
      this.dialogVisible = false;
      this.load();
    }
  }

  async remove(row: any) {
    if (await this.notify.confirmDelete(`the beneficiary ${row.beneficiaryName}`)) {
      const response = await this.api.delete(`beneficiaries/${row.id}`);
      if (response.success) {
        this.load();
      }
    }
  }
}
