import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ApiService, readFileAsUpload, today } from '../../../core/api.service';
import { LookupService } from '../../../core/lookup.service';
import { NotifyService } from '../../../core/notify.service';
import { InvestorOptionsService } from '../shared/accounts-common';
import { SectionStatus, kycStatuses } from '../shared/investor-kyc';

/** Edit field -> the display key the shared KYC sections read, so completeness can be counted while typing. */
const DISPLAY_KEYS: Record<string, string> = {
  titleName: 'title', genderName: 'gender', maritalStatusName: 'maritalStatus', levelOfEducationName: 'levelOfEducation',
  nationalityName: 'nationalityId', residentialCountryName: 'residentialCountryId', residentialStatusName: 'residentialStatus',
  validIdName: 'validId', emergencyContactRelationshipName: 'emergencyContactRelationship', employmentStatusName: 'employmentStatus',
  annualIncomeName: 'annualIncome', bankName: 'bankId', bankBranchName: 'bankBranchId', investmentKnowledgeName: 'investmentKnowledgeId',
  investmentRiskProfileName: 'investmentRiskProfileId', investmentHorizonName: 'investmentHorizon',
  anticipatedInvestmentActivityName: 'anticipatedInvestmentActivity', sourceOfFundsName: 'sourceOfFunds', riskLevelName: 'riskLevelId',
};

interface IndexRow {
  id: string;
  label: string;
  state: 'ok' | 'gap' | 'required' | 'todo';
  note: string;
}

/**
 * One-page investor form for adding and editing (/accounts/investors/new and
 * /:id/edit). Every KYC section is on the page with a side index showing each
 * section's state, the fields still needed before verification, a duplicate
 * check, and registration settings. "Save as incomplete" always saves; "Save
 * and send for verification" is checked on the server against the KYC
 * wizard's submit rules. Beneficiaries are saved after the investor.
 */
@Component({
  selector: 'app-investor-form',
  imports: [DatePipe, NgTemplateOutlet, FormsModule, RouterLink, ButtonModule, CheckboxModule, InputNumberModule, InputTextModule, RadioButtonModule, SelectModule, TextareaModule],
  templateUrl: './investor-form.component.html',
  styleUrls: ['../shared/investor-ui.scss', './investor-form.component.scss'],
})
export class InvestorFormComponent implements OnInit {
  private api = inject(ApiService);
  private lookups = inject(LookupService);
  private options = inject(InvestorOptionsService);
  private notify = inject(NotifyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  id: string | null = null;
  record: any = null;

  /**
   * True once NIA has verified the investor's Ghana Card. What came from the
   * card (name, date of birth, gender, ID details) is then read-only here; the
   * server ignores changes to those fields as well.
   */
  get idLocked(): boolean {
    return !!this.record?.idVerified;
  }
  loading = true;
  saving = false;
  newImage: string | null = null;
  newSignature: string | null = null;

  beneficiaries: any[] = [];
  private originalBeneficiaries: any[] = [];
  duplicates: any[] = [];

  opt: Record<string, any[]> = {};
  countries: any[] = [];
  riskLevels: any[] = [];
  banks: any[] = [];
  branches: any[] = [];

  async ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id');
    const [common, education, residential, income, employment, horizon, activity, funds, countries, riskLevels, banks] = await Promise.all([
      this.options.all(),
      this.lookups.enum('Education'),
      this.lookups.enum('ResidentialStatus'),
      this.lookups.enum('AnnualIncome'),
      this.lookups.enum('EmploymentStatus'),
      this.lookups.enum('InvestmentHorizon'),
      this.lookups.enum('AnticipatedInvestmentActivity'),
      this.lookups.enum('SourceOfFunds'),
      this.lookups.list('countries'),
      this.lookups.list('risk-levels'),
      this.lookups.list('banks'),
    ]);
    this.opt = {
      ...common, Education: education, ResidentialStatus: residential, AnnualIncome: income, EmploymentStatus: employment,
      InvestmentHorizon: horizon, AnticipatedInvestmentActivity: activity, SourceOfFunds: funds,
    };
    this.countries = countries;
    this.riskLevels = riskLevels;
    this.banks = banks;

    if (this.id) {
      const [investor, bens] = await Promise.all([
        this.api.get(`investors/${this.id}`),
        this.api.get('beneficiaries', { investorId: this.id, paginated: false }),
      ]);
      if (!investor.success) {
        this.loading = false;
        return;
      }
      this.record = { ...investor.data };
      this.beneficiaries = (bens.success ? bens.data || [] : []).map((b: any) => ({ ...b }));
      this.originalBeneficiaries = this.beneficiaries.map((b) => ({ ...b }));
      if (this.record.bankId) {
        this.branches = await this.lookups.list('bank-branches', this.record.bankId);
      }
    } else {
      this.record = {
        investorType: 'INDIVIDUAL', registrationDate: today(), active: true,
        enableSmsAlert: true, enableEmailAlert: true, purchaseAlert: true, salesAlert: true, cashTransactionAlert: true,
      };
    }
    this.loading = false;
    const fragment = this.route.snapshot.fragment;
    if (fragment) {
      setTimeout(() => this.jump(fragment), 50);
    }
  }

