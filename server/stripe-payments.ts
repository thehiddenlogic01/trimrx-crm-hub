import Stripe from "stripe";
import { type Express, type Request, type Response, type NextFunction } from "express";
import { storage } from "./storage";

function formatEventDescription(event: any): string {
  const obj = event.data?.object;
  const amount = obj?.amount ? `$${(obj.amount / 100).toFixed(2)}` : "";
  switch (event.type) {
    case "charge.succeeded": return `${obj?.id}'s payment was captured for ${amount}`;
    case "charge.failed": return `The charge ${obj?.id} for ${amount} has failed`;
    case "charge.captured": return `${obj?.id}'s payment was captured for ${amount}`;
    case "charge.refunded": return `${obj?.id} was refunded for ${amount}`;
    case "charge.dispute.created": return `A dispute ${obj?.id} has been opened for ${amount}`;
    case "charge.dispute.closed": return `The dispute ${obj?.id} has been closed`;
    case "charge.dispute.updated": return `The dispute ${obj?.id} has been updated`;
    case "charge.updated": return `The charge ${obj?.id} was updated`;
    case "payment_intent.created": return `A new payment for ${amount} was created for ${obj?.id}`;
    case "payment_intent.succeeded": return `The payment ${obj?.id} for ${amount} has succeeded`;
    case "payment_intent.payment_failed": return `The payment ${obj?.id} for ${amount} has failed`;
    case "payment_intent.amount_capturable_updated": return `The amount_capturable for payment ${obj?.id} was updated`;
    default: return `${event.type} for ${obj?.id || "unknown"}`;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

let manualStripeClient: Stripe | null = null;

async function getStripeCredentialsFromReplit(): Promise<string | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) return null;

  try {
    const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
    const targetEnvironment = isProduction ? "production" : "development";

    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set("include_secrets", "true");
    url.searchParams.set("connector_names", "stripe");
    url.searchParams.set("environment", targetEnvironment);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    });

    const data = await response.json();
    const connection = data.items?.[0];
    if (!connection?.settings?.secret) return null;
    return connection.settings.secret;
  } catch {
    return null;
  }
}

async function getStripeClient(): Promise<Stripe | null> {
  const replitKey = await getStripeCredentialsFromReplit();
  if (replitKey) {
    return new Stripe(replitKey, { apiVersion: "2025-02-24.acacia" as any });
  }

  const manualKey = await storage.getSetting("stripe_secret_key");
  if (manualKey) {
    if (!manualStripeClient) {
      manualStripeClient = new Stripe(manualKey, { apiVersion: "2025-02-24.acacia" as any });
    }
    return manualStripeClient;
  }

  return null;
}

async function isConnected(): Promise<{ connected: boolean; source: string }> {
  const replitKey = await getStripeCredentialsFromReplit();
  if (replitKey) return { connected: true, source: "integration" };

  const manualKey = await storage.getSetting("stripe_secret_key");
  if (manualKey) return { connected: true, source: "api_key" };

  return { connected: false, source: "none" };
}

