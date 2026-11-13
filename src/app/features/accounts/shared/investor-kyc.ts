/**
 * The KYC sections as staff read them: one definition shared by the investor
 * profile (Overview checklist and KYC details tab), the verification pages
 * and the completeness counts. Keys are InvestorDto display fields.
 */
export type KycFieldType = 'text' | 'date' | 'bool' | 'money' | 'image';

export interface KycField {
  label: string;
  key: string;
  type?: KycFieldType;
  /** Needed before the investor can be sent for verification. */
  required?: boolean;
  /** Only shown (and counted) when this returns true. */
  when?: (inv: any) => boolean;
}

export interface KycSection {
  id: string;
  title: string;
  fields: KycField[];
}

const isCorporate = (i: any) => i?.investorType === 'CORPORATE';
const isIndividual = (i: any) => !isCorporate(i);
const isForeigner = (i: any) => i?.residentialStatus === 'RESIDENT_FOREIGNER' || i?.residentialStatus === 'NON_RESIDENT_FOREIGNER' || !!i?.residencePermitNo;
const foreignTies = (i: any) => !!(i?.foreignCitizen || i?.hasForeignPassport || i?.hasGreenCard || i?.foreignResident);

export const KYC_SECTIONS: KycSection[] = [
  {
    id: 'personal',
    title: 'Personal information',
    fields: [
      { label: 'Company name', key: 'corporateName', required: true, when: isCorporate },
      { label: 'Incorporation date', key: 'corporateIncorporationDate', type: 'date', when: isCorporate },
      { label: 'Title', key: 'titleName', when: isIndividual },
      { label: 'First name', key: 'firstName', required: true, when: isIndividual },
      { label: 'Surname', key: 'surname', required: true, when: isIndividual },
      { label: 'Other names', key: 'othernames', when: isIndividual },
      { label: 'Maiden name', key: 'maidenName', when: isIndividual },
      { label: 'Gender', key: 'genderName', when: isIndividual },
      { label: 'Date of birth', key: 'birthDate', type: 'date', required: true, when: isIndividual },
      { label: 'Place of birth', key: 'birthPlace', when: isIndividual },
      { label: 'Marital status', key: 'maritalStatusName', when: isIndividual },
      { label: 'Spouse', key: 'spouseName', when: (i) => isIndividual(i) && i?.maritalStatus === 'MARRIED' },
      { label: "Mother's maiden name", key: 'motherMaidenName', when: isIndividual },
      { label: 'Education', key: 'levelOfEducationName', when: isIndividual },
      { label: 'Nationality', key: 'nationalityName', required: true, when: isIndividual },
      { label: 'Country of incorporation', key: 'nationalityName', required: true, when: isCorporate },
      { label: 'Country of residence', key: 'residentialCountryName', required: true },
      { label: 'Residential status', key: 'residentialStatusName', when: isIndividual },
    ],
  },
  {
    id: 'identification',
    title: 'Identification',
    fields: [
      { label: 'ID type', key: 'validIdName', required: true },
      { label: 'ID number', key: 'idNumber', required: true },
      { label: 'Issue date', key: 'idIssueDate', type: 'date' },
      { label: 'Place of issue', key: 'placeOfIdIssued' },
      { label: 'Expiry date', key: 'idExpiryDate', type: 'date' },
      { label: 'TIN', key: 'tinNumber' },
      { label: 'Residence permit no.', key: 'residencePermitNo', when: isForeigner },
      { label: 'Permit issued at', key: 'residencePermitIssuedPlace', when: isForeigner },
      { label: 'Permit issue date', key: 'residencePermitIssueDate', type: 'date', when: isForeigner },
      { label: 'Permit expiry date', key: 'residencePermitExpiryDate', type: 'date', when: isForeigner },
    ],
  },
  {
    id: 'contact',
    title: 'Contact and address',
    fields: [
      { label: 'Mobile', key: 'mobilePhone', required: true },
      { label: 'Residential phone', key: 'residentialPhone' },
      { label: 'Email', key: 'emailAddress' },
      { label: 'Residential address', key: 'residentialAddress' },
      { label: 'Postal address', key: 'postalAddress' },
      { label: 'Nearest landmark', key: 'nearestLandmark' },
      { label: 'Digital address (GPS)', key: 'digitalAddressGps' },
    ],
  },
  {
    id: 'emergency',
    title: 'Emergency contact',
    fields: [
      { label: 'Name', key: 'emergencyContactName' },
      { label: 'Relationship', key: 'emergencyContactRelationshipName' },
      { label: 'Mobile', key: 'emergencyContactMobileNo' },
      { label: 'Email', key: 'emergencyContactEmail' },
    ],
  },
  {
    id: 'employment',
    title: 'Employment and income',
    fields: [
      { label: 'Employment status', key: 'employmentStatusName', when: isIndividual },
      { label: 'Occupation', key: 'occupation', when: isIndividual },
      { label: 'Employer', key: 'employerName', when: isIndividual },
      { label: 'Employer address', key: 'employerAddress', when: isIndividual },
      { label: 'Nature of business', key: 'natureOfBusiness' },
      { label: 'Employer phone', key: 'employerContactNumber', when: isIndividual },
      { label: 'Annual income', key: 'annualIncomeName' },
      { label: 'Other source of income', key: 'otherIncomeSource' },
    ],
  },
  {
    id: 'bank',
    title: 'Bank details',
    fields: [
      { label: 'Bank', key: 'bankName' },
      { label: 'Branch', key: 'bankBranchName' },
      { label: 'Account name', key: 'bankAccountName' },
      { label: 'Account number', key: 'bankAccountNumber' },
    ],
  },
  {
    id: 'investment',
    title: 'Investment profile and risk',
    fields: [
      { label: 'Investment objective', key: 'investmentObjective' },
      { label: 'Initial investment', key: 'initialInvestmentAmount', type: 'money' },
      { label: 'Source of funds', key: 'sourceOfFundsName' },
      { label: 'Investment knowledge', key: 'investmentKnowledgeName' },
      { label: 'Risk profile', key: 'investmentRiskProfileName' },
      { label: 'Horizon', key: 'investmentHorizonName' },
      { label: 'Expected activity', key: 'anticipatedInvestmentActivityName' },
      { label: 'Risk level', key: 'riskLevelName' },
      { label: 'Wants to trade', key: 'tradesText' },
      { label: 'Has a depository account', key: 'hasDepositoryAccount', type: 'bool' },
      { label: 'Existing depository no.', key: 'providedDepAccountNo', when: (i) => !!i?.hasDepositoryAccount },
      { label: 'Previous stockbroker', key: 'providedStockBroker', when: (i) => !!i?.hasDepositoryAccount },
    ],
  },
  {
    id: 'pep',
    title: 'PEP assessment',
    fields: [
      { label: 'PEP in Ghana', key: 'pepInGhana', type: 'bool' },
      { label: 'Details', key: 'pepInGhanaDetails', when: (i) => !!i?.pepInGhana },
      { label: 'PEP outside Ghana', key: 'pepOutsideGhana', type: 'bool' },
      { label: 'Details', key: 'pepOutsideGhanaDetails', when: (i) => !!i?.pepOutsideGhana },
    ],
  },
  {
    id: 'tax',
    title: 'Tax compliance (FATCA / CRS)',
    fields: [
      { label: 'Foreign citizen', key: 'foreignCitizen', type: 'bool' },
      { label: 'Foreign passport', key: 'hasForeignPassport', type: 'bool' },
      { label: 'US green card', key: 'hasGreenCard', type: 'bool' },
      { label: 'Foreign tax resident', key: 'foreignResident', type: 'bool' },
      { label: 'Name used abroad', key: 'foreignFullName', when: foreignTies },
      { label: 'Foreign residential address', key: 'foreignResidentialAddress', when: foreignTies },
      { label: 'Foreign mailing address', key: 'foreignMailingAddress', when: foreignTies },
      { label: 'Foreign phone', key: 'foreignTelephoneNumber', when: foreignTies },
      { label: 'Foreign tax ID', key: 'foreignTaxId', when: foreignTies },
    ],
  },
  {
    id: 'photo',
    title: 'Photo and signature',
    fields: [
      { label: 'Profile photo', key: 'profileImage', type: 'image' },
      { label: 'Signature', key: 'signatureImage', type: 'image' },
    ],
  },
];