  get isCorporate(): boolean {
    return this.record?.investorType === 'CORPORATE';
  }

  get isForeigner(): boolean {
    const s = this.record?.residentialStatus;
    return s === 'RESIDENT_FOREIGNER' || s === 'NON_RESIDENT_FOREIGNER';
  }

  get foreignTies(): boolean {
    const r = this.record || {};
    return !!(r.foreignCitizen || r.hasForeignPassport || r.hasGreenCard || r.foreignResident);
  }

  /** Already sent for verification (or verified): the form only saves changes. */
  get submitted(): boolean {
    return !!(this.record?.bioDataCompleted || this.record?.bioDataVerified);
  }

  get title(): string {
    return this.id ? `Edit ${this.record?.displayName || 'investor'}` : 'Add investor';
  }

  /** The record shaped like an InvestorDto read, for the shared completeness rules. */
  private get displayView(): any {
    const r: any = { ...this.record };
    for (const [display, edit] of Object.entries(DISPLAY_KEYS)) {
      r[display] = this.record?.[edit] || null;
    }
    r.profileImage = this.newImage || this.record?.profileImage || null;
    r.signatureImage = this.newSignature || this.record?.signatureImage || null;
    return r;
  }

  get statuses(): SectionStatus[] {
    return this.record ? kycStatuses(this.displayView) : [];
  }

  get allocated(): number {
    return this.beneficiaries.reduce((t, b) => t + (Number(b.percentageAllocation) || 0), 0);
  }

  get index(): IndexRow[] {
    const rows: IndexRow[] = [{ id: 'type', label: 'Investor type', state: this.record?.investorType ? 'ok' : 'required', note: '' }];
    for (const s of this.statuses) {
      if (s.id === 'photo') continue;
      rows.push({
        id: s.id,
        label: s.title,
        state: s.state,
        note: s.requiredMissing.length ? `${s.requiredMissing.length} required` : s.missing ? `${s.missing} empty` : '',
      });
      if (s.id === 'investment') {
        const a = this.allocated;
        rows.push({
          id: 'beneficiaries', label: 'Beneficiaries',
          state: !this.beneficiaries.length ? 'todo' : a === 100 ? 'ok' : 'gap',
          note: !this.beneficiaries.length ? 'None' : a === 100 ? '' : `${a}%`,
        });
      }
    }
    const photo = this.statuses.find((s) => s.id === 'photo');
    rows.push({ id: 'photo', label: 'Photo and signature', state: photo?.missing ? 'todo' : 'ok', note: photo?.missing ? `${photo.missing} not added` : '' });
    return rows;
  }

  get requiredMissing(): { section: string; label: string }[] {
    const list: { section: string; label: string }[] = [];
    for (const s of this.statuses) {
      for (const label of s.requiredMissing) list.push({ section: s.id, label });
    }
    return list;
  }

  get completeCount(): number {
    return this.index.filter((r) => r.state === 'ok').length;
  }

  jump(id: string, event?: Event) {
    event?.preventDefault();
    document.getElementById('sec-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async bankChanged() {
    this.record.bankBranchId = null;
    this.branches = this.record.bankId ? await this.lookups.list('bank-branches', this.record.bankId) : [];
  }

  async pickImage(event: any, kind: 'photo' | 'signature') {
    const file: File | undefined = event.target?.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.notify.warn('The image must not be larger than 5 MB');
      event.target.value = '';
      return;
    }
    const data = (await readFileAsUpload(file)).fileString;
    if (kind === 'photo') this.newImage = data;
    else this.newSignature = data;
  }

