import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Trash2, Send, ArrowLeft, ChevronDown, ChevronUp, ArrowRight, Upload, FileText, X, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

type DisputeData = {
  id: number;
  customerEmail: string;
  customerPhone: string;
  shippingName: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string;
  shippingAddressCity: string;
  shippingAddressState: string;
  shippingAddressCountry: string;
  shippingAddressPostalCode: string;
  disputedAmount: string;
  disputeDate: string;
  disputeEvidenceDue: string;
  disputeReason: string;
  disputeStatus: string;
  cancellationProcess: string;
  invoiceId: string;
};

const STORAGE_KEY = "stripeSubmitQueue";
const DEFAULT_DESCRIPTION = `TrimRx provides a licensed telemedicine-based GLP-1 medical weight-loss service. Each transaction covers the patient's initial medical intake, provider evaluation, prescription authorization, and pharmacy fulfillment for medications such as Semaglutide or Tirzepatide.
Before payment, patients must accept TrimRx's Terms and Conditions, which clearly state:
"Once the medical intake has been submitted, the order is considered processed and non-refundable, as significant medical and pharmacy resources are utilized, including provider reviews, prescription processing, and shipping logistics."
All transactions are processed through Stripe using AVS, CVV, device fingerprint, and IP verification, ensuring the cardholder's authorization.`;

const WIN_REASONS = [
  { value: "withdrew", label: "The account owner withdrew the dispute" },
  { value: "refunded", label: "The account owner was refunded" },
  { value: "received", label: "The account owner received the product or service" },
  { value: "canceled_covid", label: "The product, service, event or booking was canceled or delayed due to a government order (COVID-19)" },
  { value: "other", label: "Other" },
];

const PRODUCT_TYPES = [
  { value: "physical", label: "Physical product" },
  { value: "digital", label: "Digital product or service" },
  { value: "offline", label: "Offline service" },
  { value: "event", label: "Event" },
  { value: "booking", label: "Booking or reservation" },
  { value: "other", label: "Other" },
];

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia",
  "Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland",
  "Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey",
  "New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina",
  "South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"
];

const EVIDENCE_TYPES = [
  { key: "customerCommunication", label: "Customer communication", recommended: true },
  { key: "customerSignature", label: "Customer signature", recommended: true },
  { key: "shippingDocumentation", label: "Shipping documentation", recommended: true },
  { key: "receipt", label: "Receipt", recommended: false },
  { key: "otherEvidence", label: "Other evidence", recommended: false },
];

