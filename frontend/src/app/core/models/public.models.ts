export type PublicReportType = 'annual' | 'impact' | 'financial';

export interface PublicInfoPayload {
  organization: {
    name: string;
    fullName: string;
    tagline: string;
    mission: string;
  };
  aboutUs: {
    description: string;
    goals: string[];
    history: string;
  };
  impactOverview: {
    familiesHelped: number;
    beneficiariesSupported: number;
    visitsCompleted: number;
    aidUnitsDistributed: number;
    areasServed: number;
  };
  testimonials: Array<{
    author: string;
    role: string;
    quote: string;
  }>;
  callToAction: {
    title: string;
    description: string;
    primaryLabel: string;
    primaryUrl: string;
    secondaryLabel?: string;
    secondaryUrl?: string;
  };
  generatedAt: string;
}

export interface PublicImpactPayload {
  summary: {
    familiesHelped: number;
    peopleInFamilies: number;
    beneficiariesSupported: number;
    visitsCompleted: number;
    aidRecords: number;
    aidUnitsDistributed: number;
    areasServed: number;
  };
  aidDistribution: Array<{
    key: string;
    label: string;
    totalQuantity: number;
    totalRecords: number;
  }>;
  areas: Array<{
    zone: string;
    totalFamilies: number;
  }>;
  aidTimeline: Array<{
    year: number;
    totalQuantity: number;
    totalRecords: number;
  }>;
  visitsTimeline: Array<{
    year: number;
    month: number;
    label: string;
    totalVisits: number;
  }>;
  generatedAt: string;
}

export interface PublicReportItem {
  id: string;
  slug: string;
  title: string;
  type: PublicReportType;
  year: number;
  publishedAt: string;
  summary: string;
  highlights: string[];
  format: 'pdf';
  viewUrl: string;
  downloadUrl: string;
}

export interface FinancialSummary {
  currency: string;
  estimatedBudget: number;
  breakdown: Array<{
    key: string;
    label: string;
    percentage: number;
    amountEstimate: number;
  }>;
  note: string;
}

export interface FinancialTimelineItem {
  year: number;
  donationEstimate: number;
  spentEstimate: number;
}

export interface PublicReportsPayload {
  reports: PublicReportItem[];
  availableYears: number[];
  availableTypes: PublicReportType[];
  financialSummary: FinancialSummary;
  financialTimeline: FinancialTimelineItem[];
  summary: PublicImpactPayload['summary'];
  familiesByZone: PublicImpactPayload['areas'];
  aidByType: PublicImpactPayload['aidDistribution'];
  visitsByMonth: Array<{
    year: number;
    month: number;
    totalVisits: number;
  }>;
  generatedAt: string;
}

export interface PublicPostAuthor {
  _id: string;
  name: string;
  role: 'admin' | 'coordinator' | 'responsible' | 'volunteer';
}

export interface PublicPostAssociationFamily {
  _id: string;
  name: string;
  zone?: string;
  zoneId?: string | null;
  postalCode?: string;
  donationGoal?: number;
  totalRaised?: number;
  goalReached?: boolean;
  visited?: boolean;
}

export interface PublicPostAssociationBeneficiary {
  _id: string;
  firstName: string;
  lastName: string;
  family: PublicPostAssociationFamily | null;
}

export type PublicPostAssociationType = 'none' | 'family' | 'beneficiary';

export interface PublicPostItem {
  _id: string;
  title: string;
  content: string;
  donationGoal: number;
  amountRaised: number;
  donationCount: number;
  remainingAmount: number;
  progressPercent: number;
  goalReached: boolean;
  associationType: PublicPostAssociationType;
  familyId: string | null;
  beneficiaryId: string | null;
  association: {
    type: PublicPostAssociationType;
    family: PublicPostAssociationFamily | null;
    beneficiary: PublicPostAssociationBeneficiary | null;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: PublicPostAuthor | null;
}

export interface PublicPostCreatePayload {
  title: string;
  content: string;
  donationGoal: number;
  associationType?: PublicPostAssociationType;
  family?: string | null;
  beneficiary?: string | null;
}

export interface PublicPostUpdatePayload {
  title?: string;
  content?: string;
  donationGoal?: number;
  associationType?: PublicPostAssociationType;
  family?: string | null;
  beneficiary?: string | null;
}

export interface PublicPostDonationPayload {
  amount: number;
  currency?: string;
}

export interface PublicPostDonationCheckout {
  provider: string;
  sessionId: string;
  checkoutUrl: string;
  expiresAt: string | null;
  amount: number;
}

export interface PublicPostDonationConfirmation {
  post: PublicPostItem;
  donation: {
    sessionId: string;
    amount: number;
    currency: string;
    provider: string;
    alreadyProcessed: boolean;
  };
  message: string;
}

export type PublicChatbotHistoryRole = 'user' | 'assistant';

export interface PublicChatbotHistoryItem {
  role: PublicChatbotHistoryRole;
  content: string;
}

export interface PublicChatbotAskPayload {
  message: string;
  history?: PublicChatbotHistoryItem[];
}

export interface PublicChatbotReply {
  reply: string;
  provider: 'openai' | 'fallback';
  model: string | null;
  generatedAt: string;
}