/** Adds the computed display values the sections read (e.g. "Shares, fixed income"). */
export function withKycExtras(inv: any): any {
  if (!inv) return inv;
  const trades = [inv.tradeShares && 'Shares', inv.tradeFixedIncome && 'Fixed income', inv.tradeMutualFunds && 'Mutual funds'].filter(Boolean);
  return { ...inv, tradesText: trades.length ? trades.join(', ') : null };
}

export function visibleFields(inv: any, section: KycSection): KycField[] {
  return section.fields.filter((f) => !f.when || f.when(inv));
}

export function isFilled(inv: any, f: KycField): boolean {
  if (f.type === 'bool') return true;
  const v = inv?.[f.key];
  if (f.type === 'money') return typeof v === 'number' && v > 0;
  return v !== null && v !== undefined && String(v).trim() !== '';
}

export interface SectionStatus {
  id: string;
  title: string;
  filled: number;
  total: number;
  missing: number;
  requiredMissing: string[];
  /** ok | gap | required */
  state: 'ok' | 'gap' | 'required';
}

export function sectionStatus(inv: any, section: KycSection): SectionStatus {
  const fields = visibleFields(inv, section);
  const empty = fields.filter((f) => !isFilled(inv, f));
  const requiredMissing = empty.filter((f) => f.required).map((f) => f.label);
  return {
    id: section.id,
    title: section.title,
    filled: fields.length - empty.length,
    total: fields.length,
    missing: empty.length,
    requiredMissing,
    state: requiredMissing.length ? 'required' : empty.length ? 'gap' : 'ok',
  };
}

