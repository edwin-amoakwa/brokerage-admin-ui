/** Limits mirrored from InvestorMessageService (server enforces them too). */
export const MAX_SUBJECT = 200;
export const MAX_MESSAGE = 1000;

/** One SMS segment; longer texts are sent as several. The SMS wording adds a short prefix around the message. */
export const SMS_SEGMENT = 160;

/**
 * Common KYC problems a reviewer can drop into a "Return for correction" (or a
 * message) with one click. Each is a full sentence so several can be combined.
 */
export const CORRECTION_PRESETS: { label: string; text: string }[] = [
  { label: 'ID unclear', text: 'The photo of your ID document is unclear or cut off. Please upload a clear photo showing all four corners.' },
  { label: 'ID expired', text: 'Your ID document has expired. Please upload a valid ID.' },
  { label: 'Name mismatch', text: 'The name on your profile does not match your ID document. Please correct your name to match your ID exactly.' },
  { label: 'Date of birth', text: 'Your date of birth does not match your ID document. Please correct it.' },
  { label: 'Selfie / photo', text: 'Please upload a clear, recent photo of yourself (face fully visible, no sunglasses or hat).' },
  { label: 'Proof of address', text: 'Please provide your residential address and upload a recent proof of address (utility bill or bank statement from the last three months).' },
  { label: 'Bank details', text: 'Your bank account details are incomplete or could not be confirmed. Please check the account name and number.' },
  { label: 'Next of kin', text: 'Please complete your next of kin details (full name, relationship and phone number).' },
  { label: 'Tax / TIN', text: 'Please provide a valid Ghana Card or Tax Identification Number (TIN).' },
];

/** Adds a preset sentence to a text on its own line, unless it is already there. */
export function appendPreset(current: string, text: string): string {
  const value = current || '';
  if (value.includes(text)) {
    return value;
  }
  return value.trim() ? `${value.trimEnd()}\n${text}` : text;
}
