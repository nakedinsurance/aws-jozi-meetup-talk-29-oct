/**
 * Enum for the final outcome of the finance application.
 */
export enum ApplicationOutcome {
  SUCCESS = 'SUCCESS',
  REJECTED = 'REJECTED',
}

/**
 * Interface for the detailed financial profile of the customer.
 */
export interface CustomerProfile {
  /** The customer's FICO or equivalent credit score. */
  creditScore: number;
  /** The customer's verified annual income in ZAR. */
  annualIncomeZar: number;
  /** The cash amount the customer is providing upfront. */
  downPaymentZar: number;
  /** The value of any trade-in vehicle applied to the purchase. */
  tradeInValueZar: number;
  /** The customer's current total monthly debt payments divided by their gross monthly income. */
  debtToIncomeRatio: number; // Stored as a decimal (e.g., 0.45 for 45%)
  /** Geographic location of the applicant (e.g., Zip Code or State). */
  applicantLocation: string;
}

/**
 * Interface for the specific vehicle being financed.
 */
export interface VehicleData {
  /** Vehicle Manufacturer (e.g., Ford, Toyota, BMW). */
  make: string;
  /** Vehicle Model (e.g., F-150, Camry, X5). */
  model: string;
  /** Model Year. */
  year: number;
  /** Manufacturer's Suggested Retail Price. */
  msrpZar: number;
  /** The final price negotiated and agreed upon for the sale. */
  salePriceZar: number;
  /** Current mileage on the vehicle at time of sale. */
  mileage: number;
  /** New or Used. */
  condition: 'New' | 'Used';
}

/**
 * Interface for the requested and final financing terms.
 */
export interface FinancingData {
  /** The total amount the customer is asking to borrow. */
  loanAmountRequestedZar: number;
  /** The proposed length of the loan in months (e.g., 60, 72, 84). */
  termLengthMonths: number;
  /** The initial Annual Percentage Rate proposed or approved. */
  annualPercentageRate: number; // Stored as a decimal (e.g., 0.059 for 5.9%)
  /** Internal ID of the lender who received the application (could be 'In-House' or an external bank name). */
  lenderId: string;
}

/**
 * Interface for the details of a rejected application.
 * Only present if outcome is 'REJECTED'.
 */
export interface RejectionDetails {
  /** The primary reason provided by the lender for the rejection. */
  reason: string;
  /** Any specific internal notes on how the deal was structured that led to the rejection. */
  internalNotes?: string;
}

/**
 * The main interface for a single car finance application record.
 */
export interface VehicleFinanceApplication {
  /** A unique identifier for the application record. */
  applicationId: string;
  /** The date the application was submitted. */
  submissionDate: string; // ISO 8601 format (e.g., 'YYYY-MM-DD')

  // Core Data Segments
  customer: CustomerProfile;
  vehicle: VehicleData;
  financing: FinancingData;

  // Outcome Data
  outcome: ApplicationOutcome;

  /**
   * Details about the rejection, only present if outcome is REJECTED.
   * This field is optional and only relevant for the rejected cases.
   */
  rejectionDetails?: RejectionDetails;
}

/**
 * The overall type for the complete dataset.
 */
export type CarDealerDataset = VehicleFinanceApplication[];
