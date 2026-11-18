import { DatePipe } from '@angular/common';
import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { ApiService } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { PageHeaderComponent } from '../../../shared/page-header/page-header.component';
import { InvestorKycComponent } from '../shared/investor-kyc.component';
import { InvestorTableComponent } from '../shared/investor-table.component';
import { ChannelPickerComponent, reachableChannels } from '../shared/channel-picker.component';
import { InvestorMessagesComponent } from '../shared/investor-messages.component';
import { CORRECTION_PRESETS, MAX_MESSAGE, appendPreset } from '../shared/investor-messages';

/**
 * KYC verification queue (JSF accounts/investor-verification.xhtml): review a
 * completed registration and mark the investor verified ("Verify for Account Creation"). The investor is sent the
 * verification-completed message and moves to the Account Creation page.
 * "Return for correction" instead sends the registration back to the investor
 * with what to fix; "Message investor" sends a free-text message. Both show in
 * the Messages card with per-channel delivery status.
 */
@Component({
  selector: 'app-verifications',
  imports: [DatePipe, FormsModule, RouterLink, ButtonModule, DialogModule, TextareaModule, PageHeaderComponent,
    InvestorTableComponent, InvestorKycComponent, ChannelPickerComponent, InvestorMessagesComponent],
  templateUrl: './verifications.component.html',
  styleUrl: './verifications.component.scss',
})
export class VerificationsComponent implements OnInit {
  private api = inject(ApiService);
  private notify = inject(NotifyService);
  private route = inject(ActivatedRoute);

  @ViewChild('table') table?: InvestorTableComponent;
  @ViewChild('messages') messages?: InvestorMessagesComponent;

  readonly presets = CORRECTION_PRESETS;
  readonly maxMessage = MAX_MESSAGE;

  investor: any = null;
  verifying = false;

  returning = false;
  sendingReturn = false;
  returnForm = { message: '', channels: [] as string[] };

  /** Deep link from the Accounts Dashboard work queue: ?investorId= opens that investor. */
  ngOnInit() {
    const investorId = this.route.snapshot.queryParamMap.get('investorId');
    if (investorId) {
      this.open({ id: investorId });
    }
  }

  async open(row: any) {
    const response = await this.api.get(`investors/${row.id}`);
    if (response.success) {
      this.investor = response.data;
    }
  }

  close() {
    this.investor = null;
  }

  async verify() {
    const message = `Verify ${this.investor.displayName} for account creation? They will be told their verification is complete.`;
    if (!(await this.notify.confirm(message, 'Verify for account creation', 'Verify'))) {
      return;
    }
    this.verifying = true;
    const response = await this.api.post(`investor-verifications/${this.investor.id}/verify`, {});
    this.verifying = false;
    if (response.success) {
      this.investor = response.data;
      this.messages?.reload();
    }
  }

  /** Still in this queue: completed, not verified (false once returned for correction). */
  get awaitingReview(): boolean {
    return !!this.investor?.bioDataCompleted && !this.investor?.bioDataVerified;
  }

  get canReturn(): boolean {
    return this.awaitingReview && reachableChannels(this.investor).length > 0;
  }

  openReturn() {
    this.returnForm = { message: '', channels: reachableChannels(this.investor) };
    this.returning = true;
  }

  addPreset(text: string) {
    this.returnForm.message = appendPreset(this.returnForm.message, text);
  }

  get canSendReturn(): boolean {
    return !!this.returnForm.message.trim() && this.returnForm.channels.length > 0;
  }

  async sendReturn() {
    if (!this.canSendReturn) {
      return;
    }
    this.sendingReturn = true;
    const response = await this.api.post(`investor-verifications/${this.investor.id}/return`, this.returnForm);
    this.sendingReturn = false;
    if (response.success) {
      this.investor = response.data;
      this.returning = false;
      this.messages?.reload();
    }
  }
}
