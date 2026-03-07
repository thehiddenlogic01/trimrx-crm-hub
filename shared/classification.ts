export const REASON_SUBREASON_MAP: Record<string, string[]> = {
  "Financial & Pricing": [
    "Competitor Price",
    "Bundle Misunderstanding",
    "Financial Hardship",
    "Month 2 Refill Price",
    "Insurance Expectation",
    "Subscription Misunderstanding",
    "Billing Error",
    "Duplicate Payment",
    "Branded Medication Affordability",
    "Promotional Pricing Discrepancy",
  ],
  "Clinical & Health": [
    "Severe Side Effects",
    "Low Efficacy",
    "Goal Reached",
    "Medical Concerns",
    "Disqualified",
    "Injection/Vial Aversion",
    "Dosing Issues",
  ],
  "Logistics & Supply": [
    "Fulfillment Latency",
    "Order Quality",
    "Carrier Error",
  ],
  "Support & UX": [
    "Consultation Issue",
    "Support Latency",
    "Technical UX Issue",
    "AI Complaint",
  ],
  "Uncategorized": ["Other"],
  "Not for Retention": ["N/A"],
};

export const ALL_REASONS = Object.keys(REASON_SUBREASON_MAP);

export const ALL_SUB_REASONS = Object.values(REASON_SUBREASON_MAP).flat();

export const DESIRED_ACTION_OPTIONS = [
  "Cancel",
  "Refund",
  "Refund and Cancel",
  "Paused",
  "N/A",
];

export const CLIENT_THREAT_OPTIONS = [
  "BBB Review",
  "Dispute",
  "Attorney General",
  "Trust Pilot Review",
];

export function getSubReasonsForReason(reason: string): string[] {
  return REASON_SUBREASON_MAP[reason] || [];
}

export function getReasonForSubReason(subReason: string): string | null {
  for (const [reason, subs] of Object.entries(REASON_SUBREASON_MAP)) {
    if (subs.includes(subReason)) return reason;
  }
  return null;
}
