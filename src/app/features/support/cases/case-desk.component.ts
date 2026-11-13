import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ApiService, readFileAsUpload } from '../../../core/api.service';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { downloadBase64, prioritySeverity, slaColor, statusSeverity } from '../support-ui';

/**
 * The case desk (JSF support/cases.xhtml "desk" view): work one case.
 * Each action is its own POST and returns the refreshed desk; the server
 * decides which actions apply (canAcknowledge, canClose, ...).
 */
@Component({
  selector: 'app-case-desk',
  imports: [FormsModule, DatePipe, DecimalPipe, ButtonModule, InputNumberModule, InputTextModule, SelectModule, TagModule, TextareaModule, PageHeaderComponent],
  templateUrl: './case-desk.component.html',
  styleUrl: './case-desk.component.scss',
})
export class CaseDeskComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private notify = inject(NotifyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  sev = { priority: prioritySeverity, status: statusSeverity, sla: slaColor };
  id = '';
  desk: any = null;
  busy = false;
  actionNote = '';
  resolving = false;
  resolution: any = {};
  reply: any = { body: '', visibility: 'CLIENT', channel: 'PORTAL' };
  file: File | null = null;
  routing: any = {};

  users: any[] = [];
  teams: any[] = [];
  categories: any[] = [];
  priorities: any[] = [];
  channels: any[] = [];
  visibilities: any[] = [];
  resolutionCodes: any[] = [];

  get c() {
    return this.desk?.supportCase;
  }

  async ngOnInit() {
    this.route.paramMap.subscribe((p) => {
      this.id = p.get('id') || '';
      this.load();
    });
    [this.users, this.teams, this.categories, this.priorities, this.channels, this.visibilities, this.resolutionCodes] = await Promise.all([
      this.lookups.list('users'),
      this.lookups.list('case-teams'),
      this.lookups.list('case-categories'),
      this.lookups.enum('CasePriority'),
      this.lookups.enum('CaseChannel'),
      this.lookups.enum('CaseVisibility'),
      this.lookups.enum('CaseResolutionCode'),
    ]);
  }

  async load() {
    const response = await this.api.get(`support-cases/${this.id}`);
    if (response.success) {
      this.show(response.data);
    }
  }

  private show(desk: any) {
    this.desk = desk;
    const c = desk.supportCase;
    this.routing = { ownerId: c.ownerId, teamId: c.teamId, categoryId: c.categoryId, priority: c.priority };
    if (!c.open) {
      this.resolving = false;
    }
  }

  private async post(action: string, body: any = {}): Promise<boolean> {
    this.busy = true;
    const response = await this.api.post(`support-cases/${this.id}/${action}`, body);
    this.busy = false;
    if (response.success) {
      this.show(response.data);
    }
    return response.success;
  }

  async act(action: string, withNote = false) {
    if (await this.post(action, withNote ? { note: this.actionNote } : {})) {
      this.actionNote = '';
    }
  }

  async escalate() {
    if (await this.notify.confirm('Escalate this case? It moves to the escalation team of its category.', 'Escalate', 'Escalate')) {
      this.act('escalate', true);
    }
  }

  async closeCase() {
    if (await this.notify.confirm('Close this case? The client can no longer reply to reopen it.', 'Close case', 'Close')) {
      this.act('close', true);
    }
  }

  startResolution() {
    this.resolution = { resolutionCode: null, compensationAmount: 0, rootCause: '', remedy: '' };
    this.resolving = true;
  }

  async resolve() {
    if (!this.resolution.resolutionCode || !this.resolution.rootCause?.trim()) {
      this.notify.warn('Choose the outcome and record the root cause.', 'Required');
      return;
    }
    if (await this.post('resolve', this.resolution)) {
      this.resolving = false;
    }
  }

  fileChosen(event: any) {
    this.file = event.target?.files?.[0] || null;
    if (this.file && this.file.size > 10 * 1024 * 1024) {
      this.notify.warn('That file is over 10 MB.');
    }
  }

  async send(input: HTMLInputElement) {
    if (!this.reply.body?.trim() && !this.file) {
      this.notify.warn('Nothing to send.');
      return;
    }
    const body: any = { ...this.reply };
    if (this.file) {
      const upload = await readFileAsUpload(this.file);
      body.fileString = upload.fileString;
      body.fileName = upload.fileName;
    }
    if (await this.post('messages', body)) {
      this.reply = { body: '', visibility: 'CLIENT', channel: this.reply.channel };
      this.file = null;
      input.value = '';
    }
  }

  assign() {
    if (!this.routing.ownerId && !this.routing.teamId) {
      this.notify.warn('Choose an owner or a team.');
      return;
    }
    this.post('assign', { ownerId: this.routing.ownerId, teamId: this.routing.teamId });
  }

  reclassify() {
    this.post('reclassify', { categoryId: this.routing.categoryId, priority: this.routing.priority });
  }

  async download(a: any) {
    const response = await this.api.get(`support-cases/${this.id}/attachments/${a.id}`);
    if (response.success) {
      downloadBase64(response.data);
    }
  }

  back() {
    this.router.navigate(['/support/cases']);
  }
}
