import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { statusSeverity } from './accounts-common';

type FieldType = 'text' | 'date' | 'bool' | 'money';
interface DetailField {
  label: string;
  key: string;
  type?: FieldType;
}
interface DetailGroup {
  title: string;
  fields: DetailField[];
  /** Only shown when this returns true for the investor. */
  when?: (inv: any) => boolean;
}

const PERSONAL: DetailGroup = {
  title: 'Personal',
  fields: [
    { label: 'Investor Type', key: 'investorTypeName' },
    { label: 'Investor Code', key: 'investorCode' },
    { label: 'Title', key: 'titleName' },
    { label: 'Surname', key: 'surname' },
    { label: 'First Name', key: 'firstName' },
    { label: 'Other Names', key: 'othernames' },
    { label: 'Corporate Name', key: 'corporateName' },
    { label: 'Incorporation Date', key: 'corporateIncorporationDate', type: 'date' },
    { label: 'Birth Date', key: 'birthDate', type: 'date' },
    { label: 'Gender', key: 'genderName' },
    { label: 'Marital Status', key: 'maritalStatusName' },
    { label: "Mother's Maiden Name", key: 'motherMaidenName' },
    { label: 'Nationality', key: 'nationalityName' },
    { label: 'Education Level', key: 'levelOfEducationName' },
  ],
};
const CONTACT: DetailGroup = {
  title: 'Contact & Address',
  fields: [
    { label: 'Email', key: 'emailAddress' },
    { label: 'Mobile', key: 'mobilePhone' },
    { label: 'Residential Phone', key: 'residentialPhone' },
    { label: 'Residential Country', key: 'residentialCountryName' },
    { label: 'Residential Status', key: 'residentialStatusName' },
    { label: 'Postal Address', key: 'postalAddress' },
    { label: 'Residential Address', key: 'residentialAddress' },
  ],
};
const IDENTIFICATION: DetailGroup = {
  title: 'Identification',
  fields: [
    { label: 'ID Type', key: 'validIdName' },
    { label: 'ID Number', key: 'idNumber' },
    { label: 'Passport Number', key: 'passportNumber' },
    { label: 'Issue Date', key: 'idIssueDate', type: 'date' },
    { label: 'Place of Issue', key: 'placeOfIdIssued' },
    { label: 'Expiry Date', key: 'idExpiryDate', type: 'date' },
  ],
};
const EMPLOYMENT: DetailGroup = {
  title: 'Employment & Financial',
  fields: [
    { label: 'Occupation', key: 'occupation' },
    { label: 'Employer', key: 'employerName' },
    { label: 'Annual Income', key: 'annualIncomeName' },
    { label: 'Other Income Source', key: 'otherIncomeSource' },
    { label: 'Risk Level', key: 'riskLevelName' },
  ],
};
const ALERTS: DetailGroup = {
  title: 'Alerts',
  fields: [
    { label: 'SMS Alert', key: 'enableSmsAlert', type: 'bool' },
    { label: 'Email Alert', key: 'enableEmailAlert', type: 'bool' },
    { label: 'Purchase Alert', key: 'purchaseAlert', type: 'bool' },
    { label: 'Sales Alert', key: 'salesAlert', type: 'bool' },
    { label: 'Cash Transaction Alert', key: 'cashTransactionAlert', type: 'bool' },
  ],
};
const VERIFICATION: DetailGroup = {
  title: 'Verification',
  fields: [
    { label: 'Status', key: 'status' },
    { label: 'Registration Date', key: 'registrationDate', type: 'date' },
    { label: 'Verified Date', key: 'verifiedDate', type: 'date' },
    { label: 'Verified By', key: 'verifiedBy' },
    { label: 'Bio Data Completed', key: 'bioDataCompleted', type: 'bool' },
    { label: 'Bio Data Verified', key: 'bioDataVerified', type: 'bool' },
    { label: 'Account Created', key: 'accountCreated', type: 'bool' },
    { label: 'Portal Login Enabled', key: 'active', type: 'bool' },
    { label: 'Depository Account No', key: 'depAccountNo' },
  ],
};

