import { CheckCircle2, XCircle, Clock, AlertTriangle, Zap, Bookmark, RefreshCw, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function stripeStatusColor(status: string): string {
  switch (status) {
    case "succeeded":
    case "paid":
    case "active":
    case "won":
    case "charge_refunded":
      return "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300 border-green-300 dark:border-green-700";
    case "canceled":
    case "failed":
    case "unpaid":
    case "incomplete_expired":
    case "lost":
      return "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300 border-red-300 dark:border-red-700";
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
    case "incomplete":
    case "pending":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/60 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700";
    case "requires_capture":
    case "uncaptured":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border-purple-300 dark:border-purple-700";
    case "processing":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border-blue-300 dark:border-blue-700";
    case "trialing":
      return "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 border-sky-300 dark:border-sky-700";
    case "past_due":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300 border-orange-300 dark:border-orange-700";
    case "disputed":
    case "needs_response":
    case "warning_needs_response":
    case "under_review":
    case "warning_under_review":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border-amber-300 dark:border-amber-700";
    case "warning_closed":
    case "paused":
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600";
  }
}

export function stripeStatusLabel(status: string): string {
  switch (status) {
    case "succeeded": return "Succeeded";
    case "paid": return "Paid";
    case "active": return "Active";
    case "canceled": return "Canceled";
    case "failed": return "Failed";
    case "requires_payment_method": return "Incomplete";
    case "requires_confirmation": return "Incomplete";
    case "requires_action": return "Incomplete";
    case "requires_capture": return "Uncaptured";
    case "uncaptured": return "Uncaptured";
    case "processing": return "Processing";
    case "disputed": return "Disputed";
    case "needs_response": return "Dispute: Needs Response";
    case "warning_needs_response": return "Dispute: Needs Response";
    case "under_review": return "Dispute: Under Review";
    case "warning_under_review": return "Dispute: Under Review";
    case "charge_refunded": return "Refunded";
    case "warning_closed": return "Dispute: Closed";
    case "won": return "Dispute: Won";
    case "lost": return "Dispute: Lost";
    case "trialing": return "Trialing";
    case "past_due": return "Past Due";
    case "incomplete": return "Incomplete";
    case "incomplete_expired": return "Expired";
    case "unpaid": return "Unpaid";
    case "paused": return "Paused";
    case "pending": return "Pending";
    default: return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function StripeStatusIcon({ status, className = "h-3 w-3" }: { status: string; className?: string }) {
  switch (status) {
    case "succeeded":
    case "paid":
    case "active":
    case "won":
    case "charge_refunded":
      return <CheckCircle2 className={className} />;
    case "canceled":
    case "failed":
    case "unpaid":
    case "incomplete_expired":
    case "lost":
      return <XCircle className={className} />;
    case "requires_capture":
    case "uncaptured":
      return <Bookmark className={className} />;
    case "processing":
      return <RefreshCw className={className} />;
    case "disputed":
    case "needs_response":
    case "warning_needs_response":
    case "under_review":
    case "warning_under_review":
      return <ShieldAlert className={className} />;
    case "past_due":
      return <AlertTriangle className={className} />;
    case "requires_payment_method":
    case "requires_confirmation":
    case "requires_action":
      return <Clock className={className} />;
    default:
      return <Clock className={className} />;
  }
}

export function StripeStatusBadge({ status, size = "sm" }: { status: string; size?: "xs" | "sm" }) {
  const colorClass = stripeStatusColor(status);
  const label = stripeStatusLabel(status);
  const iconSize = size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <Badge
      variant="outline"
      className={`gap-1 font-medium ${size === "xs" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"} ${colorClass}`}
    >
      <StripeStatusIcon status={status} className={iconSize} />
      {label}
    </Badge>
  );
}
