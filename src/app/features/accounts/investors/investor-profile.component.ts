import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { PasswordModule } from 'primeng/password';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ApiService } from '../../../core/api.service';
import { NotifyService } from '../../../core/notify.service';
import { SessionService } from '../../../core/session.service';
import { FLAG_LABELS, STAGE_LABELS, SectionStatus, kycStatuses, stageOf } from '../shared/investor-kyc';
import { InvestorKycComponent } from '../shared/investor-kyc.component';
import { ImageViewerComponent } from '../shared/image-viewer.component';

type Tab = 'overview' | 'kyc' | 'accounts' | 'beneficiaries' | 'bank' | 'activity';

/**
 * Investor profile (/accounts/investors/:id): header with status, onboarding
 * progress and actions, then tabs. Overview shows accounts, contact, ID,
 * beneficiaries, KYC completeness, compliance, portal/alerts and recent
 * activity; KYC details uses the shared KYC view. Editing opens the one-page
 * investor form at the chosen section.
 */
@Component({
  selector: 'app-investor-profile',
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, ButtonModule, DialogModule, PasswordModule, ToggleSwitchModule, InvestorKycComponent, ImageViewerComponent],
  templateUrl: './investor-profile.component.html',
  styleUrls: ['../shared/investor-ui.scss', './investor-profile.component.scss'],
})
export class InvestorProfileComponent implements OnInit {
  /** The header photo is open in the zoom dialog. */
  photoOpen = false;

  private api = inject(ApiService);
  private notify = inject(NotifyService);
  private session = inject(SessionService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  id = '';
  loading = false;
  data: any = null;
  tab: Tab = 'overview';
  kyc: SectionStatus[] = [];
  togglingLogin = false;

  showPassword = false;
  password = '';
  confirmPassword = '';
  savingPassword = false;

  readonly canPassword = this.session.can('accounts.utilities');
  readonly canPortfolio = this.session.can('accounts.portfolio');
  readonly canCash = this.session.can('cash.transactions');
  readonly tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'kyc', label: 'KYC details' },
    { key: 'accounts', label: 'Accounts' },
    { key: 'beneficiaries', label: 'Beneficiaries' },
    { key: 'bank', label: 'Bank and wallets' },
    { key: 'activity', label: 'Activity' },
  ];

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    const tab = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (tab && this.tabs.some((t) => t.key === tab)) {
      this.tab = tab;
    }
    this.load();
  }

  async load() {
    this.loading = true;
    const response = await this.api.get(`investors/${this.id}/profile`);
    this.loading = false;
    if (response.success) {
      this.data = response.data;
      this.kyc = kycStatuses(this.inv);
    }
  }

  get inv(): any {
    return this.data?.investor || {};
  }

  get stage() {
    return STAGE_LABELS[stageOf(this.inv)];
  }

  get flagChips() {
    return (this.inv.flags || []).map((f: string) => FLAG_LABELS[f]).filter((f: any) => !!f);
  }

  get kycDone(): number {
    return this.kyc.filter((k) => k.state === 'ok').length;
  }

  get allocated(): number {
    return (this.data?.beneficiaries || []).reduce((t: number, b: any) => t + (b.percentageAllocation || 0), 0);
  }

  count(tab: Tab): number | null {
    if (tab === 'accounts') return this.data?.accounts?.length ?? null;
    if (tab === 'beneficiaries') return this.data?.beneficiaries?.length ?? null;
    return null;
  }

  /** The four onboarding steps with what is known about each. */
  get steps() {
    const i = this.inv;
    const principal = (this.data?.accounts || []).find((a: any) => a.role === 'Principal');
    const fmt = (d: any) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
    return [
      { label: 'Registered', done: true, note: fmt(i.registrationDate) || 'Date not recorded' },
      { label: 'KYC submitted', done: !!(i.bioDataCompleted || i.bioDataVerified), note: i.bioDataCompleted || i.bioDataVerified ? 'Sent for verification' : 'Not yet' },
      { label: 'Verified', done: !!i.bioDataVerified, note: i.bioDataVerified ? [fmt(i.verifiedDate), i.verifiedBy].filter(Boolean).join(' · ') || 'Verified' : 'Not yet' },
      { label: 'Account opened', done: !!i.accountCreated, note: i.accountCreated ? principal ? `${fmt(principal.opened)} · ${principal.accountCode}` : 'Opened' : 'Not yet' },
    ];
  }

  /** The next onboarding step's page, when the user may open it. */
  get stageAction(): { label: string; route: string } | null {
    const stage = stageOf(this.inv);
    if (stage === 'PENDING' && this.session.can('accounts.verifications')) return { label: 'Go to verification', route: '/accounts/verifications' };
    if (stage === 'AWAITING_ACCOUNT' && this.session.can('accounts.account-creation')) return { label: 'Create account', route: '/accounts/account-creation' };
    return null;
  }

  get idValidity(): { text: string; tone: string } | null {
    const flags: string[] = this.inv.flags || [];
    if (!this.inv.idExpiryDate) return null;
    if (flags.includes('ID_EXPIRED')) return { text: 'expired', tone: 'bad' };
    if (flags.includes('ID_EXPIRING')) return { text: 'expiring soon', tone: 'warn' };
    return { text: 'valid', tone: 'ok' };
  }

  get alerts() {
    const i = this.inv;
    return [
      { label: 'SMS', on: i.enableSmsAlert },
      { label: 'Email', on: i.enableEmailAlert },
      { label: 'Purchases', on: i.purchaseAlert },
      { label: 'Sales', on: i.salesAlert },
      { label: 'Cash', on: i.cashTransactionAlert },
    ];
  }

  get emergencyText(): string {
    const i = this.inv;
    return [i.emergencyContactName, i.emergencyContactRelationshipName, i.emergencyContactMobileNo].filter((v) => !!v).join(' · ');
  }

  get fatca(): boolean {
    return (this.inv.flags || []).includes('FATCA');
  }

  setTab(tab: Tab) {
    this.tab = tab;
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'overview' ? null : tab }, replaceUrl: true });
  }

  edit(section?: string) {
    this.router.navigate(['/accounts/investors', this.id, 'edit'], section ? { fragment: section } : {});
  }

  goStage() {
    const a = this.stageAction;
    if (a) this.router.navigate([a.route], { queryParams: { investorId: this.id } });
  }

  /** Saves the investor with only the portal-login switch changed (images are left as stored). */
  async toggleLogin(active: boolean) {
    this.togglingLogin = true;
    const response = await this.api.put('investors', { ...this.inv, active, profileImage: null, signatureImage: null, submitForVerification: false });
    this.togglingLogin = false;
    if (response.success) {
      this.load();
    } else {
      this.data.investor = { ...this.inv };
    }
  }

  openPassword() {
    this.password = '';
    this.confirmPassword = '';
    this.showPassword = true;
  }

  async savePassword() {
    if ((this.password || '').length < 8) {
      this.notify.warn('The password must be at least 8 characters');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.notify.warn('The passwords do not match');
      return;
    }
    this.savingPassword = true;
    const response = await this.api.put(`investor-utilities/${this.id}/password`, { password: this.password, confirmPassword: this.confirmPassword });
    this.savingPassword = false;
    if (response.success) {
      this.showPassword = false;
    }
  }
}