export function registerStripePaymentRoutes(app: Express) {
  app.get("/api/stripe-payments/status", requireAuth, async (_req, res) => {
    const status = await isConnected();
    res.json(status);
  });

  app.post("/api/stripe-payments/connect", requireAuth, async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== "string") {
      return res.status(400).json({ message: "API key is required" });
    }
    try {
      const testClient = new Stripe(apiKey, { apiVersion: "2025-02-24.acacia" as any });
      await testClient.customers.list({ limit: 1 });
      await storage.setSetting("stripe_secret_key", apiKey);
      manualStripeClient = testClient;
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: "Invalid API key: " + (err.message || "Connection failed") });
    }
  });

  app.post("/api/stripe-payments/disconnect", requireAuth, async (_req, res) => {
    await storage.setSetting("stripe_secret_key", "");
    manualStripeClient = null;
    res.json({ success: true });
  });

  app.post("/api/stripe-payments/search", requireAuth, async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required" });
    }

    const stripe = await getStripeClient();
    if (!stripe) {
      return res.status(400).json({ message: "Stripe is not connected. Add your API key in Settings." });
    }

    try {
      const customers = await stripe.customers.list({ email: email.trim().toLowerCase(), limit: 10 });

      if (customers.data.length === 0) {
        return res.json({ customers: [], payments: [], subscriptions: [] });
      }

      const customerIds = customers.data.map((c) => c.id);
      const allPayments: any[] = [];
      const allSubscriptions: any[] = [];
      const allPaymentIntents: any[] = [];
      const allInvoices: any[] = [];
      const allDisputes: any[] = [];

      for (const custId of customerIds) {
        const [charges, subs, paymentIntents, invoices] = await Promise.all([
          stripe.charges.list({ customer: custId, limit: 50 }),
          stripe.subscriptions.list({ customer: custId, limit: 20, status: "all" }),
          stripe.paymentIntents.list({ customer: custId, limit: 50 }),
          stripe.invoices.list({ customer: custId, limit: 50 }),
        ]);

        const disputedCharges = charges.data.filter((ch) => ch.disputed && ch.dispute);
        for (const ch of disputedCharges) {
          try {
            const disputeId = typeof ch.dispute === "string" ? ch.dispute : (ch.dispute as any)?.id;
            if (disputeId) {
              const d = await stripe.disputes.retrieve(disputeId);
              allDisputes.push({
                id: d.id,
                chargeId: ch.id,
                amount: d.amount / 100,
                currency: d.currency.toUpperCase(),
                status: d.status,
                reason: d.reason || "unknown",
                created: d.created * 1000,
                evidenceDueBy: d.evidence_details?.due_by ? d.evidence_details.due_by * 1000 : null,
                isChargeRefundable: d.is_charge_refundable,
                customerId: custId,
              });
            }
          } catch (e) {
            // skip if dispute retrieval fails
          }
        }

        for (const ch of charges.data) {
          allPayments.push({
            id: ch.id,
            amount: ch.amount / 100,
            currency: ch.currency.toUpperCase(),
            status: ch.status,
            description: ch.description || "",
            created: ch.created * 1000,
            refunded: ch.refunded,
            refundAmount: (ch.amount_refunded || 0) / 100,
            paymentMethod: ch.payment_method_details?.type || "unknown",
            receiptUrl: ch.receipt_url || null,
            disputed: ch.disputed || false,
            customerId: custId,
          });
        }

        for (const pi of paymentIntents.data) {
          allPaymentIntents.push({
            id: pi.id,
            amount: pi.amount / 100,
            currency: pi.currency.toUpperCase(),
            status: pi.status,
            description: pi.description || "",
            created: pi.created * 1000,
            paymentMethod: typeof pi.payment_method === "string" ? pi.payment_method : (pi.payment_method as any)?.type || "—",
            lastError: pi.last_payment_error?.message || null,
            customerId: custId,
          });
        }

        for (const inv of invoices.data) {
          allInvoices.push({
            id: inv.id,
            number: inv.number || "",
            status: inv.status || "draft",
            amountDue: (inv.amount_due || 0) / 100,
            amountPaid: (inv.amount_paid || 0) / 100,
            currency: (inv.currency || "usd").toUpperCase(),
            created: inv.created * 1000,
            periodStart: inv.period_start ? inv.period_start * 1000 : null,
            periodEnd: inv.period_end ? inv.period_end * 1000 : null,
            hostedUrl: inv.hosted_invoice_url || null,
            pdfUrl: inv.invoice_pdf || null,
            subscriptionId: typeof inv.subscription === "string" ? inv.subscription : null,
            customerId: custId,
          });
        }

        for (const sub of subs.data) {
          allSubscriptions.push({
            id: sub.id,
            status: sub.status,
            created: sub.created * 1000,
            currentPeriodStart: (sub as any).current_period_start * 1000,
            currentPeriodEnd: (sub as any).current_period_end * 1000,
            canceledAt: sub.canceled_at ? sub.canceled_at * 1000 : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            items: sub.items.data.map((item) => ({
              id: item.id,
              priceId: item.price.id,
              amount: (item.price.unit_amount || 0) / 100,
              currency: (item.price.currency || "usd").toUpperCase(),
              interval: item.price.recurring?.interval || "one-time",
              productName: typeof item.price.product === "string" ? item.price.product : (item.price.product as any)?.name || "Unknown",
            })),
            customerId: custId,
          });
        }
      }

      const mappedCustomers = customers.data.map((c) => ({
        id: c.id,
        name: c.name || "",
        email: c.email || "",
        phone: c.phone || "",
        created: c.created * 1000,
        currency: (c.currency || "usd").toUpperCase(),
        balance: (c.balance || 0) / 100,
        metadata: c.metadata || {},
      }));

      allPayments.sort((a, b) => b.created - a.created);
      allPaymentIntents.sort((a, b) => b.created - a.created);
      allInvoices.sort((a, b) => b.created - a.created);
      allDisputes.sort((a, b) => b.created - a.created);

      res.json({
        customers: mappedCustomers,
        payments: allPayments,
        paymentIntents: allPaymentIntents,
        subscriptions: allSubscriptions,
        invoices: allInvoices,
        disputes: allDisputes,
      });
    } catch (err: any) {
      console.error("Stripe search error:", err);
      res.status(500).json({ message: err.message || "Stripe API error" });
    }
  });

  app.post("/api/stripe-payments/charge-details", requireAuth, async (req, res) => {
    const { chargeId } = req.body;
    if (!chargeId || typeof chargeId !== "string") {
      return res.status(400).json({ message: "Charge ID is required" });
    }

    const stripe = await getStripeClient();
    if (!stripe) {
      return res.status(400).json({ message: "Stripe is not connected" });
    }

    try {
      const charge = await stripe.charges.retrieve(chargeId, {
        expand: ["balance_transaction", "customer", "dispute", "payment_intent"],
      });

      const customer = typeof charge.customer === "object" && charge.customer ? charge.customer : null;
      const bt = typeof charge.balance_transaction === "object" && charge.balance_transaction ? charge.balance_transaction : null;
      const dispute = typeof charge.dispute === "object" && charge.dispute ? charge.dispute : null;
      const pi = typeof charge.payment_intent === "object" && charge.payment_intent ? charge.payment_intent : null;

      let events: any[] = [];
      try {
        const eventsResult = await stripe.events.list({
          limit: 100,
          created: { gte: charge.created - 86400 },
          types: [
            "charge.succeeded", "charge.failed", "charge.captured", "charge.refunded",
            "charge.dispute.created", "charge.dispute.closed", "charge.dispute.updated",
            "charge.updated", "payment_intent.created", "payment_intent.succeeded",
            "payment_intent.payment_failed", "payment_intent.amount_capturable_updated",
          ],
        });
        const relatedEvents = eventsResult.data.filter((ev) => {
          const obj = ev.data?.object as any;
          return obj?.id === chargeId ||
            obj?.payment_intent === (pi?.id || (typeof charge.payment_intent === "string" ? charge.payment_intent : null)) ||
            (obj?.charge && (obj.charge === chargeId || obj.charge?.id === chargeId));
        });
        events = relatedEvents.map((ev) => ({
          id: ev.id,
          type: ev.type,
          created: ev.created * 1000,
          description: formatEventDescription(ev),
        }));
      } catch (e) {
        // events list may fail, continue
      }

      const pmd = charge.payment_method_details;
      const cardDetails = pmd?.card ? {
        brand: pmd.card.brand || "",
        last4: pmd.card.last4 || "",
        expMonth: pmd.card.exp_month || 0,
        expYear: pmd.card.exp_year || 0,
        fingerprint: pmd.card.fingerprint || "",
        funding: pmd.card.funding || "",
        country: pmd.card.country || "",
        network: pmd.card.network || "",
        cvcCheck: (pmd.card.checks as any)?.cvc_check || null,
        addressLine1Check: (pmd.card.checks as any)?.address_line1_check || null,
        addressPostalCodeCheck: (pmd.card.checks as any)?.address_postal_code_check || null,
      } : null;

      const result = {
        id: charge.id,
        amount: charge.amount / 100,
        amountRefunded: (charge.amount_refunded || 0) / 100,
        currency: charge.currency.toUpperCase(),
        status: charge.status,
        disputed: charge.disputed || false,
        refunded: charge.refunded,
        captured: charge.captured,
        description: charge.description || "",
        statementDescriptor: charge.statement_descriptor || charge.statement_descriptor_suffix || "",
        created: charge.created * 1000,
        receiptUrl: charge.receipt_url || null,
        receiptEmail: charge.receipt_email || "",
        paymentMethodType: pmd?.type || "unknown",
        paymentMethodId: typeof charge.payment_method === "string" ? charge.payment_method : "",
        card: cardDetails,
        billingDetails: charge.billing_details ? {
          name: charge.billing_details.name || "",
          email: charge.billing_details.email || "",
          phone: charge.billing_details.phone || "",
          address: charge.billing_details.address ? {
            line1: charge.billing_details.address.line1 || "",
            line2: charge.billing_details.address.line2 || "",
            city: charge.billing_details.address.city || "",
            state: charge.billing_details.address.state || "",
            postalCode: charge.billing_details.address.postal_code || "",
            country: charge.billing_details.address.country || "",
          } : null,
        } : null,
        customer: customer ? {
          id: (customer as any).id || "",
          name: (customer as any).name || "",
          email: (customer as any).email || "",
          phone: (customer as any).phone || "",
          description: (customer as any).description || "",
          metadata: (customer as any).metadata || {},
        } : null,
        balanceTransaction: bt ? {
          id: (bt as any).id || "",
          amount: ((bt as any).amount || 0) / 100,
          fee: ((bt as any).fee || 0) / 100,
          net: ((bt as any).net || 0) / 100,
          currency: ((bt as any).currency || "usd").toUpperCase(),
          availableOn: (bt as any).available_on ? (bt as any).available_on * 1000 : null,
          feeDetails: ((bt as any).fee_details || []).map((fd: any) => ({
            amount: (fd.amount || 0) / 100,
            currency: (fd.currency || "usd").toUpperCase(),
            description: fd.description || "",
            type: fd.type || "",
          })),
        } : null,
        dispute: dispute ? {
          id: (dispute as any).id || "",
          amount: ((dispute as any).amount || 0) / 100,
          currency: ((dispute as any).currency || "usd").toUpperCase(),
          status: (dispute as any).status || "",
          reason: (dispute as any).reason || "",
          networkReasonCode: (dispute as any).network_reason_code || "",
          created: (dispute as any).created ? (dispute as any).created * 1000 : 0,
          evidenceDueBy: (dispute as any).evidence_details?.due_by ? (dispute as any).evidence_details.due_by * 1000 : null,
          isChargeRefundable: (dispute as any).is_charge_refundable || false,
        } : null,
        paymentIntent: pi ? {
          id: (pi as any).id || "",
          status: (pi as any).status || "",
          created: (pi as any).created ? (pi as any).created * 1000 : 0,
        } : null,
        outcome: charge.outcome ? {
          networkStatus: charge.outcome.network_status || "",
          riskLevel: charge.outcome.risk_level || "",
          riskScore: charge.outcome.risk_score ?? null,
          sellerMessage: charge.outcome.seller_message || "",
          type: charge.outcome.type || "",
        } : null,
        metadata: charge.metadata || {},
        events,
      };

      res.json(result);
    } catch (err: any) {
      console.error("Stripe charge details error:", err);
      res.status(500).json({ message: err.message || "Failed to fetch charge details" });
    }
  });

  app.get("/api/stripe-payments/pi-activity/:id", requireAuth, async (req, res) => {
    const piId = req.params.id;
    if (!piId || !piId.startsWith("pi_")) {
      return res.status(400).json({ message: "Valid payment intent ID is required" });
    }

    const stripe = await getStripeClient();
    if (!stripe) {
      return res.status(400).json({ message: "Stripe is not connected" });
    }

    try {
      const pi = await stripe.paymentIntents.retrieve(piId);

      const charges = await stripe.charges.list({ payment_intent: piId, limit: 20 });

      const timeline: Array<{ type: string; title: string; description: string; timestamp: number; icon: string }> = [];

      timeline.push({
        type: "created",
        title: "Payment started",
        description: "",
        timestamp: pi.created * 1000,
        icon: "clock",
      });

      let latestChargeTime = pi.created * 1000;

      for (const charge of charges.data) {
        const chargeTime = charge.created * 1000;
        if (chargeTime > latestChargeTime) latestChargeTime = chargeTime;

        if (charge.status === "succeeded") {
          timeline.push({
            type: "succeeded",
            title: "Payment succeeded",
            description: charge.outcome?.seller_message || "",
            timestamp: chargeTime,
            icon: "check",
          });
        }
        if (charge.status === "failed") {
          timeline.push({
            type: "failed",
            title: "Payment failed",
            description: charge.failure_message || charge.outcome?.seller_message || "",
            timestamp: chargeTime,
            icon: "x",
          });
        }
        if (charge.refunded && charge.refunds?.data?.length) {
          for (const refund of charge.refunds.data) {
            timeline.push({
              type: "refunded",
              title: "Payment refunded",
              description: `$${(refund.amount / 100).toFixed(2)} ${refund.currency.toUpperCase()} refunded`,
              timestamp: refund.created * 1000,
              icon: "refund",
            });
          }
        } else if (charge.refunded) {
          timeline.push({
            type: "refunded",
            title: "Payment refunded",
            description: `$${(charge.amount_refunded / 100).toFixed(2)} ${charge.currency.toUpperCase()} refunded`,
            timestamp: chargeTime + 1000,
            icon: "refund",
          });
        }
        if (charge.disputed) {
          const disputeTime = typeof charge.dispute === "object" && charge.dispute
            ? ((charge.dispute as any).created * 1000)
            : chargeTime + 2000;
          timeline.push({
            type: "disputed",
            title: "Dispute opened",
            description: "",
            timestamp: disputeTime,
            icon: "alert",
          });
        }
      }

      const statusTime = latestChargeTime + 1;

      if (pi.last_payment_error) {
        const err = pi.last_payment_error;
        let title = "Payment error";
        let description = err.message || "";
        let icon = "alert";

        if (err.code === "authentication_required" || pi.status === "requires_action") {
          title = "3D Secure attempt incomplete";
          description = "The cardholder began 3D Secure authentication but has not completed it.";
          icon = "alert";
        } else if (err.code === "card_declined") {
          title = "Card declined";
          description = err.decline_code
            ? `Decline reason: ${err.decline_code.replace(/_/g, " ")}`
            : (err.message || "");
          icon = "x";
        }

        const alreadyHasError = timeline.some(t => t.type === "failed");
        if (!alreadyHasError) {
          timeline.push({
            type: "error",
            title,
            description,
            timestamp: statusTime,
            icon,
          });
        }
      } else if (pi.status === "requires_action") {
        timeline.push({
          type: "requires_action",
          title: "3D Secure attempt incomplete",
          description: "The cardholder began 3D Secure authentication but has not completed it.",
          timestamp: statusTime,
          icon: "alert",
        });
      } else if (pi.status === "requires_payment_method") {
        const hasChargeFailure = timeline.some(t => t.type === "failed");
        if (!hasChargeFailure) {
          timeline.push({
            type: "incomplete",
            title: "Awaiting payment method",
            description: "The customer has not yet provided a payment method.",
            timestamp: statusTime,
            icon: "clock",
          });
        }
      } else if (pi.status === "requires_confirmation") {
        timeline.push({
          type: "incomplete",
          title: "Awaiting confirmation",
          description: "The payment intent requires confirmation.",
          timestamp: statusTime,
          icon: "clock",
        });
      } else if (pi.status === "canceled") {
        timeline.push({
          type: "canceled",
          title: "Payment canceled",
          description: pi.cancellation_reason ? `Reason: ${pi.cancellation_reason.replace(/_/g, " ")}` : "",
          timestamp: statusTime,
          icon: "x",
        });
      } else if (pi.status === "processing") {
        timeline.push({
          type: "processing",
          title: "Payment processing",
          description: "The payment is being processed.",
          timestamp: statusTime,
          icon: "clock",
        });
      }

      timeline.sort((a, b) => b.timestamp - a.timestamp);

      res.json({ activity: timeline });
    } catch (err: any) {
      console.error("Stripe PI activity error:", err);
      res.status(500).json({ message: err.message || "Failed to fetch payment intent activity" });
    }
  });

  app.post("/api/stripe-payments/lookup-by-case", requireAuth, async (req, res) => {
    const { caseLink, caseId } = req.body;
    if (!caseLink && !caseId) {
      return res.status(400).json({ message: "Case link or case ID is required" });
    }

    const stripe = await getStripeClient();
    if (!stripe) {
      return res.status(400).json({ message: "Stripe is not connected" });
    }

    try {
      let email: string | null = null;
      let source = "";

      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");

      if (caseLink) {
        const result = await db.execute(
          sql`SELECT customer_email FROM cv_reports WHERE link ILIKE ${'%' + caseLink + '%'} AND customer_email != '' LIMIT 1`
        );
        if (result.rows.length > 0 && result.rows[0].customer_email) {
          email = result.rows[0].customer_email as string;
          source = "CV Report";
        }
      }

      if (!email && caseId) {
        const normalizedId = caseId.trim().toUpperCase();
        const result = await db.execute(
          sql`SELECT customer_email FROM cv_reports WHERE UPPER(TRIM(case_id)) = ${normalizedId} AND customer_email != '' LIMIT 1`
        );
        if (result.rows.length > 0 && result.rows[0].customer_email) {
          email = result.rows[0].customer_email as string;
          source = "CV Report";
        }
      }

      if (!email) {
        try {
          const baseUrl = `${req.protocol}://${req.get("host")}`;
          const searchTerms: string[] = [];
          if (caseId) searchTerms.push(caseId);
          if (caseLink) {
            const uuidMatch = caseLink.match(/\/cases\/([0-9a-f-]{36})/i);
            if (uuidMatch) searchTerms.push(uuidMatch[1]);
          }

          for (const term of searchTerms) {
            if (email) break;
            try {
              const ptRes = await fetch(`${baseUrl}/api/pt-finder/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
                body: JSON.stringify({ query: term }),
              });
              if (ptRes.ok) {
                const ptData = await ptRes.json();
                if (ptData.results && ptData.results.length > 0) {
                  const row = ptData.results[0];
                  const emailKey = Object.keys(row).find((k) => k.toLowerCase().includes("email"));
                  if (emailKey && row[emailKey]) {
                    email = row[emailKey];
                    source = "PT Finder";
                  }
                }
              }
            } catch {}
          }
        } catch {
        }
      }

      if (!email && caseLink) {
        try {
          const uuidMatch = caseLink.match(/\/cases\/([0-9a-f-]{36})/i);
          if (uuidMatch) {
            const cvToken = await storage.getSetting("carevalidate_token");
            if (cvToken) {
              const graphqlUrl = process.env.CAREVALIDATE_GRAPHQL_URL || "https://api.care360-next.carevalidate.com/graphql/";
              const cvRes = await fetch(graphqlUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${cvToken}` },
                body: JSON.stringify({
                  query: `query CaseByIdQuery($caseId: String) { caseById(caseId: $caseId) { submitter { email } } }`,
                  variables: { caseId: uuidMatch[1] },
                }),
              });
              if (cvRes.ok) {
                const cvData = await cvRes.json();
                const cvEmail = cvData?.data?.caseById?.submitter?.email;
                if (cvEmail) {
                  email = cvEmail;
                  source = "CareValidate";
                }
              }
            }
          }
        } catch {}
      }

      if (!email) {
        return res.json({ found: false, message: "No email found for this case in CV Report, PT Finder, or CareValidate" });
      }

      const customers = await stripe.customers.list({ email: email.trim().toLowerCase(), limit: 5 });
      if (customers.data.length === 0) {
        return res.json({ found: true, email, source, customers: [], paymentIntents: [], subscriptions: [] });
      }

      const allIntents: any[] = [];
      const allSubs: any[] = [];

      for (const cust of customers.data) {
        const [intents, subs] = await Promise.all([
          stripe.paymentIntents.list({ customer: cust.id, limit: 50, expand: ["data.latest_charge"] } as any),
          stripe.subscriptions.list({ customer: cust.id, limit: 20, status: "all" }),
        ]);

        for (const pi of intents.data) {
          const charge = (pi as any).latest_charge as any;
          const refunded = charge?.refunded || false;
          const amountRefunded = refunded ? ((charge?.amount_refunded || 0) / 100) : 0;
          const disputed = charge?.disputed || false;
          allIntents.push({
            id: pi.id,
            amount: pi.amount / 100,
            currency: pi.currency.toUpperCase(),
            status: pi.status,
            refunded,
            amountRefunded,
            disputed,
            description: pi.description || "",
            created: pi.created * 1000,
            lastError: pi.last_payment_error?.message || null,
          });
        }

        for (const sub of subs.data) {
          allSubs.push({
            id: sub.id,
            status: sub.status,
            created: sub.created * 1000,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodEnd: sub.current_period_end ? sub.current_period_end * 1000 : null,
            items: sub.items.data.map((item) => ({
              amount: (item.price.unit_amount || 0) / 100,
              currency: (item.price.currency || "usd").toUpperCase(),
              interval: item.price.recurring?.interval || "one-time",
              productName: typeof item.price.product === "string" ? item.price.product : (item.price.product as any)?.name || "Unknown",
            })),
          });
        }
      }

      allIntents.sort((a, b) => b.created - a.created);

      const mappedCustomers = customers.data.map((c) => ({
        id: c.id,
        name: c.name || "",
        email: c.email || "",
      }));

      res.json({
        found: true,
        email,
        source,
        customers: mappedCustomers,
        paymentIntents: allIntents,
        subscriptions: allSubs,
      });
    } catch (err: any) {
      console.error("Stripe case lookup error:", err);
      res.status(500).json({ message: err.message || "Stripe API error" });
    }
  });
}
