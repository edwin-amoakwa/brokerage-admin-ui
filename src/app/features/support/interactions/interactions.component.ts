import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ApiService, isoDate, today } from '../../../core/api.service';
import { pageParams } from '../../../core/api-response';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { EntityPickerComponent } from '../../../shared/entity-picker/entity-picker.component';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { nowLocal } from '../support-ui';

/**
 * Client contact log (JSF support/interactions.xhtml): calls, emails,
 * meetings and visits, optionally linked to one of the client's cases.
 */
@Component({
  selector: 'app-interactions',
  imports: [FormsModule, DatePipe, ButtonModule, DialogModule, InputTextModule, SelectModule, TableModule, TextareaModule, EntityPickerComponent, PageHeaderComponent],
  templateUrl: './interactions.component.html',
  styleUrl: './interactions.component.scss',
})
export class InteractionsComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);

  fromDate = isoDate(new Date(new Date().setMonth(new Date().getMonth() - 1)));
  toDate = today();
  filterType: string | null = null;
  keyword = '';
  rows: any[] = [];
  total = 0;
  first = 0;
  loading = false;
  types: any[] = [];
  directions: any[] = [];

  dialogVisible = false;
  saving = false;
  record: any = null;
  investor: any = null;
  caseOptions: any[] = [];
  private lastEvent: any = { first: 0, rows: 15 };

  async ngOnInit() {
    [this.types, this.directions] = await Promise.all([this.lookups.enum('InteractionType'), this.lookups.enum('InteractionDirection')]);
  }

  reload() {
    this.first = 0;
    this.load({ ...this.lastEvent, first: 0 });
  }

  async load(event: any) {
    this.lastEvent = event;
    this.loading = true;
    const response = await this.api.get('client-interactions', {
      fromDate: this.fromDate,
      toDate: this.toDate,
      interactionType: this.filterType,
      keyword: this.keyword,
      ...pageParams(event, 15),
    });
    this.loading = false;
    if (response.success) {
      this.rows = response.data || [];
      this.total = response.pager?.totalRecords ?? this.rows.length;
    }
  }

  create() {
    this.record = { interactionType: 'CALL', direction: 'INBOUND', occurredAt: nowLocal(), supportCaseId: null };
    this.investor = null;
    this.caseOptions = [];
    this.dialogVisible = true;
  }

  edit(row: any) {
    this.record = { ...row, occurredAt: row.occurredAt ? String(row.occurredAt).substring(0, 16) : nowLocal() };
    this.investor = { id: row.investorId, displayName: row.investorName, investorCode: row.investorCode, emailAddress: row.investorEmail };
    this.loadCases();
    this.dialogVisible = true;
  }

  pickInvestor(investor: any) {
    this.investor = investor;
    this.record.supportCaseId = null;
    this.caseOptions = [];
    this.loadCases();
  }

  private async loadCases() {
    if (!this.investor?.id) {
      return;
    }
    const response = await this.api.get('client-interactions/case-options', { investorId: this.investor.id });
    if (response.success) {
      this.caseOptions = response.data || [];
    }
  }

  async save() {
    if (!this.investor) {
      this.notify.warn('Select the client this contact was with.', 'Required');
      return;
    }
    if (!this.record.interactionType || !this.record.occurredAt || !this.record.subject?.trim()) {
      this.notify.warn('Kind, when and subject are required.', 'Required');
      return;
    }
    const occurredAt = this.record.occurredAt.length === 16 ? `${this.record.occurredAt}:00` : this.record.occurredAt;
    this.saving = true;
    const response = await this.api.save('client-interactions', { ...this.record, occurredAt, investorId: this.investor.id });
    this.saving = false;
    if (response.success) {
      this.dialogVisible = false;
      this.load(this.lastEvent);
    }
  }

  async remove(row: any) {
    if (await this.notify.confirmDelete(`the contact "${row.subject}"`)) {
      const response = await this.api.delete(`client-interactions/${row.id}`);
      if (response.success) {
        this.load(this.lastEvent);
      }
    }
  }
}