export function kycStatuses(inv: any): SectionStatus[] {
  const data = withKycExtras(inv);
  return KYC_SECTIONS.map((s) => sectionStatus(data, s));
}

/** Labels for the list/profile warning chips (InvestorAdminService.flags). */
export const FLAG_LABELS: Record<string, { label: string; tone: 'bad' | 'warn' | 'info' | 'grey' }> = {
  ID_EXPIRED: { label: 'ID expired', tone: 'bad' },
  ID_EXPIRING: { label: 'ID expiring', tone: 'warn' },
  PEP: { label: 'PEP', tone: 'warn' },
  FATCA: { label: 'FATCA', tone: 'info' },
  NO_BANK: { label: 'No bank', tone: 'warn' },
  NO_RISK_LEVEL: { label: 'No risk level', tone: 'warn' },
  LOGIN_DISABLED: { label: 'Login off', tone: 'grey' },
};

/** Investor status from the flags, as a key: VERIFIED | AWAITING_ACCOUNT | PENDING | INCOMPLETE. */
export function stageOf(inv: any): string {
  if (inv?.bioDataVerified) return inv.accountCreated ? 'VERIFIED' : 'AWAITING_ACCOUNT';
  return inv?.bioDataCompleted ? 'PENDING' : 'INCOMPLETE';
}

export const STAGE_LABELS: Record<string, { label: string; tone: string }> = {
  VERIFIED: { label: 'Verified', tone: 'ok' },
  AWAITING_ACCOUNT: { label: 'Awaiting account', tone: 'info' },
  PENDING: { label: 'Awaiting verification', tone: 'warn' },
  INCOMPLETE: { label: 'Incomplete', tone: 'bad' },
};
