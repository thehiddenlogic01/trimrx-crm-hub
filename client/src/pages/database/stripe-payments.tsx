import { useState, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Search,
  CreditCard,
  Loader2,
  User,
  DollarSign,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  ArrowDownCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { StripeStatusBadge } from "@/lib/stripe-status";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  created: number;
  currency: string;
  balance: number;
}

interface Payment {
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
  customerId: string;
}

interface Subscription {
  id: string;
  status: string;
  created: number;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  canceledAt: number | null;
  cancelAtPeriodEnd: boolean;
  items: {
    id: string;
    priceId: string;
    amount: number;
    currency: string;
    interval: string;
    productName: string;
  }[];
  customerId: string;
}

interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  created: number;
  paymentMethod: string;
  lastError: string | null;
  customerId: string;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: number;
  periodStart: number | null;
  periodEnd: number | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
  subscriptionId: string | null;
  customerId: string;
}

interface SearchResult {
  customers: Customer[];
  payments: Payment[];
  paymentIntents: PaymentIntent[];
  subscriptions: Subscription[];
  invoices: Invoice[];
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface ActivityItem {
  type: string;
  title: string;
  description: string;
  timestamp: number;
  icon: string;
}

function ActivityIcon({ icon, type }: { icon: string; type: string }) {
  const size = "h-3.5 w-3.5";
  if (type === "succeeded") return <CheckCircle2 className={`${size} text-green-600`} />;
  if (type === "failed" || type === "error") return <XCircle className={`${size} text-red-500`} />;
  if (type === "canceled") return <XCircle className={`${size} text-gray-500`} />;
  if (icon === "alert" || type === "requires_action") return <AlertTriangle className={`${size} text-yellow-500`} />;
  if (type === "refunded") return <RefreshCw className={`${size} text-blue-500`} />;
  if (type === "disputed") return <AlertCircle className={`${size} text-amber-500`} />;
  return <Clock className={`${size} text-muted-foreground`} />;
}

function PIActivityTimeline({ piId }: { piId: string }) {
  const { data, isLoading, error } = useQuery<{ activity: ActivityItem[] }>({
    queryKey: ["/api/stripe-payments/pi-activity", piId],
    queryFn: async () => {
      const res = await fetch(`/api/stripe-payments/pi-activity/${piId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading activity...
      </div>
    );
  }

  if (error || !data?.activity?.length) {
    return (
      <div className="py-2 px-4 text-xs text-muted-foreground italic">
        No recent activity
      </div>
    );
  }

  return (
    <div className="px-4 py-2" data-testid={`pi-activity-${piId}`}>
      <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Activity</h5>
      <div className="relative pl-5 space-y-2">
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
        {data.activity.map((item, idx) => (
          <div key={idx} className="relative flex items-start gap-2">
            <div className="absolute -left-5 top-0.5 bg-background p-0.5">
              <ActivityIcon icon={item.icon} type={item.type} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground leading-tight">{item.title}</p>
              {item.description && (
                <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{item.description}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(item.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StripePaymentsPage() {
  const { toast } = useToast();
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [expandedPiId, setExpandedPiId] = useState<string | null>(null);

  const { data: connectionStatus, isLoading: statusLoading } = useQuery<{ connected: boolean; source: string }>({
    queryKey: ["/api/stripe-payments/status"],
  });

  const searchMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/stripe-payments/search", { email });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Search failed");
      }
      return res.json() as Promise<SearchResult>;
    },
    onSuccess: (data) => {
      setSearchResult(data);
      if (data.customers.length === 0) {
        toast({ title: "No results", description: "No customer found with this email" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    searchMutation.mutate(searchEmail.trim());
  };

  const isConnected = connectionStatus?.connected;
  const connectionSource = connectionStatus?.source;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Stripe Payment Details</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Search customer payment and subscription data by email</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={isConnected
              ? "text-green-600 border-green-300 dark:text-green-400 dark:border-green-700"
              : "text-muted-foreground"
            }
            data-testid="badge-stripe-status"
          >
            <CreditCard className="h-3 w-3 mr-1" />
            {statusLoading ? "Checking..." : isConnected
              ? `Connected${connectionSource === "integration" ? " (Integration)" : " (API Key)"}`
              : "Not connected"}
          </Badge>
        </div>
      </div>

      {statusLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !isConnected ? (
        <Card className="animate-fade-in-up stagger-1">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Stripe Not Connected</h3>
            <p className="text-muted-foreground max-w-md">
              Connect your Stripe account to search customer payment and subscription data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <form onSubmit={handleSearch} className="flex gap-2 animate-fade-in-up stagger-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter customer email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-10"
                data-testid="input-search-email"
              />
            </div>
            <Button type="submit" disabled={searchMutation.isPending || !searchEmail.trim()} data-testid="button-search-stripe">
              {searchMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              Search
            </Button>
          </form>

          {searchMutation.isPending && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {searchResult && !searchMutation.isPending && (
            <>
              {searchResult.customers.length === 0 ? (
                <Card className="animate-fade-in-up">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
                    <h3 className="text-base font-medium text-foreground mb-1">No Customer Found</h3>
                    <p className="text-sm text-muted-foreground">No Stripe customer matches this email address.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {searchResult.customers.length > 1 && (
                    <Card className="animate-fade-in-up">
                      <CardContent className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <span className="font-semibold text-foreground">Summary across {searchResult.customers.length} customers:</span>
                          <Badge variant="outline" className="gap-1">
                            <CreditCard className="h-3 w-3" />
                            {searchResult.paymentIntents.length} Payment Intent{searchResult.paymentIntents.length !== 1 ? "s" : ""}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <DollarSign className="h-3 w-3" />
                            {(searchResult.payments || []).length} Charge{(searchResult.payments || []).length !== 1 ? "s" : ""}
                          </Badge>
                          {searchResult.subscriptions.length > 0 && (
                            <Badge variant="outline" className="gap-1">
                              <RefreshCw className="h-3 w-3" />
                              {searchResult.subscriptions.length} Subscription{searchResult.subscriptions.length !== 1 ? "s" : ""}
                            </Badge>
                          )}
                          {(searchResult.invoices || []).length > 0 && (
                            <Badge variant="outline" className="gap-1">
                              {(searchResult.invoices || []).length} Invoice{(searchResult.invoices || []).length !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {searchResult.customers.map((customer, idx) => {
                    const custPayments = (searchResult.payments || []).filter((p) => p.customerId === customer.id);
                    const custIntents = (searchResult.paymentIntents || []).filter((p) => p.customerId === customer.id);
                    const custSubs = (searchResult.subscriptions || []).filter((s) => s.customerId === customer.id);
                    const custInvoices = (searchResult.invoices || []).filter((i) => i.customerId === customer.id);
                    const custPaid = custPayments.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amount, 0);
                    const custRefunded = custPayments.filter((p) => p.refunded).reduce((s, p) => s + p.refundAmount, 0);

                    return (
                      <Card key={customer.id} className={`animate-fade-in-up stagger-${Math.min(idx + 1, 4)}`} data-testid={`card-customer-${customer.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <User className="h-4 w-4 text-primary" />
                              {customer.name || "Unnamed Customer"}
                            </CardTitle>
                            <span className="text-xs text-muted-foreground font-mono">{customer.id}</span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                            <span>{customer.email}</span>
                            {customer.phone && <span>{customer.phone}</span>}
                            <span>Joined {formatDate(customer.created)}</span>
                            {customer.balance !== 0 && <span>Balance: ${customer.balance.toFixed(2)}</span>}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-0">
                          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                            <div className="p-2 rounded-md bg-muted/40">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Paid</div>
                              <div className="text-sm font-bold text-green-600 dark:text-green-400" data-testid={`text-paid-${customer.id}`}>${custPaid.toFixed(2)}</div>
                            </div>
                            <div className="p-2 rounded-md bg-muted/40">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Refunded</div>
                              <div className="text-sm font-bold text-red-600 dark:text-red-400" data-testid={`text-refunded-${customer.id}`}>${custRefunded.toFixed(2)}</div>
                            </div>
                            <div className="p-2 rounded-md bg-muted/40">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Subscriptions</div>
                              <div className="text-sm font-bold text-foreground">{custSubs.length}</div>
                            </div>
                            <div className="p-2 rounded-md bg-muted/40">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Invoices</div>
                              <div className="text-sm font-bold text-foreground">{custInvoices.length}</div>
                            </div>
                          </div>

                          {custSubs.length > 0 && (
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <RefreshCw className="h-3.5 w-3.5" />
                                Subscriptions
                              </h4>
                              {custSubs.map((sub) => (
                                <div key={sub.id} className="p-2.5 rounded-md border bg-muted/20 space-y-1" data-testid={`card-subscription-${sub.id}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <StripeStatusBadge status={sub.status} />
                                      <span className="text-[10px] text-muted-foreground font-mono">{sub.id}</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">{formatDate(sub.created)}</span>
                                  </div>
                                  {sub.items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between text-xs">
                                      <span className="text-foreground">{item.productName}</span>
                                      <span className="font-medium">${item.amount.toFixed(2)} {item.currency}/{item.interval}</span>
                                    </div>
                                  ))}
                                  <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                                    <span>Period: {formatDate(sub.currentPeriodStart)} — {formatDate(sub.currentPeriodEnd)}</span>
                                    {sub.canceledAt && <span className="text-red-500">Canceled {formatDate(sub.canceledAt)}</span>}
                                    {sub.cancelAtPeriodEnd && <span className="text-orange-500">Cancels at period end</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {custIntents.length > 0 && (
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <CreditCard className="h-3.5 w-3.5" />
                                Payment Intents ({custIntents.length})
                              </h4>
                              <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-muted/50">
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Date</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Amount</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Status</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Description</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">ID</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {custIntents.map((pi) => {
                                      const displayStatus = pi.lastError && pi.status !== "succeeded" ? "failed" : pi.status;
                                      const isExpanded = expandedPiId === pi.id;
                                      return (
                                        <Fragment key={pi.id}>
                                          <tr
                                            className="border-t hover:bg-muted/30 cursor-pointer"
                                            onClick={() => setExpandedPiId(isExpanded ? null : pi.id)}
                                            data-testid={`row-intent-${pi.id}`}
                                          >
                                            <td className="px-2.5 py-1.5 whitespace-nowrap">{formatDateTime(pi.created)}</td>
                                            <td className="px-2.5 py-1.5 whitespace-nowrap">
                                              <span className="font-medium">${pi.amount.toFixed(2)}</span>
                                              <span className="text-muted-foreground ml-0.5">{pi.currency}</span>
                                            </td>
                                            <td className="px-2.5 py-1.5">
                                              <StripeStatusBadge status={displayStatus} />
                                            </td>
                                            <td className="px-2.5 py-1.5 text-muted-foreground max-w-[150px] truncate">{pi.description || "—"}</td>
                                            <td className="px-2.5 py-1.5 text-muted-foreground font-mono text-[10px]">
                                              <div className="flex items-center gap-1">
                                                {pi.id.slice(0, 20)}...
                                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                              </div>
                                            </td>
                                          </tr>
                                          {isExpanded && (
                                            <tr>
                                              <td colSpan={5} className="bg-muted/20 border-t">
                                                <PIActivityTimeline piId={pi.id} />
                                              </td>
                                            </tr>
                                          )}
                                        </Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {custPayments.length > 0 && (
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <DollarSign className="h-3.5 w-3.5" />
                                Charges ({custPayments.length})
                              </h4>
                              <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-muted/50">
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Date</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Amount</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Status</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Description</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Method</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {custPayments.map((payment) => (
                                      <tr key={payment.id} className="border-t hover:bg-muted/30" data-testid={`row-payment-${payment.id}`}>
                                        <td className="px-2.5 py-1.5 whitespace-nowrap">{formatDateTime(payment.created)}</td>
                                        <td className="px-2.5 py-1.5 whitespace-nowrap">
                                          <span className={`font-medium ${payment.status === "succeeded" ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
                                            ${payment.amount.toFixed(2)}
                                          </span>
                                          <span className="text-muted-foreground ml-0.5">{payment.currency}</span>
                                          {payment.refunded && (
                                            <span className="text-red-500 ml-1">(−${payment.refundAmount.toFixed(2)})</span>
                                          )}
                                        </td>
                                        <td className="px-2.5 py-1.5">
                                          <div className="flex flex-wrap gap-1">
                                            <StripeStatusBadge status={payment.status} />
                                            {payment.disputed && <StripeStatusBadge status="disputed" />}
                                          </div>
                                        </td>
                                        <td className="px-2.5 py-1.5 text-muted-foreground max-w-[150px] truncate">{payment.description || "—"}</td>
                                        <td className="px-2.5 py-1.5 text-muted-foreground capitalize">{payment.paymentMethod}</td>
                                        <td className="px-2.5 py-1.5">
                                          {payment.receiptUrl && (
                                            <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" data-testid={`link-receipt-${payment.id}`}>
                                              <ExternalLink className="h-3 w-3" />
                                            </a>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {custInvoices.length > 0 && (
                            <div className="space-y-1.5">
                              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <ExternalLink className="h-3.5 w-3.5" />
                                Invoices ({custInvoices.length})
                              </h4>
                              <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-muted/50">
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Date</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Invoice #</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Due</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Paid</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Status</th>
                                      <th className="text-left px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {custInvoices.map((inv) => (
                                      <tr key={inv.id} className="border-t hover:bg-muted/30" data-testid={`row-invoice-${inv.id}`}>
                                        <td className="px-2.5 py-1.5 whitespace-nowrap">{formatDate(inv.created)}</td>
                                        <td className="px-2.5 py-1.5 text-muted-foreground font-mono">{inv.number || "—"}</td>
                                        <td className="px-2.5 py-1.5 whitespace-nowrap font-medium">${inv.amountDue.toFixed(2)} {inv.currency}</td>
                                        <td className="px-2.5 py-1.5 whitespace-nowrap text-green-600 dark:text-green-400 font-medium">${inv.amountPaid.toFixed(2)}</td>
                                        <td className="px-2.5 py-1.5"><StripeStatusBadge status={inv.status} /></td>
                                        <td className="px-2.5 py-1.5 flex gap-1">
                                          {inv.hostedUrl && (
                                            <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" title="View Invoice" data-testid={`link-invoice-${inv.id}`}>
                                              <ExternalLink className="h-3 w-3" />
                                            </a>
                                          )}
                                          {inv.pdfUrl && (
                                            <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" title="Download PDF" data-testid={`link-pdf-${inv.id}`}>
                                              <ArrowDownCircle className="h-3 w-3" />
                                            </a>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {custPayments.length === 0 && custIntents.length === 0 && custSubs.length === 0 && custInvoices.length === 0 && (
                            <p className="text-xs text-muted-foreground italic py-2">No payment data found for this customer.</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