function loadQueue(): DisputeData[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: DisputeData[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

type Step1Data = {
  winReason: string;
  description: string;
  productType: string;
};

type EvidenceFiles = Record<string, File | null>;

type Step2Data = {
  additionalInfo: string;
  email: string;
  customerName: string;
  billingCountry: string;
  billingLine1: string;
  billingLine2: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  sameAsBilling: boolean;
  shippingCountry: string;
  shippingLine1: string;
  shippingLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  trackingNumber: string;
  carrier: string;
  shippingDateMM: string;
  shippingDateDD: string;
  shippingDateYYYY: string;
};

function RadioOption({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group" onClick={onClick}>
      <div className="mt-0.5">
        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? "border-primary" : "border-muted-foreground/40 group-hover:border-muted-foreground"}`}>
          {selected && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
        </div>
      </div>
      <span className={`text-sm ${selected ? "font-medium" : ""}`}>{label}</span>
    </label>
  );
}

function Step1Form({ data, onChange, dispute, onNext, onBack }: {
  data: Step1Data;
  onChange: (d: Step1Data) => void;
  dispute: DisputeData;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">STEP 1 OF 2</p>
          <h2 className="text-xl font-bold mt-1" data-testid="text-step1-title">Tell us about the dispute</h2>
          <p className="text-sm text-muted-foreground mt-1">Your responses will help us collect the most relevant evidence to counter the account owner's claim.</p>
          <p className="text-sm text-primary mt-1 underline cursor-pointer">Learn more about evidence submission</p>
        </div>
        <Button variant="outline" onClick={onBack} data-testid="button-back-to-queue">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Queue
        </Button>
      </div>

      <Card className="bg-muted/20">
        <CardContent className="pt-4 pb-2 px-4">
          <p className="text-xs text-muted-foreground">
            Submitting for: <span className="font-medium text-foreground">{dispute.shippingName || dispute.customerEmail}</span>
            {" — "}${dispute.disputedAmount} — {dispute.disputeReason}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <span className="text-muted-foreground">⚖</span> Why should you win this dispute?
        </h3>
        <div className="space-y-2 ml-1">
          {WIN_REASONS.map((r) => (
            <RadioOption key={r.value} selected={data.winReason === r.value} label={r.label} onClick={() => onChange({ ...data, winReason: r.value })} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <span className="text-muted-foreground">⚙</span> Product or service details
        </h3>
        <div className="space-y-2">
          <Label className="text-sm">Description <span className="text-muted-foreground text-xs">ⓘ</span></Label>
          <Textarea value={data.description} onChange={(e) => onChange({ ...data, description: e.target.value })} rows={8} className="text-sm" data-testid="textarea-description" />
        </div>
        <div className="space-y-2 mt-4">
          <p className="text-sm font-medium">What type of product or service is this?</p>
          <div className="space-y-2 ml-1">
            {PRODUCT_TYPES.map((t) => (
              <RadioOption key={t.value} selected={data.productType === t.value} label={t.label} onClick={() => onChange({ ...data, productType: t.value })} />
            ))}
          </div>
        </div>
      </div>

      <div className="pt-2">
        <Button size="lg" className="w-full" onClick={onNext} data-testid="button-next-step">
          Next <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function Step2Form({ data, onChange, evidenceFiles, onFileChange, dispute, onBack, onSubmit }: {
  data: Step2Data;
  onChange: (d: Step2Data) => void;
  evidenceFiles: EvidenceFiles;
  onFileChange: (key: string, file: File | null) => void;
  dispute: DisputeData;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const { can } = usePermissions();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const emptySlot = EVIDENCE_TYPES.find((t) => !evidenceFiles[t.key]);
      if (emptySlot) onFileChange(emptySlot.key, file);
    }
  };

  const shippingData = data.sameAsBilling
    ? { country: data.billingCountry, line1: data.billingLine1, line2: data.billingLine2, city: data.billingCity, state: data.billingState, zip: data.billingZip }
    : { country: data.shippingCountry, line1: data.shippingLine1, line2: data.shippingLine2, city: data.shippingCity, state: data.shippingState, zip: data.shippingZip };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">STEP 2 OF 2</p>
          <h2 className="text-xl font-bold mt-1" data-testid="text-step2-title">Collect evidence</h2>
          <p className="text-sm text-muted-foreground mt-1">Based on your previous responses, we recommend submitting the following evidence to the account owner's payment facilitator.</p>
        </div>
        <Button variant="outline" onClick={onBack} data-testid="button-back-to-step1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Supporting evidence
        </h3>
        <Card>
          <CardContent className="pt-5 space-y-4">
            <p className="text-sm font-semibold">Upload evidence</p>
            <p className="text-sm text-muted-foreground">
              The following evidence is most relevant to this dispute. If you would like to share other types of evidence not listed below, upload it and label it as "other". <span className="text-primary cursor-pointer underline">Learn best practices for submitting evidence.</span>
            </p>

            <div className="space-y-2">
              {EVIDENCE_TYPES.map((et) => (
                <div key={et.key} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    {evidenceFiles[et.key] ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">{et.label} <span className="text-muted-foreground text-xs">ⓘ</span></span>
                    {et.recommended && <Badge variant="secondary" className="text-xs font-semibold ml-1">Recommended</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {evidenceFiles[et.key] ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground max-w-[150px] truncate">{evidenceFiles[et.key]!.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onFileChange(et.key, null)} data-testid={`button-remove-file-${et.key}`}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => fileInputRefs.current[et.key]?.click()}
                        data-testid={`button-upload-${et.key}`}
                      >
                        <Upload className="h-3 w-3 mr-1" /> Upload
                      </Button>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      ref={(el) => { fileInputRefs.current[et.key] = el; }}
                      onChange={(e) => { if (e.target.files?.[0]) onFileChange(et.key, e.target.files[0]); }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">Upload one file per recommended document (5MB maximum size total).</p>

            <div
              ref={dropZoneRef}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-md p-6 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
              data-testid="dropzone-evidence"
            >
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>Upload from computer</span>
                <span className="text-muted-foreground/50">|</span>
                <span>Drag and drop files.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          + Additional information
        </h3>
        <Textarea
          value={data.additionalInfo}
          onChange={(e) => onChange({ ...data, additionalInfo: e.target.value })}
          rows={3}
          placeholder="Any additional details to support your case..."
          className="text-sm"
          data-testid="textarea-additional-info"
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <span className="text-muted-foreground">👤</span> Customer details
        </h3>

        <div className="space-y-3">
          <div>
            <Label className="text-sm">Email <span className="text-muted-foreground text-xs">ⓘ</span></Label>
            <Input value={data.email} onChange={(e) => onChange({ ...data, email: e.target.value })} className="mt-1" data-testid="input-email" />
          </div>
          <div>
            <Label className="text-sm">Customer name <span className="text-muted-foreground text-xs">ⓘ</span></Label>
            <Input value={data.customerName} onChange={(e) => onChange({ ...data, customerName: e.target.value })} className="mt-1" data-testid="input-customer-name" />
          </div>

          <div>
            <Label className="text-sm">Billing address <span className="text-muted-foreground text-xs">ⓘ</span></Label>
            <div className="space-y-2 mt-1">
              <Select value={data.billingCountry} onValueChange={(v) => onChange({ ...data, billingCountry: v })}>
                <SelectTrigger data-testid="select-billing-country"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="Canada">Canada</SelectItem>
                  <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input value={data.billingLine1} onChange={(e) => onChange({ ...data, billingLine1: e.target.value })} placeholder="Address line 1" data-testid="input-billing-line1" />
              <Input value={data.billingLine2} onChange={(e) => onChange({ ...data, billingLine2: e.target.value })} placeholder="Address line 2" data-testid="input-billing-line2" />
              <Input value={data.billingCity} onChange={(e) => onChange({ ...data, billingCity: e.target.value })} placeholder="City" data-testid="input-billing-city" />
              <Select value={data.billingState} onValueChange={(v) => onChange({ ...data, billingState: v })}>
                <SelectTrigger data-testid="select-billing-state"><SelectValue placeholder="State" /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={data.billingZip} onChange={(e) => onChange({ ...data, billingZip: e.target.value })} placeholder="ZIP (95014)" data-testid="input-billing-zip" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <span className="text-muted-foreground">⚙</span> Product or service details
        </h3>

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Shipping address <span className="text-muted-foreground text-xs">ⓘ</span></Label>
            <span className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">✕ Discard changes</span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Checkbox
              checked={data.sameAsBilling}
              onCheckedChange={(c) => onChange({ ...data, sameAsBilling: !!c })}
              data-testid="checkbox-same-billing"
            />
            <span className="text-sm">Same as billing address</span>
          </div>

          {!data.sameAsBilling && (
            <div className="space-y-2 mt-3">
              <Select value={data.shippingCountry} onValueChange={(v) => onChange({ ...data, shippingCountry: v })}>
                <SelectTrigger data-testid="select-shipping-country"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="Canada">Canada</SelectItem>
                  <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input value={data.shippingLine1} onChange={(e) => onChange({ ...data, shippingLine1: e.target.value })} placeholder="Address line 1" data-testid="input-shipping-line1" />
              <Input value={data.shippingLine2} onChange={(e) => onChange({ ...data, shippingLine2: e.target.value })} placeholder="Address line 2" data-testid="input-shipping-line2" />
              <Input value={data.shippingCity} onChange={(e) => onChange({ ...data, shippingCity: e.target.value })} placeholder="City" data-testid="input-shipping-city" />
              <Select value={data.shippingState} onValueChange={(v) => onChange({ ...data, shippingState: v })}>
                <SelectTrigger data-testid="select-shipping-state"><SelectValue placeholder="State" /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={data.shippingZip} onChange={(e) => onChange({ ...data, shippingZip: e.target.value })} placeholder="ZIP" data-testid="input-shipping-zip" />
            </div>
          )}
        </div>

        <div>
          <Label className="text-sm">Tracking number <span className="text-muted-foreground text-xs">ⓘ</span></Label>
          <div className="flex gap-2 mt-1">
            <Input value={data.trackingNumber} onChange={(e) => onChange({ ...data, trackingNumber: e.target.value })} placeholder="Tracking number" className="flex-1" data-testid="input-tracking" />
            <Input value={data.carrier} onChange={(e) => onChange({ ...data, carrier: e.target.value })} placeholder="Carrier" className="w-[120px]" data-testid="input-carrier" />
          </div>
        </div>

        <div>
          <Label className="text-sm">Shipping date</Label>
          <div className="flex gap-2 mt-1 items-center">
            <Input value={data.shippingDateMM} onChange={(e) => onChange({ ...data, shippingDateMM: e.target.value })} placeholder="MM" className="w-[70px] text-center" maxLength={2} data-testid="input-ship-mm" />
            <span className="text-muted-foreground">/</span>
            <Input value={data.shippingDateDD} onChange={(e) => onChange({ ...data, shippingDateDD: e.target.value })} placeholder="DD" className="w-[70px] text-center" maxLength={2} data-testid="input-ship-dd" />
            <span className="text-muted-foreground">/</span>
            <Input value={data.shippingDateYYYY} onChange={(e) => onChange({ ...data, shippingDateYYYY: e.target.value })} placeholder="YYYY" className="w-[90px] text-center" maxLength={4} data-testid="input-ship-yyyy" />
          </div>
        </div>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm font-semibold">Evidence completion</p>
          <div className="w-full bg-primary/20 rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full" style={{ width: "100%" }} />
          </div>
          <p className="text-sm text-muted-foreground">Your response includes all the relevant pieces of evidence for your dispute challenge and is ready to submit.</p>
          <p className="text-xs text-muted-foreground">Any evidence you provide is saved and automatically submitted when the dispute is due. <span className="text-primary cursor-pointer underline">Disable auto-submit.</span></p>
          <Button size="lg" className="w-full" onClick={onSubmit} disabled={!can("stripe-submit", "submit")} data-testid="button-submit-evidence">
            <Send className="h-4 w-4 mr-2" />
            Submit evidence now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SubmitForm({ dispute, onBack, onSubmitted }: { dispute: DisputeData; onBack: () => void; onSubmitted: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data>({
    winReason: "received",
    description: DEFAULT_DESCRIPTION,
    productType: "physical",
  });
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFiles>({});
  const [step2Data, setStep2Data] = useState<Step2Data>({
    additionalInfo: "",
    email: dispute.customerEmail || "",
    customerName: dispute.shippingName || "",
    billingCountry: dispute.shippingAddressCountry || "United States",
    billingLine1: dispute.shippingAddressLine1 || "",
    billingLine2: dispute.shippingAddressLine2 || "",
    billingCity: dispute.shippingAddressCity || "",
    billingState: dispute.shippingAddressState || "",
    billingZip: dispute.shippingAddressPostalCode || "",
    sameAsBilling: true,
    shippingCountry: dispute.shippingAddressCountry || "United States",
    shippingLine1: dispute.shippingAddressLine1 || "",
    shippingLine2: dispute.shippingAddressLine2 || "",
    shippingCity: dispute.shippingAddressCity || "",
    shippingState: dispute.shippingAddressState || "",
    shippingZip: dispute.shippingAddressPostalCode || "",
    trackingNumber: "",
    carrier: "",
    shippingDateMM: "",
    shippingDateDD: "",
    shippingDateYYYY: "",
  });

  const handleFileChange = (key: string, file: File | null) => {
    setEvidenceFiles((prev) => ({ ...prev, [key]: file }));
  };

  const handleSubmit = () => {
    toast({ title: "Evidence submitted successfully", description: `Dispute evidence for ${dispute.shippingName || dispute.customerEmail} has been submitted.` });
    onSubmitted();
  };

  if (step === 1) {
    return <Step1Form data={step1Data} onChange={setStep1Data} dispute={dispute} onNext={() => setStep(2)} onBack={onBack} />;
  }

  return (
    <Step2Form
      data={step2Data}
      onChange={setStep2Data}
      evidenceFiles={evidenceFiles}
      onFileChange={handleFileChange}
      dispute={dispute}
      onBack={() => setStep(1)}
      onSubmit={handleSubmit}
    />
  );
}

export default function StripeSubmitPage() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const [, setLocation] = useLocation();
  const [queue, setQueue] = useState<DisputeData[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeSubmitId, setActiveSubmitId] = useState<number | null>(null);

  const refreshQueue = useCallback(() => {
    const current = loadQueue();
    const newItem = sessionStorage.getItem("stripeSubmitData");
    if (newItem) {
      try {
        const parsed: DisputeData = JSON.parse(newItem);
        const alreadyExists = current.some((item) => item.id === parsed.id);
        if (!alreadyExists) {
          current.push(parsed);
          saveQueue(current);
          toast({ title: `Dispute #${parsed.id} added to submit queue` });
        } else {
          toast({ title: `Dispute #${parsed.id} is already in the queue` });
        }
      } catch {}
      sessionStorage.removeItem("stripeSubmitData");
    }
    setQueue(current);
  }, [toast]);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  const removeFromQueue = (id: number) => {
    const updated = queue.filter((item) => item.id !== id);
    saveQueue(updated);
    setQueue(updated);
    if (expandedId === id) setExpandedId(null);
    toast({ title: "Removed from queue" });
  };

  const clearQueue = () => {
    if (window.confirm("Clear all items from the submit queue?")) {
      saveQueue([]);
      setQueue([]);
      setExpandedId(null);
      toast({ title: "Queue cleared" });
    }
  };

  const handleSubmitted = () => {
    setActiveSubmitId(null);
  };

  const activeDispute = activeSubmitId ? queue.find((d) => d.id === activeSubmitId) : null;

  if (activeDispute) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <SubmitForm
          dispute={activeDispute}
          onBack={() => setActiveSubmitId(null)}
          onSubmitted={handleSubmitted}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Stripe Submit</h1>
          <p className="text-muted-foreground mt-1">
            {queue.length > 0 ? `${queue.length} dispute(s) ready to submit` : "Submit dispute evidence to Stripe"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation("/trimrx/dispute-report-yedid")} data-testid="button-go-to-reports">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Button>
          {queue.length > 0 && (
            <Button variant="destructive" size="sm" onClick={clearQueue} data-testid="button-clear-queue">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {queue.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <CreditCard className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No disputes in queue</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Go to Dispute Report Yedid and click the Send button on a row to add it here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Submit Queue ({queue.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Dispute Reason</TableHead>
                  <TableHead className="text-xs">Evidence Due</TableHead>
                  <TableHead className="text-xs">Details</TableHead>
                  <TableHead className="text-xs text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((item, idx) => (
                  <>
                    <TableRow key={item.id} data-testid={`row-queue-${item.id}`}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="text-xs font-medium">{item.shippingName || "—"}</TableCell>
                      <TableCell className="text-xs">{item.customerEmail || "—"}</TableCell>
                      <TableCell className="text-xs font-medium">${item.disputedAmount || "—"}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-xs">{item.disputeReason || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{item.disputeEvidenceDue || "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} data-testid={`button-expand-${item.id}`}>
                          {expandedId === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" onClick={() => setActiveSubmitId(item.id)} disabled={!can("stripe-submit", "submit")} data-testid={`button-submit-${item.id}`}>
                                <Send className="h-3 w-3 mr-1" /> Submit
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Submit to Stripe</TooltipContent>
                          </Tooltip>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFromQueue(item.id)} data-testid={`button-remove-queue-${item.id}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === item.id && (
                      <TableRow key={`detail-${item.id}`}>
                        <TableCell colSpan={8} className="bg-muted/30 p-4">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                            <div><span className="font-medium text-muted-foreground">Phone:</span> {item.customerPhone || "—"}</div>
                            <div><span className="font-medium text-muted-foreground">Address:</span> {item.shippingAddressLine1 || "—"}</div>
                            <div><span className="font-medium text-muted-foreground">Line 2:</span> {item.shippingAddressLine2 || "—"}</div>
                            <div><span className="font-medium text-muted-foreground">City:</span> {item.shippingAddressCity || "—"}</div>
                            <div><span className="font-medium text-muted-foreground">State:</span> {item.shippingAddressState || "—"}</div>
                            <div><span className="font-medium text-muted-foreground">Country:</span> {item.shippingAddressCountry || "—"}</div>
                            <div><span className="font-medium text-muted-foreground">Postal Code:</span> {item.shippingAddressPostalCode || "—"}</div>
                            <div><span className="font-medium text-muted-foreground">Dispute Date:</span> {item.disputeDate || "—"}</div>
                            <div><span className="font-medium text-muted-foreground">Dispute Type:</span> {item.disputeStatus || "—"}</div>
                            <div><span className="font-medium text-muted-foreground">Cancellation:</span> {item.cancellationProcess || "—"}</div>
                            <div><span className="font-medium text-muted-foreground">Invoice ID:</span> {item.invoiceId || "—"}</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
