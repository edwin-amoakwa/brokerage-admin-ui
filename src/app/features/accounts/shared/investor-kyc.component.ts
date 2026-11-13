import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KYC_SECTIONS, KycField, KycSection, SectionStatus, STAGE_LABELS, isFilled, sectionStatus, stageOf, visibleFields, withKycExtras } from './investor-kyc';

interface SectionView {
  section: KycSection;
  status: SectionStatus;
  fields: { field: KycField; filled: boolean; value: any }[];
}

/**
 * The investor's KYC as staff review it: one card per section, every field
 * shown, empty ones as "Not provided" with a count per section, and an
 * "Only gaps" switch. Used on the profile's KYC tab and the verification and
 * account-creation pages. (edit) fires with a section id when editing is offered.
 */
@Component({
  selector: 'app-investor-kyc',
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: './investor-kyc.component.html',
  styleUrls: ['./investor-ui.scss', './investor-kyc.component.scss'],
})
export class InvestorKycComponent implements OnChanges {
  @Input() investor: any;
  /** Header with photo, name and status (the verification pages). */
  @Input() showHeader = false;
  /** Show an Edit button on each section. */
  @Input() editable = false;
  @Output() edit = new EventEmitter<string>();

  onlyGaps = false;
  views: SectionView[] = [];

  ngOnChanges() {
    const inv = withKycExtras(this.investor);
    this.views = KYC_SECTIONS.map((section) => ({
      section,
      status: sectionStatus(inv, section),
      fields: visibleFields(inv, section).map((field) => ({ field, filled: isFilled(inv, field), value: inv?.[field.key] })),
    })).filter((v) => v.fields.length > 0);
  }

  get shown(): SectionView[] {
    return this.onlyGaps ? this.views.filter((v) => v.status.missing > 0) : this.views;
  }

  get stage() {
    return STAGE_LABELS[stageOf(this.investor)];
  }

  scrollTo(id: string, event: Event) {
    event.preventDefault();
    document.getElementById('kyc-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