  /** Looks for investors with the same email, mobile, ID number, or surname and birth date. */
  async checkDuplicates() {
    const r = this.record;
    if (!r.emailAddress && !r.mobilePhone && !r.idNumber && !(r.surname && r.birthDate)) {
      this.duplicates = [];
      return;
    }
    const response = await this.api.get('investors/duplicates', {
      id: this.id, email: r.emailAddress, mobile: r.mobilePhone, idNumber: r.idNumber,
      surname: this.isCorporate ? null : r.surname, birthDate: this.isCorporate ? null : r.birthDate,
    });
    this.duplicates = response.success ? response.data || [] : [];
  }

  addBeneficiary() {
    const remaining = Math.max(0, 100 - this.allocated);
    this.beneficiaries.push({ beneficiaryName: '', relationship: null, beneficiaryPhone: '', beneficiaryEmail: '', percentageAllocation: remaining });
  }

  removeBeneficiary(index: number) {
    this.beneficiaries.splice(index, 1);
  }

  async save(submit: boolean) {
    const r = this.record;
    if (this.isCorporate ? !r.corporateName?.trim() : !r.firstName?.trim() || !r.surname?.trim()) {
      this.notify.warn(this.isCorporate ? 'Enter the company name' : 'Enter the first name and surname');
      this.jump('personal');
      return;
    }
    const bad = this.beneficiaries.find((b) => !b.beneficiaryName?.trim() || !b.beneficiaryPhone?.trim());
    if (bad) {
      this.notify.warn('Each beneficiary needs a name and phone number');
      this.jump('beneficiaries');
      return;
    }
    if (this.allocated > 100) {
      this.notify.warn('Beneficiary shares add up to more than 100%');
      this.jump('beneficiaries');
      return;
    }
    if (submit && this.requiredMissing.length) {
      this.notify.warn('Fill in the required fields before sending for verification');
      this.jump(this.requiredMissing[0].section);
      return;
    }

    this.saving = true;
    const response = await this.api.save('investors', {
      ...r,
      profileImage: this.newImage,
      signatureImage: this.newSignature,
      submitForVerification: submit,
    });
    if (!response.success) {
      this.saving = false;
      return;
    }
    const investorId = response.data.id;
    const ok = await this.saveBeneficiaries(investorId);
    this.saving = false;
    if (ok) {
      this.router.navigate(['/accounts/investors', investorId]);
    } else {
      // The investor is saved; stay on the form (now in edit mode) so the beneficiaries can be corrected.
      this.router.navigate(['/accounts/investors', investorId, 'edit'], { replaceUrl: true, fragment: 'beneficiaries' });
    }
  }

  /**
   * Removed rows are deleted first, then shrinking shares, then growing ones,
   * then new rows, so the server's "total at most 100%" check holds at every step.
   */
  private async saveBeneficiaries(investorId: string): Promise<boolean> {
    const keptIds = new Set(this.beneficiaries.filter((b) => b.id).map((b) => b.id));
    for (const old of this.originalBeneficiaries) {
      if (!keptIds.has(old.id)) {
        const res = await this.api.deleteSilent(`beneficiaries/${old.id}`);
        if (!res.success) return false;
      }
    }
    const before = new Map(this.originalBeneficiaries.map((b) => [b.id, b]));
    const changed = this.beneficiaries
      .filter((b) => b.id)
      .filter((b) => {
        const o: any = before.get(b.id) || {};
        return ['beneficiaryName', 'relationship', 'beneficiaryPhone', 'beneficiaryEmail', 'percentageAllocation'].some((k) => (o[k] ?? '') !== (b[k] ?? ''));
      })
      .sort((a, b) => (Number(a.percentageAllocation) - Number((before.get(a.id) as any)?.percentageAllocation || 0))
        - (Number(b.percentageAllocation) - Number((before.get(b.id) as any)?.percentageAllocation || 0)));
    for (const b of [...changed, ...this.beneficiaries.filter((x) => !x.id)]) {
      const res = await this.api.saveSilent('beneficiaries', { ...b, investorId, percentageAllocation: Number(b.percentageAllocation) || 0 });
      if (!res.success) return false;
    }
    return true;
  }
}