/** Every KYC panel shown on the JSF verification page. */
const FULL: DetailGroup[] = [
  {
    title: 'Applicant Information',
    fields: [
      ...PERSONAL.fields,
      { label: 'Maiden Name', key: 'maidenName' },
      { label: 'Birth Place', key: 'birthPlace' },
      { label: 'Spouse Name', key: 'spouseName' },
      { label: 'Occupation', key: 'occupation' },
      { label: 'Residential Country', key: 'residentialCountryName' },
      { label: 'Residential Status', key: 'residentialStatusName' },
    ],
  },
  {
    title: 'Resident Foreigner Details',
    when: (i) => !!(i.residencePermitNo || i.residencePermitIssuedPlace),
    fields: [
      { label: 'Residence Permit No', key: 'residencePermitNo' },
      { label: 'Issued Place', key: 'residencePermitIssuedPlace' },
      { label: 'Issue Date', key: 'residencePermitIssueDate', type: 'date' },
      { label: 'Expiry Date', key: 'residencePermitExpiryDate', type: 'date' },
    ],
  },
  {
    title: 'Proof of Identity and Address',
    fields: [
      ...IDENTIFICATION.fields,
      { label: 'Postal Address', key: 'postalAddress' },
      { label: 'Residential Address', key: 'residentialAddress' },
      { label: 'Nearest Landmark', key: 'nearestLandmark' },
      { label: 'Digital Address (GPS)', key: 'digitalAddressGps' },
      { label: 'Mobile', key: 'mobilePhone' },
      { label: 'Residential Phone', key: 'residentialPhone' },
      { label: 'Email', key: 'emailAddress' },
    ],
  },
  {
    title: 'Emergency Contact',
    fields: [
      { label: 'Name', key: 'emergencyContactName' },
      { label: 'Mobile', key: 'emergencyContactMobileNo' },
      { label: 'Email', key: 'emergencyContactEmail' },
      { label: 'Relationship', key: 'emergencyContactRelationshipName' },
    ],
  },
  {
    title: 'Financial Profile',
    fields: [
      { label: 'Bank', key: 'bankName' },
      { label: 'Branch', key: 'bankBranchName' },
      { label: 'Account Name', key: 'bankAccountName' },
      { label: 'Account Number', key: 'bankAccountNumber' },
    ],
  },
  {
    title: 'Employment Details',
    fields: [
      { label: 'Employment Status', key: 'employmentStatusName' },
      { label: 'Employer', key: 'employerName' },
      { label: 'Employer Address', key: 'employerAddress' },
      { label: 'Nature of Business', key: 'natureOfBusiness' },
      { label: 'Employer Contact', key: 'employerContactNumber' },
      { label: 'Annual Income', key: 'annualIncomeName' },
    ],
  },
  {
    title: 'Client Investment Profile',
    fields: [
      { label: 'Investment Objective', key: 'investmentObjective' },
      { label: 'Initial Investment', key: 'initialInvestmentAmount', type: 'money' },
      { label: 'Investment Knowledge', key: 'investmentKnowledgeName' },
      { label: 'Risk Profile', key: 'investmentRiskProfileName' },
      { label: 'Investment Horizon', key: 'investmentHorizonName' },
      { label: 'Anticipated Activity', key: 'anticipatedInvestmentActivityName' },
      { label: 'Source of Funds', key: 'sourceOfFundsName' },
      { label: 'Other Income Source', key: 'otherIncomeSource' },
      { label: 'Risk Level', key: 'riskLevelName' },
    ],
  },
  {
    title: 'Beneficiary / Next of Kin',
    fields: [
      { label: 'Name', key: 'beneficiaryName' },
      { label: 'Relationship', key: 'beneficiaryRelationshipName' },
      { label: 'Mobile', key: 'beneficiaryMobileNo' },
      { label: 'Email', key: 'beneficiaryEmail' },
      { label: 'ID Number', key: 'beneficiaryIdNumber' },
      { label: 'Birth Date', key: 'beneficiaryBirthDate', type: 'date' },
    ],
  },
  {
    title: 'PEP Assessment',
    fields: [
      { label: 'PEP in Ghana', key: 'pepInGhana', type: 'bool' },
      { label: 'Details', key: 'pepInGhanaDetails' },
      { label: 'PEP outside Ghana', key: 'pepOutsideGhana', type: 'bool' },
      { label: 'Details', key: 'pepOutsideGhanaDetails' },
    ],
  },
  {
    title: 'Tax Compliance (FATCA / CRS)',
    fields: [
      { label: 'TIN', key: 'tinNumber' },
      { label: 'Foreign Citizen', key: 'foreignCitizen', type: 'bool' },
      { label: 'Foreign Passport', key: 'hasForeignPassport', type: 'bool' },
      { label: 'Green Card', key: 'hasGreenCard', type: 'bool' },
      { label: 'Foreign Resident', key: 'foreignResident', type: 'bool' },
      { label: 'Foreign Full Name', key: 'foreignFullName' },
      { label: 'Foreign Residential Address', key: 'foreignResidentialAddress' },
      { label: 'Foreign Mailing Address', key: 'foreignMailingAddress' },
      { label: 'Foreign Phone', key: 'foreignTelephoneNumber' },
      { label: 'Foreign Tax ID', key: 'foreignTaxId' },
    ],
  },
  { title: 'Others', fields: [{ label: 'Investor Name', key: 'investorName' }, ...VERIFICATION.fields, ...ALERTS.fields] },
];

