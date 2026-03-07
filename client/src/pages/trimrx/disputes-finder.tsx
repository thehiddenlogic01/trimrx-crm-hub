import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2, Search, Receipt, ExternalLink, Mail, User, CreditCard, Calendar,
  DollarSign, AlertCircle, Gavel, Clock, ShieldAlert, ArrowLeft, Copy,
  CheckCircle2, XCircle, Shield, FileText, Activity, Link2, Info,
} from "lucide-react";

interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  created: number;
  refunded: boolean;
  refundAmount: number;
  paymentMethod: string;
  receiptUrl: string | null;
  disputed: boolean;
  customerId: string;
}

interface StripeDispute {
  id: string;
  chargeId: string;
  amount: number;
  currency: string;
  status: string;
  reason: string;
  created: number;
  evidenceDueBy: number | null;
  isChargeRefundable: boolean;
  customerId: string;
}

interface StripeCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  created: number;
  currency: string;
  balance: number;
  metadata: Record<string, string>;
}

interface SearchResult {
  customers: StripeCustomer[];
  payments: StripeCharge[];
  subscriptions: any[];
  paymentIntents: any[];
  invoices: any[];
  disputes: StripeDispute[];
}

interface ChargeDetails {
  id: string;
  amount: number;
  amountRefunded: number;
  currency: string;
  status: string;
  disputed: boolean;
  refunded: boolean;
  captured: boolean;
  description: string;
  statementDescriptor: string;
  created: number;
  receiptUrl: string | null;
  receiptEmail: string;
  paymentMethodType: string;
  paymentMethodId: string;
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    fingerprint: string;
    funding: string;
    country: string;
    network: string;
    cvcCheck: string | null;
    addressLine1Check: string | null;
    addressPostalCodeCheck: string | null;
  } | null;
  billingDetails: {
    name: string;
    email: string;
    phone: string;
    address: {
      line1: string;
      line2: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    } | null;
  } | null;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    description: string;
    metadata: Record<string, string>;
  } | null;
  balanceTransaction: {
    id: string;
    amount: number;
    fee: number;
    net: number;
    currency: string;
    availableOn: number | null;
    feeDetails: { amount: number; currency: string; description: string; type: string }[];
  } | null;
  dispute: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    reason: string;
    networkReasonCode: string;
    created: number;
    evidenceDueBy: number | null;
    isChargeRefundable: boolean;
  } | null;
  paymentIntent: {
    id: string;
    status: string;
    created: number;
  } | null;
  outcome: {
    networkStatus: string;
    riskLevel: string;
    riskScore: number | null;
    sellerMessage: string;
    type: string;
  } | null;
  metadata: Record<string, string>;
  events: { id: string; type: string; created: number; description: string }[];
}