/** The 15-field summary the beneficiary and risk-assessment pages showed. */
const SUMMARY: DetailGroup[] = [
  {
    title: '',
    fields: [
      { label: 'Surname', key: 'surname' },
      { label: 'Other Names', key: 'othernames' },
      { label: 'Email', key: 'emailAddress' },
      { label: 'Registration Date', key: 'registrationDate', type: 'date' },
      { label: 'Birth Date', key: 'birthDate', type: 'date' },
      { label: 'Verified Date', key: 'verifiedDate', type: 'date' },
      { label: 'Gender', key: 'genderName' },
      { label: 'Marital Status', key: 'maritalStatusName' },
      { label: 'Postal Address', key: 'postalAddress' },
      { label: 'Residential Address', key: 'residentialAddress' },
      { label: 'Annual Income', key: 'annualIncomeName' },
      { label: 'Mobile', key: 'mobilePhone' },
      { label: 'Residential Phone', key: 'residentialPhone' },
      { label: 'Nationality', key: 'nationalityName' },
      { label: 'Risk Level', key: 'riskLevelName' },
    ],
  },
];

/**
 * Read-only investor detail, replacing <brokerage:investor>.
 *  mode="card"    six groups (row expansion, upload preview)
 *  mode="full"    every KYC panel (verification page)
 *  mode="summary" the short summary on beneficiary / risk pages
 */
@Component({
  selector: 'app-investor-detail',
  imports: [DatePipe, DecimalPipe, TagModule],
  templateUrl: './investor-detail.component.html',
  styleUrl: './investor-detail.component.scss',
})
export class InvestorDetailComponent {
  @Input() investor: any = null;
  @Input() mode: 'card' | 'full' | 'summary' = 'card';
  @Input() showHeader = false;

  get groups(): DetailGroup[] {
    if (this.mode === 'full') {
      return FULL;
    }
    if (this.mode === 'summary') {
      return SUMMARY;
    }
    return [PERSONAL, CONTACT, IDENTIFICATION, EMPLOYMENT, ALERTS, VERIFICATION];
  }

  severity(style: string) {
    return statusSeverity(style);
  }
}