const DISPUTE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  "warning_needs_response": { label: "Needs Response", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  "warning_under_review": { label: "Under Review", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  "warning_closed": { label: "Warning Closed", color: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300" },
  "needs_response": { label: "Needs Response", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  "under_review": { label: "Under Review", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  "won": { label: "Won", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  "lost": { label: "Lost", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  "charge_refunded": { label: "Charge Refunded", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
};

const DISPUTE_REASON_MAP: Record<string, string> = {
  "bank_cannot_process": "Bank Cannot Process",
  "check_returned": "Check Returned",
  "credit_not_processed": "Credit Not Processed",
  "customer_initiated": "Customer Initiated",
  "debit_not_authorized": "Debit Not Authorized",
  "duplicate": "Duplicate",
  "fraudulent": "Fraudulent",
  "general": "General",
  "incorrect_account_details": "Incorrect Account Details",
  "insufficient_funds": "Insufficient Funds",
  "product_not_received": "Product Not Received",
  "product_unacceptable": "Product Unacceptable",
  "subscription_canceled": "Subscription Canceled",
  "unrecognized": "Unrecognized",
};

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1 text-muted-foreground hover:text-foreground inline-flex"
      data-testid={`button-copy-${text}`}
    >
      {copied ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function CheckBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  if (value === "pass") return <span className="text-green-600 dark:text-green-400 text-xs flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Passed</span>;
  if (value === "fail") return <span className="text-red-600 dark:text-red-400 text-xs flex items-center gap-1"><XCircle className="h-3 w-3" /> Failed</span>;
  if (value === "unavailable") return <span className="text-muted-foreground text-xs">Unavailable</span>;
  if (value === "unchecked") return <span className="text-muted-foreground text-xs">Not checked</span>;
  return <span className="text-muted-foreground text-xs">{value}</span>;
}

function ChargeDetailView({ details, onBack }: { details: ChargeDetails; onBack: () => void }) {
  const formatDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const formatShortDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const getDaysUntil = (ts: number) => Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));

  const getDisputeStatusBadge = (status: string) => {
    const mapped = DISPUTE_STATUS_MAP[status];
    if (mapped) return <Badge className={mapped.color}>{mapped.label}</Badge>;
    return <Badge variant="secondary">{status.replace(/_/g, " ")}</Badge>;
  };

  const getRiskBadge = (level: string, score: number | null) => {
    const colors: Record<string, string> = { normal: "text-green-600 bg-green-100", elevated: "text-yellow-600 bg-yellow-100", highest: "text-red-600 bg-red-100", high: "text-orange-600 bg-orange-100" };
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded ${colors[level] || "text-muted-foreground bg-muted"}`}>
        {score !== null && <span className="font-bold">{score}</span>}
        <span className="capitalize">{level}</span>
      </span>
    );
  };

  const address = details.billingDetails?.address;
  const fullAddress = address ? [address.line1, address.line2, [address.city, address.state, address.postalCode].filter(Boolean).join(", "), address.country].filter(Boolean).join("\n") : "";

  return (
    <div className="space-y-6 max-w-7xl" data-testid="charge-detail-view">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
        data-testid="button-back-to-list"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to search results
      </button>

      <div className="flex items-start gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-charge-amount">
              ${details.amount.toFixed(2)} {details.currency}
            </h2>
            {details.dispute && details.dispute.evidenceDueBy && (
              <Badge className={getDaysUntil(details.dispute.evidenceDueBy) > 0 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" : "bg-red-100 text-red-700"} data-testid="badge-response-countdown">
                {getDaysUntil(details.dispute.evidenceDueBy) > 0 ? `${getDaysUntil(details.dispute.evidenceDueBy)} days to respond` : "Overdue"}
              </Badge>
            )}
          </div>
          {details.customer && (
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-charged-to">
              Charged to <span className="text-blue-600 dark:text-blue-400 font-medium">{details.customer.name || details.customer.email}</span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          {details.dispute && (
            <div className="rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-950/20 p-5 space-y-3" data-testid="card-dispute-alert">
              <h3 className="font-semibold text-base">This payment was disputed</h3>
              <p className="text-sm text-muted-foreground">
                The cardholder claims you have not yet refunded their return or cancellation.
              </p>
              <p className="text-sm text-muted-foreground">
                You may either counter the dispute by providing evidence that a refund was already issued or is otherwise not owed,
                or you can accept this dispute immediately to refund the cardholder and close the dispute.
              </p>
            </div>
          )}

          <div data-testid="section-recent-activity">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              Recent activity
            </h3>
            <div className="relative pl-6 space-y-0">
              {details.dispute && (
                <div className="relative pb-6">
                  <div className="absolute left-[-16px] top-1.5 w-3 h-3 rounded-full bg-red-500 ring-4 ring-background" />
                  <div className="absolute left-[-10px] top-5 bottom-0 w-[1px] bg-border" />
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">Payment disputed</p>
                  <p className="text-xs text-muted-foreground">{formatDate(details.dispute.created)}</p>
                </div>
              )}
              {details.captured && (
                <div className="relative pb-6">
                  <div className="absolute left-[-16px] top-1.5 w-3 h-3 rounded-full bg-green-500 ring-4 ring-background" />
                  <div className="absolute left-[-10px] top-5 bottom-0 w-[1px] bg-border" />
                  <p className="text-sm font-medium">${details.amount.toFixed(2)} captured</p>
                  <p className="text-xs text-muted-foreground">{formatDate(details.created)}</p>
                </div>
              )}
              {details.paymentIntent && (
                <>
                  <div className="relative pb-6">
                    <div className="absolute left-[-16px] top-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-background" />
                    <div className="absolute left-[-10px] top-5 bottom-0 w-[1px] bg-border" />
                    <p className="text-sm font-medium">Payment authorized</p>
                    <p className="text-xs text-muted-foreground">{formatDate(details.paymentIntent.created)}</p>
                  </div>
                  <div className="relative pb-2">
                    <div className="absolute left-[-16px] top-1.5 w-3 h-3 rounded-full bg-gray-400 ring-4 ring-background" />
                    <p className="text-sm font-medium">Payment started</p>
                    <p className="text-xs text-muted-foreground">{formatDate(details.paymentIntent.created)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div data-testid="section-payment-breakdown">
            <h3 className="text-lg font-semibold mb-4">Payment breakdown</h3>
            <div className="space-y-0 rounded-lg border">
              <div className="flex justify-between items-center px-4 py-3 border-b">
                <span className="text-sm">Payment amount</span>
                <span className="text-sm font-medium">${details.amount.toFixed(2)} {details.currency}</span>
              </div>
              {details.dispute && (
                <div className="flex justify-between items-center px-4 py-3 border-b">
                  <span className="text-sm flex items-center gap-1">
                    Initial disputed amount
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </span>
                  <span className="text-sm font-medium text-red-600">- ${details.dispute.amount.toFixed(2)} {details.currency}</span>
                </div>
              )}
              {details.balanceTransaction && (
                <>
                  {details.balanceTransaction.feeDetails.map((fd, i) => (
                    <div key={i} className="flex justify-between items-center px-4 py-3 border-b">
                      <span className="text-sm">{fd.description || "Fees"}</span>
                      <span className="text-sm font-medium">- ${fd.amount.toFixed(2)} {fd.currency}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center px-4 py-3 bg-muted/30 font-semibold">
                    <span className="text-sm">Net amount</span>
                    <span className="text-sm">${details.balanceTransaction.net.toFixed(2)} {details.balanceTransaction.currency}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div data-testid="section-payment-method">
            <h3 className="text-lg font-semibold mb-4">Payment method</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 text-sm">
              <div className="space-y-3">
                {details.paymentMethodId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">ID</span>
                    <span className="font-mono text-xs">{details.paymentMethodId}<CopyButton text={details.paymentMethodId} /></span>
                  </div>
                )}
                {details.card && details.card.last4 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">Number</span>
                      <span className="flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5" />
                        •••• {details.card.last4}
                      </span>
                    </div>
                    {details.card.fingerprint && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Fingerprint</span>
                        <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{details.card.fingerprint}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">Expires</span>
                      <span>{details.card.expMonth} / {details.card.expYear}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">Type</span>
                      <span>{CARD_BRAND_LABELS[details.card.brand] || details.card.brand} {details.card.funding} card</span>
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-3">
                {details.billingDetails && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">Owner</span>
                      <span>{details.billingDetails.name || "—"}</span>
                    </div>
                    {fullAddress && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Address</span>
                        <span className="text-right whitespace-pre-line text-xs">{fullAddress}</span>
                      </div>
                    )}
                  </>
                )}
                {details.card && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">CVC check</span>
                      <CheckBadge value={details.card.cvcCheck} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">Street check</span>
                      <CheckBadge value={details.card.addressLine1Check} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">Zip check</span>
                      <CheckBadge value={details.card.addressPostalCodeCheck} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {details.events.length > 0 && (
            <div data-testid="section-events">
              <h3 className="text-lg font-semibold mb-4">Events</h3>
              <div className="rounded-lg border divide-y">
                {details.events.map((ev) => (
                  <div key={ev.id} className="flex items-start justify-between px-4 py-3 gap-4" data-testid={`event-${ev.id}`}>
                    <p className="text-sm">{ev.description}</p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(ev.created)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {details.dispute && (
            <div className="space-y-3" data-testid="sidebar-dispute">
              <h3 className="text-base font-semibold">Dispute</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Dispute ID</p>
                  <p className="font-mono text-xs">{details.dispute.id}<CopyButton text={details.dispute.id} /></p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Amount</p>
                  <p className="font-medium">${details.dispute.amount.toFixed(2)} {details.dispute.currency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Dispute response due</p>
                  <p className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {details.dispute.evidenceDueBy ? formatShortDate(details.dispute.evidenceDueBy) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Status</p>
                  {getDisputeStatusBadge(details.dispute.status)}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Reason</p>
                  <p className="text-blue-600 dark:text-blue-400">{DISPUTE_REASON_MAP[details.dispute.reason] || details.dispute.reason.replace(/_/g, " ")}</p>
                </div>
                {details.dispute.networkReasonCode && (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">Network reason code</p>
                    <p>{details.dispute.networkReasonCode}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3" data-testid="sidebar-details">
            <h3 className="text-base font-semibold">Details</h3>
            <div className="space-y-3 text-sm">
              {details.paymentIntent && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Payment ID</p>
                  <p className="font-mono text-xs">{details.paymentIntent.id}<CopyButton text={details.paymentIntent.id} /></p>
                </div>
              )}
              {details.card && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Payment method</p>
                  <p className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    •••• {details.card.last4}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs font-medium">Description</p>
                <p>{details.description || "—"}</p>
              </div>
              {details.statementDescriptor && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Statement descriptor</p>
                  <p>{details.statementDescriptor}</p>
                </div>
              )}
              {details.balanceTransaction?.availableOn && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Date funds will be available in Stripe Balance</p>
                  <p>{formatDate(details.balanceTransaction.availableOn)}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs font-medium">Dates</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDate(details.created)}</span>
                </div>
              </div>
            </div>
          </div>

          {details.outcome && (
            <div className="space-y-3" data-testid="sidebar-risk">
              <h3 className="text-base font-semibold">Risk evaluation</h3>
              <div className="text-sm">
                {getRiskBadge(details.outcome.riskLevel, details.outcome.riskScore)}
              </div>
            </div>
          )}

          {details.customer && (
            <div className="space-y-3" data-testid="sidebar-customer">
              <h3 className="text-base font-semibold">Customer</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">ID</p>
                  <p className="font-mono text-xs text-blue-600 dark:text-blue-400">{details.customer.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Name</p>
                  <p>{details.customer.name || "—"}</p>
                </div>
                {details.customer.description && (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">Description</p>
                    <p>{details.customer.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs font-medium">Email</p>
                  <p>{details.customer.email || "—"}<CopyButton text={details.customer.email} /></p>
                </div>
                {details.customer.phone && (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">Phone</p>
                    <p>{details.customer.phone}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {Object.keys(details.metadata).length > 0 && (
            <div className="space-y-3" data-testid="sidebar-metadata">
              <h3 className="text-base font-semibold">Metadata</h3>
              <div className="space-y-2 text-sm">
                {Object.entries(details.metadata).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-muted-foreground text-xs font-medium">{key}</p>
                    <p>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div data-testid="section-connections">
        <h3 className="text-lg font-semibold mb-4">Connections</h3>
        <div className="space-y-2 text-sm">
          <div className="flex gap-8">
            <span className="text-muted-foreground font-medium w-40">Latest charge</span>
            <span className="font-mono text-xs">{details.id}</span>
          </div>
          {details.balanceTransaction && (
            <div className="flex gap-8">
              <span className="text-muted-foreground font-medium w-40">Balance transaction</span>
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{details.balanceTransaction.id}</span>
            </div>
          )}
          {details.paymentIntent && (
            <div className="flex gap-8">
              <span className="text-muted-foreground font-medium w-40">Payment intent</span>
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{details.paymentIntent.id}</span>
            </div>
          )}
        </div>
      </div>

      {details.receiptUrl && (
        <div data-testid="section-receipt">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Receipt history</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(details.receiptUrl!, "_blank")}
              data-testid="button-view-receipt-detail"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              View receipt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


export default function DisputesFinderPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selectedChargeDetails, setSelectedChargeDetails] = useState<ChargeDetails | null>(null);

  const searchMutation = useMutation({
    mutationFn: async (searchEmail: string) => {
      const res = await apiRequest("POST", "/api/stripe-payments/search", { email: searchEmail });
      return res.json() as Promise<SearchResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setSelectedChargeDetails(null);
      if (data.payments.length === 0 && (!data.disputes || data.disputes.length === 0)) {
        toast({ title: "No results found", description: "No payment or dispute history found for this email." });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    },
  });

  const chargeDetailsMutation = useMutation({
    mutationFn: async (chargeId: string) => {
      const res = await apiRequest("POST", "/api/stripe-payments/charge-details", { chargeId });
      return res.json() as Promise<ChargeDetails>;
    },
    onSuccess: (data) => {
      setSelectedChargeDetails(data);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to load details", description: err.message, variant: "destructive" });
    },
  });

  const handleSearch = () => {
    if (!email.trim()) return;
    searchMutation.mutate(email.trim());
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const formatShortDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const getDaysUntil = (ts: number) => Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));

  const getStatusBadge = (status: string, refunded: boolean) => {
    if (refunded) return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" data-testid="badge-status-refunded">Refunded</Badge>;
    switch (status) {
      case "succeeded": return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" data-testid="badge-status-succeeded">Succeeded</Badge>;
      case "pending": return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" data-testid="badge-status-pending">Pending</Badge>;
      case "failed": return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" data-testid="badge-status-failed">Failed</Badge>;
      default: return <Badge variant="secondary" data-testid="badge-status-other">{status}</Badge>;
    }
  };

  const getDisputeStatusBadge = (status: string) => {
    const mapped = DISPUTE_STATUS_MAP[status];
    if (mapped) return <Badge className={mapped.color} data-testid={`badge-dispute-status-${status}`}>{mapped.label}</Badge>;
    return <Badge variant="secondary" data-testid={`badge-dispute-status-${status}`}>{status.replace(/_/g, " ")}</Badge>;
  };

  const disputes = result?.disputes || [];

  if (selectedChargeDetails) {
    return <ChargeDetailView details={selectedChargeDetails} onBack={() => setSelectedChargeDetails(null)} />;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
          Disputes Finder
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Search by email to find payment disputes and receipt history
        </p>
      </div>

      <Card data-testid="card-search">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Customer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Enter customer email address..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
                data-testid="input-search-email"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!email.trim() || searchMutation.isPending}
              data-testid="button-search"
            >
              {searchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && result.customers.length > 0 && (
        <Card data-testid="card-customer-info">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.customers.map((customer) => (
                <div key={customer.id} className="p-4 rounded-lg border bg-muted/30 space-y-2" data-testid={`card-customer-${customer.id}`}>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{customer.name || "No name"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{customer.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Since {formatDate(customer.created)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>ID: {customer.id}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result && disputes.length > 0 && (
        <Card data-testid="card-disputes">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Gavel className="h-5 w-5 text-red-500" />
                Payment Disputes
              </CardTitle>
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" data-testid="badge-dispute-count">
                {disputes.length} dispute{disputes.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {disputes.map((dispute) => (
                <div
                  key={dispute.id}
                  className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20 space-y-3"
                  data-testid={`card-dispute-${dispute.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                      <span className="font-semibold text-sm">Payment Disputed</span>
                    </div>
                    {getDisputeStatusBadge(dispute.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Amount</p>
                      <p className="text-sm font-semibold flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                        {dispute.amount.toFixed(2)} {dispute.currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Dispute Date</p>
                      <p className="text-sm flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatShortDate(dispute.created)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Reason</p>
                      <p className="text-sm font-medium">
                        {DISPUTE_REASON_MAP[dispute.reason] || dispute.reason.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Evidence Due</p>
                      {dispute.evidenceDueBy ? (
                        <p className="text-sm flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{formatShortDate(dispute.evidenceDueBy)}</span>
                          {getDaysUntil(dispute.evidenceDueBy) > 0 ? (
                            <Badge variant="secondary" className="text-[10px] ml-1">{getDaysUntil(dispute.evidenceDueBy)}d left</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-[10px] ml-1">Overdue</Badge>
                          )}
                        </p>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-red-200/50 dark:border-red-800/50">
                    <div className="text-xs text-muted-foreground">
                      <span>Charge: {dispute.chargeId}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ID: {dispute.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card data-testid="card-receipt-history">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Receipt History
              </CardTitle>
              {result.payments.length > 0 && (
                <Badge variant="secondary" data-testid="badge-payment-count">
                  {result.payments.length} payment{result.payments.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {result.payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground" data-testid="text-no-results">
                <AlertCircle className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm font-medium">No payment history found</p>
                <p className="text-xs mt-1">No charges were found for this customer email</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.payments.map((payment) => {
                      const paymentDispute = disputes.find((d) => d.chargeId === payment.id);
                      return (
                        <TableRow key={payment.id} className={paymentDispute ? "bg-red-50/30 dark:bg-red-950/10" : ""} data-testid={`row-payment-${payment.id}`}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDate(payment.created)}
                          </TableCell>
                          <TableCell className="text-sm max-w-[250px]">
                            <span className="truncate block">{payment.description || "—"}</span>
                            {paymentDispute && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <ShieldAlert className="h-3 w-3 text-red-500" />
                                <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                                  Disputed — {DISPUTE_REASON_MAP[paymentDispute.reason] || paymentDispute.reason.replace(/_/g, " ")}
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{payment.amount.toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground">{payment.currency}</span>
                            </div>
                            {payment.refunded && payment.refundAmount > 0 && (
                              <p className="text-xs text-orange-600 mt-0.5">
                                Refunded: ${payment.refundAmount.toFixed(2)}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {getStatusBadge(payment.status, payment.refunded)}
                              {paymentDispute && (
                                <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-[10px]" data-testid={`badge-disputed-${payment.id}`}>
                                  Disputed
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm capitalize">
                            {payment.paymentMethod}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => chargeDetailsMutation.mutate(payment.id)}
                                disabled={chargeDetailsMutation.isPending}
                                data-testid={`button-full-info-${payment.id}`}
                              >
                                {chargeDetailsMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <FileText className="h-3 w-3 mr-1" />
                                )}
                                Get Full Info
                              </Button>
                              {payment.receiptUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => window.open(payment.receiptUrl!, "_blank")}
                                  data-testid={`button-view-receipt-${payment.id}`}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Receipt
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
