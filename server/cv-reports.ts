import { type Express } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { google } from "googleapis";
import { storage } from "./storage";
import { insertCvReportSchema } from "@shared/schema";
import { carevalidateProgressStore } from "./carevalidate";

const partialCvReportSchema = insertCvReportSchema.partial();

const progressStore: Record<string, { current: number; total: number; stage: string }> = {};

const aiProviderSettingsSchema = z.object({
  providerType: z.enum(["replit", "openai", "gemini", "grok"]).optional(),
  providerEnabled: z.boolean().optional(),
  providerModel: z.string().min(1).max(100).optional(),
  apiKey: z.string().max(500).optional(),
});

async function getAIClient(): Promise<{ client: OpenAI; model: string; providerName: string }> {
  const providerType = await storage.getSetting("ai_provider_type") || "replit";
  const providerEnabled = await storage.getSetting("ai_provider_enabled");
  if (providerEnabled === "false") {
    throw new Error("AI provider is disabled. Enable it in Integrations.");
  }

  if (providerType === "replit") {
    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      throw new Error("Replit AI integration is not configured");
    }
    const model = await storage.getSetting("ai_provider_model") || "gpt-5.2";
    return {
      client: new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      }),
      model,
      providerName: "Replit AI",
    };
  }

  const apiKey = await storage.getSetting("ai_provider_api_key");
  if (!apiKey) {
    throw new Error(`API key not configured for provider: ${providerType}`);
  }
  const model = await storage.getSetting("ai_provider_model") || "gpt-4.1";

  if (providerType === "openai") {
    return {
      client: new OpenAI({ apiKey }),
      model,
      providerName: "OpenAI",
    };
  } else if (providerType === "gemini") {
    return {
      client: new OpenAI({
        apiKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      }),
      model: model || "gemini-2.5-flash",
      providerName: "Google Gemini",
    };
  } else if (providerType === "grok") {
    return {
      client: new OpenAI({
        apiKey,
        baseURL: "https://api.x.ai/v1",
      }),
      model: model || "grok-3",
      providerName: "xAI Grok",
    };
  }

  throw new Error(`Unknown provider type: ${providerType}`);
}

export function setupCvReportRoutes(app: Express) {
  app.get("/api/cv-reports/progress/:taskId", (req, res) => {
    const tid = req.params.taskId;
    const p = progressStore[tid] || carevalidateProgressStore[tid];
    if (!p) return res.json({ current: 0, total: 0, stage: "" });
    return res.json(p);
  });

  app.get("/api/ai-provider/settings", async (_req, res) => {
    try {
      const providerType = await storage.getSetting("ai_provider_type") || "replit";
      const providerEnabled = await storage.getSetting("ai_provider_enabled") !== "false";
      const providerModel = await storage.getSetting("ai_provider_model") || "gpt-5.2";
      const hasCustomKey = !!(await storage.getSetting("ai_provider_api_key"));
      const hasReplitKey = !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const gptEnabled = (await storage.getSetting("custom_gpt_enabled")) !== "false";
      const examplesRaw = await storage.getSetting("custom_gpt_examples");
      let examplesCount = 0;
      try { examplesCount = examplesRaw ? JSON.parse(examplesRaw).length : 0; } catch {}
      const hasInstructions = !!(await storage.getSetting("custom_gpt_instructions"));
      return res.json({
        providerType,
        providerEnabled,
        providerModel,
        hasCustomKey,
        hasReplitKey,
        gptEnabled,
        examplesCount,
        hasInstructions,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/ai-provider/settings", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    if ((req.user as any).role !== "admin") return res.status(403).json({ message: "Admin access required" });
    try {
      const parsed = aiProviderSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid settings", errors: parsed.error.errors });
      }
      const { providerType, providerEnabled, providerModel, apiKey } = parsed.data;
      if (providerType !== undefined) {
        await storage.setSetting("ai_provider_type", providerType);
      }
      if (providerEnabled !== undefined) {
        await storage.setSetting("ai_provider_enabled", String(providerEnabled));
      }
      if (providerModel !== undefined) {
        await storage.setSetting("ai_provider_model", providerModel);
      }
      if (apiKey !== undefined) {
        await storage.setSetting("ai_provider_api_key", apiKey);
      }
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/ai-provider/test", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    if ((req.user as any).role !== "admin") return res.status(403).json({ message: "Admin access required" });
    try {
      const { client: aiClient, model: aiModel, providerName } = await getAIClient();
      const completion = await aiClient.chat.completions.create({
        model: aiModel,
        messages: [
          { role: "system", content: "You are a test assistant. Reply with a short JSON." },
          { role: "user", content: "Reply with: {\"status\": \"ok\", \"provider\": \"<your name>\"}" },
        ],
        max_completion_tokens: 100,
      });
      const text = completion.choices[0]?.message?.content?.trim() || "";
      return res.json({ success: true, response: text, provider: providerName, model: aiModel });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/custom-gpt/settings", async (_req, res) => {
    try {
      const enabled = await storage.getSetting("custom_gpt_enabled");
      const instructions = await storage.getSetting("custom_gpt_instructions");
      const examplesRaw = await storage.getSetting("custom_gpt_examples");
      let examples: any[] = [];
      try { examples = examplesRaw ? JSON.parse(examplesRaw) : []; } catch {}
      res.json({
        enabled: enabled === "true",
        instructions: instructions || "",
        examples,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/custom-gpt/settings", async (req, res) => {
    try {
      const { enabled, instructions, examples } = req.body;
      if (typeof enabled === "boolean") {
        await storage.setSetting("custom_gpt_enabled", String(enabled));
      }
      if (typeof instructions === "string") {
        await storage.setSetting("custom_gpt_instructions", instructions);
      }
      if (Array.isArray(examples)) {
        await storage.setSetting("custom_gpt_examples", JSON.stringify(examples));
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/custom-gpt/analyze", async (req, res) => {
    try {
      const { concern } = req.body;
      if (!concern?.trim()) {
        return res.status(400).json({ message: "Concern text is required" });
      }

      const instructions = await storage.getSetting("custom_gpt_instructions");
      if (!instructions) {
        return res.status(400).json({ message: "No custom GPT instructions configured" });
      }

      const examplesRaw = await storage.getSetting("custom_gpt_examples");
      let allExamples: any[] = [];
      try { allExamples = examplesRaw ? JSON.parse(examplesRaw) : []; } catch {}

      let examplesBlock = "";
      if (allExamples.length > 0) {
        const concernLower = concern.toLowerCase();
        const scored = allExamples.map((ex: any) => {
          const exLower = (ex.concern || "").toLowerCase();
          const concernWords = concernLower.split(/\s+/).filter((w: string) => w.length > 3);
          const matchCount = concernWords.filter((w: string) => exLower.includes(w)).length;
          return { ...ex, score: matchCount };
        });
        scored.sort((a: any, b: any) => b.score - a.score);

        const topExamples = scored.slice(0, 15);

        const reasonCounts: Record<string, number> = {};
        topExamples.forEach((ex: any) => { reasonCounts[ex.reason] = (reasonCounts[ex.reason] || 0) + 1; });
        const underrepresented = allExamples.filter((ex: any) => !topExamples.some((t: any) => t.concern === ex.concern) && (reasonCounts[ex.reason] || 0) < 3);
        const extras = underrepresented.slice(0, 5);
        const finalExamples = [...topExamples, ...extras];

        examplesBlock = "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nREFERENCE EXAMPLES — Use these as ground truth for classification. If a new case is similar to one of these examples, classify it the same way.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
        examplesBlock += finalExamples.map((ex: any, i: number) => {
          const truncatedConcern = (ex.concern || "").length > 200 ? (ex.concern as string).slice(0, 200) + "..." : (ex.concern || "");
          return `Example ${i + 1}:\nConcern: "${truncatedConcern}"\n→ Reason: ${ex.reason}\n→ Sub-Reason: ${ex.subReason}\n→ Desired Action: ${ex.desiredAction}`;
        }).join("\n\n");
      }

      const coreExamples = [
        { concern: "Downgrade and refund needed. 12 months $2999\nRefund amount $2,051", reason: "Uncategorized", subReason: "Other", desiredAction: "Refund" },
        { concern: "Cancel and refund needed. 12 months $2999 (Captured)\nEPC $298\nRefund amount $2,701", reason: "Uncategorized", subReason: "Other", desiredAction: "Refund and Cancel" },
        { concern: "Cancel and Refund\n*EPC* $88\nRefund less EPC $88 Refund amount $860", reason: "Uncategorized", subReason: "Other", desiredAction: "Refund and Cancel" },
        { concern: "Cancellation of NAD+ medication 3 months of supply and Sema 3 months of supply will be retain. Payment is uncaptured. Please assist. Thank you\nRefund amount $531.30", reason: "Uncategorized", subReason: "Other", desiredAction: "Refund and Cancel" },
        { concern: "Refund Zofran (Ondansetron) - 1-Year Plan\n*Refund Amount* $629.30", reason: "Uncategorized", subReason: "Other", desiredAction: "Refund" },
      ];
      const coreBlock = "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCORE EXAMPLES — These are MANDATORY classification rules. Always classify similar cases the same way.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
        coreExamples.map((ex, i) =>
          `Core ${i + 1}:\nConcern: "${ex.concern}"\n→ Reason: ${ex.reason}\n→ Sub-Reason: ${ex.subReason}\n→ Desired Action: ${ex.desiredAction}`
        ).join("\n\n");
      examplesBlock += coreBlock;

      const subReasonDefs = [
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "SUB-REASON DEFINITIONS — Use these exact names and match the definition to the patient's concern.",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        "FINANCIAL & PRICING Sub-Reasons:",
        "  • Competitor Price — Patient found a lower price at a specific competitor (e.g., local pharmacy, Medvi, Ro).",
        "  • Bundle Misunderstanding — Patient was surprised by a large upfront charge (3/6/12 months) instead of a monthly fee.",
        "  • Financial Hardship — Patient can no longer afford the service due to job loss, income change, or financial strain.",
        "  • Month 2 Refill Price — Patient unhappy with the higher refill price after the first month.",
        "  • Insurance Expectation — Patient expected insurance to cover the medication and refuses to pay out-of-pocket.",
        "  • Subscription Misunderstanding — Patient did not realize the purchase renews automatically or is a subscription.",
        "  • Billing Error — Internal billing mistake such as incorrect charge, missed discount, or wrong amount. NO mention of ads or quoted prices being different.",
        "  • Duplicate Payment — Duplicate account creation or duplicate charge/payment.",
        "  • Branded Medication Affordability — Patient wants branded medication but is unwilling to pay the higher price.",
        "  • Promotional Pricing Discrepancy — Patient references an advertised or promotional price that does not match their eligibility or current program pricing. Core complaint = MISMATCH between what was advertised/quoted/promised and what was actually charged.",
        "",
        "CLINICAL & HEALTH Sub-Reasons:",
        "  • Severe Side Effects — Patient experienced strong physical side effects (e.g., extreme nausea, vomiting, pancreatitis concerns).",
        "  • Low Efficacy — Patient feels the medication is not working or weight loss progress is too slow.",
        "  • Goal Reached — Patient achieved target weight and wants to stop or move to maintenance.",
        "  • Medical Concerns — External medical advice or health concerns preventing continuation.",
        "  • Disqualified — Patient was medically disqualified due to contraindications or health history.",
        "  • Injection/Vial Aversion — Patient uncomfortable with needles or drawing medication from a vial.",
        "  • Dosing Issues — Requested dose unavailable or provider unwilling to prescribe requested dose.",
        "",
        "LOGISTICS & SUPPLY Sub-Reasons:",
        "  • Fulfillment Latency — Shipment took longer than promised after payment or shipment not delivered.",
        "  • Order Quality — Medication arrived warm, damaged, or packaging compromised.",
        "  • Carrier Error — Package lost, stolen, or delivered incorrectly by the carrier.",
        "",
        "SUPPORT & UX Sub-Reasons:",
        "  • Consultation Issue — Patient could not meet provider during scheduled telehealth consultation.",
        "  • Support Latency — Patient waited too long for support response (e.g., >48h).",
        "  • Technical UX Issue — Patient unable to use portal, reset password, or complete forms.",
        "  • AI Complaint — Patient complains about AI interaction or AI-generated information.",
        "",
        "UNCATEGORIZED Sub-Reasons:",
        "  • Other — If nothing clearly matches, or is Semorelin, Zofran and NAD confusion. Also use for pure financial processing instructions (refund/cancel with dollar amounts, EPC deductions, plan details) that contain NO patient complaint or dissatisfaction — just operational instructions.",
      ].join("\n");

      const analysisSteps = [
        "Before outputting your answer, you MUST think through EACH step below in order. Write out your reasoning for each step, then output the final JSON at the very end.",
        "",
        "STEP A — RETENTION CHECK: Does the message mention cancellation, refund, or pause? If NO → \"Not for Retention\".",
        "",
        "STEP B — DESIRED ACTION: What specific action did the patient explicitly request? (Cancel only? Refund only? Both? Pause?) Is cancellation already done and only refund remains?",
        "",
        "STEP C — ROOT CAUSE ANALYSIS: What is the UNDERLYING PROBLEM that caused the patient to contact us? This is NOT the action requested (refund/cancel is an action, not a reason). Read the concern carefully and identify the FIRST and PRIMARY complaint the patient expressed. Use the SUB-REASON DEFINITIONS above to find the best match:",
        "",
        "  - Is there an explicit complaint about cost, pricing, billing, or charges being confusing? → Financial & Pricing",
        "  --- IMPORTANT: Distinguish carefully between these Financial & Pricing sub-reasons ---",
        "  - PROMOTIONAL PRICING DISCREPANCY vs BILLING ERROR:",
        "    * Promotional Pricing Discrepancy: Patient saw an ad, promotion, or website showing one price, OR was told a different price by a phone agent, but the actual charge was DIFFERENT (usually higher). Core complaint = MISMATCH between advertised/quoted/promised vs charged. Keywords: \"ad\", \"advertisement\", \"advertised\", \"promotion\", \"quoted\", \"told\", \"misinformed\", \"price transparency\", \"discrepancy\", \"different price\". This applies EVEN IF patient also mentions going elsewhere — the ROOT complaint is the price mismatch.",
        "    * Billing Error: Patient was charged incorrectly through a system/billing mistake — NO mention of ads or quoted prices being different. Just wrong amount, unexpected charge, charged after cancellation.",
        "  - COMPETITOR PRICE vs OTHER: Patient switching to another provider AND explicitly mentions it is cheaper or more affordable there, WITHOUT any complaint about advertised vs actual price discrepancy → Financial & Pricing → Competitor Price",
        "  - Patient switching to another provider/product WITHOUT mentioning cost (e.g., received Wegovy from their doctor, trying something else, going to another pharmacy with no price mention) → Uncategorized → Other. Do NOT classify as Clinical & Health just because a medication name is mentioned.",
        "  - Is there an explicit mention of side effects, medical issues, clinical denial, health concerns? → Clinical & Health (match the specific sub-reason from definitions above)",
        "  - Is there an explicit mention of shipping problems, delivery timing, medication received after cancellation? → Logistics & Supply (match the specific sub-reason)",
        "  - Is there an explicit mention of support delays, portal issues, consultation problems? → Support & UX (match the specific sub-reason)",
        "  - Is the message ONLY a financial processing instruction with dollar amounts, EPC deductions, refund amounts, or plan details (e.g., 'Cancel and refund needed. 12 months $2999. EPC $298. Refund amount $2701') WITHOUT any patient complaint, dissatisfaction, or underlying problem? → Uncategorized → Other. These are operational instructions, NOT patient complaints about pricing/billing.",
        "  - Is the reason NOT stated, unclear, or personal? → Uncategorized → Other",
        "",
        "STEP D — CLIENT THREAT CHECK: Does the patient mention or threaten any of the following?",
        "  - Filing a BBB (Better Business Bureau) complaint or review → \"BBB Review\"",
        "  - Filing a chargeback, dispute, or contacting their bank/credit card company to reverse charges → \"Dispute\"",
        "  - Contacting the Attorney General, filing a legal complaint, or threatening legal action → \"Attorney General\"",
        "  - Leaving a bad review, mentioning Trustpilot, Google reviews, or threatening negative reviews/publicity → \"Trust Pilot Review\"",
        "  - If NONE of the above are mentioned → \"\" (empty string)",
        "",
        "STEP E — VALIDATION: Confirm Primary Reason and Sub-Reason are from the same group (refer to definitions above). Confirm Desired Action matches what patient explicitly asked for. Check if this case is similar to any reference example — if so, match its classification.",
        "",
        "STEP F — CONFIDENCE: Rate how confident you are in the classification from 0 to 100:",
        "  - 100: Absolutely clear-cut, the concern explicitly states the reason (e.g., \"cancel because too expensive\" → Financial & Pricing 100%)",
        "  - 85-99: Very confident, strong indicators present with minimal ambiguity",
        "  - 60-84: Moderately confident, some ambiguity or multiple possible reasons but one is most likely",
        "  - 30-59: Low confidence, the concern is vague, could fit 2-3 categories equally",
        "  - 0-29: Very low confidence, the message is generic (e.g., \"any update please?\") with no clear retention concern",
        "",
        "After your reasoning, output ONLY the final result as a JSON object on the LAST line in this exact format:",
        '{"reason": "...", "subReason": "...", "desiredAction": "...", "clientThreat": "...", "confidence": 85}',
        "",
        'For "reason" use the Primary Reason category name exactly: "Financial & Pricing", "Clinical & Health", "Logistics & Supply", "Support & UX", "Uncategorized", or "Not for Retention".',
        'For "subReason" use the exact Sub-Reason name from the SUB-REASON DEFINITIONS above, or "N/A".',
        'For "desiredAction" use exactly one of: "Cancel", "Refund", "Refund and Cancel", "Paused", or "N/A".',
        'For "clientThreat" use exactly one of: "BBB Review", "Dispute", "Attorney General", "Trust Pilot Review", or "" (empty string if no threat).',
        'For "confidence" use an integer from 0 to 100.',
      ].join("\n");

      const systemContent = `${instructions}${examplesBlock}\n\n${subReasonDefs}\n\n${analysisSteps}`;

      const { client: aiClient, model: aiModel } = await getAIClient();

      let completion: any = null;
      const MAX_RETRIES = 4;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          completion = await aiClient.chat.completions.create({
            model: aiModel,
            messages: [
              {
                role: "system",
                content: systemContent,
              },
              {
                role: "user",
                content: `Analyze this patient concern and classify it:\n\n${concern}`,
              },
            ],
            max_completion_tokens: 2000,
          });
          break;
        } catch (retryErr: any) {
          if (retryErr?.status === 429 && attempt < MAX_RETRIES) {
            const retryAfter = Number(retryErr?.headers?.get?.("retry-after-ms") || retryErr?.headers?.["retry-after-ms"]) || 0;
            const waitMs = retryAfter > 0 ? retryAfter + 500 : (attempt + 1) * 5000;
            console.log(`[GPT] Rate limited, retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }
          throw retryErr;
        }
      }
      if (!completion) throw new Error("GPT analysis failed after retries");

      const text = completion.choices[0]?.message?.content?.trim() || "";
      let result;
      try {
        const jsonMatch = text.match(/\{[^{}]*"reason"[^{}]*\}/);
        result = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      } catch {
        result = { reason: "", subReason: "", desiredAction: "", clientThreat: "", confidence: 0, raw: text };
      }
      if (typeof result.confidence !== "number") {
        result.confidence = 0;
      }
      result.confidence = Math.max(0, Math.min(100, Math.round(result.confidence)));

      if (result.desiredAction) {
        const actionMap: Record<string, string> = {
          "Cancel Only": "Cancel",
          "cancel only": "Cancel",
          "cancel": "Cancel",
          "Refund Only": "Refund",
          "refund only": "Refund",
          "refund": "Refund",
          "Refund and cancel": "Refund and Cancel",
          "refund and cancel": "Refund and Cancel",
          "Cancel and Refund": "Refund and Cancel",
          "cancel and refund": "Refund and Cancel",
          "Pause": "Paused",
          "pause": "Paused",
          "paused": "Paused",
        };
        result.desiredAction = actionMap[result.desiredAction] || result.desiredAction;
      }

      const lower = concern.toLowerCase();
      const detectedThreat = (() => {
        if (/\bbbb\b|better\s*business\s*bureau/i.test(lower)) return "BBB Review";
        if (/\bdispute\b|\bchargeback\b|charge\s*back|contact.*\bbank\b|reverse.*charge/i.test(lower)) return "Dispute";
        if (/\battorney\s*general\b|\blegal\s*action\b|\blawyer\b|\bsue\b|\blawsuit\b|\blegal\s*complaint\b/i.test(lower)) return "Attorney General";
        if (/\btrustpilot\b|trust\s*pilot|\bbad\s*review\b|\bnegative\s*review\b|\bgoogle\s*review\b|leave.*\breview\b|post.*\breview\b|\breport\b.*\breview\b/i.test(lower)) return "Trust Pilot Review";
        return "";
      })();

      result.clientThreat = detectedThreat;

      const threatMap: Record<string, string> = {
        "bbb": "BBB Review",
        "bbb review": "BBB Review",
        "dispute": "Dispute",
        "attorney general": "Attorney General",
        "trust pilot": "Trust Pilot Review",
        "trust pilot review": "Trust Pilot Review",
        "trustpilot": "Trust Pilot Review",
        "trustpilot review": "Trust Pilot Review",
        "bad review": "Trust Pilot Review",
        "negative review": "Trust Pilot Review",
      };
      if (result.clientThreat) {
        result.clientThreat = threatMap[result.clientThreat.toLowerCase()] || result.clientThreat;
      }

      res.json(result);
    } catch (err: any) {
      console.error("GPT analysis error:", err);
      res.status(500).json({ message: err.message || "Failed to analyze" });
    }
  });

  app.post("/api/cv-reports/reanalyze/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const report = await storage.getCvReport(id);
      if (!report) return res.status(404).json({ message: "Report not found" });

      const concern = report.notesTrimrx || "";
      if (!concern.trim()) {
        return res.json({ reason: report.reason, subReason: report.subReason, desiredAction: report.desiredAction, confidence: 0 });
      }

      const port = process.env.PORT || 5000;
      const analyzeRes = await fetch(`http://localhost:${port}/api/custom-gpt/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
        body: JSON.stringify({ concern }),
      });
      if (!analyzeRes.ok) {
        const err = await analyzeRes.json();
        return res.status(analyzeRes.status).json(err);
      }
      const result = await analyzeRes.json();

      await storage.updateCvReport(id, {
        reason: result.reason || report.reason,
        subReason: result.subReason || report.subReason,
        desiredAction: result.desiredAction || report.desiredAction,
        clientThreat: result.clientThreat ?? "",
        confidence: result.confidence || 0,
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to re-analyze" });
    }
  });

  app.post("/api/cv-reports/match", async (req, res) => {
    try {
      const { caseIds, caseLinks } = req.body;
      if (!Array.isArray(caseIds)) return res.status(400).json({ message: "caseIds must be an array" });
      const allReports = await storage.getCvReports();
      const result: Record<string, { status: string; caseId: string; notesTrimrx: string; link: string; id: number }> = {};
      const linkMap: Record<string, string> = {};
      if (Array.isArray(caseLinks)) {
        for (const cl of caseLinks) {
          if (cl.link) linkMap[cl.msgTs] = cl.link;
        }
      }
      for (const report of allReports) {
        const rid = (report.caseId || "").trim().toUpperCase();
        const rlink = (report.link || "").trim().toLowerCase();
        for (const requested of caseIds) {
          if (result[requested]) continue;
          if (rid && rid === requested.trim().toUpperCase()) {
            result[requested] = {
              status: report.status || "",
              caseId: report.caseId || "",
              notesTrimrx: report.notesTrimrx || "",
              link: report.link || "",
              id: report.id,
            };
          }
        }
        if (rlink) {
          for (const [msgTs, msgLink] of Object.entries(linkMap)) {
            if (result[`link:${msgTs}`]) continue;
            if (rlink === msgLink.trim().toLowerCase() || rlink.includes(msgLink.trim().toLowerCase()) || msgLink.trim().toLowerCase().includes(rlink)) {
              result[`link:${msgTs}`] = {
                status: report.status || "",
                caseId: report.caseId || "",
                notesTrimrx: report.notesTrimrx || "",
                link: report.link || "",
                id: report.id,
              };
            }
          }
        }
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to match" });
    }
  });

  app.get("/api/cv-reports", async (_req, res) => {
    try {
      const reports = await storage.getCvReports();
      return res.json(reports);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch CV reports" });
    }
  });

  const CSV_COLUMNS = [
    "caseId", "status", "link", "duplicated", "customerEmail", "date", "name",
    "notesTrimrx", "productType", "clientThreat", "reason", "subReason",
    "desiredAction", "checkingStatus",
    "submittedBy", "assignedTo",
  ];

  app.get("/api/cv-reports/export", async (req: any, res) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const reports = await storage.getCvReports();
      const escCsv = (val: any) => {
        let s = String(val ?? "");
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return `"${s.replace(/"/g, '""')}"`;
      };
      const header = CSV_COLUMNS.join(",");
      const rows = reports.map((r: any) => CSV_COLUMNS.map((c) => escCsv(r[c])).join(","));
      const csv = [header, ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="cv-reports-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(csv);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Export failed" });
    }
  });

  app.post("/api/cv-reports/import", async (req: any, res) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { rows } = req.body as { rows: Record<string, any>[] };
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No rows provided" });
      }
      if (rows.length > 500) {
        return res.status(400).json({ message: "Too many rows (max 500 per request)" });
      }
      let imported = 0;
      let skipped = 0;
      for (const row of rows) {
        try {
          const clean: Record<string, any> = {};
          for (const col of CSV_COLUMNS) {
            let val = String(row[col] ?? "").trim();
            if (/^'[=+\-@\t\r]/.test(val)) val = val.slice(1);
            clean[col] = val;
          }
          const parsed = insertCvReportSchema.parse(clean);
          await storage.createCvReport(parsed);
          imported++;
        } catch {
          skipped++;
        }
      }
      return res.json({ imported, skipped, total: rows.length });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "Import failed" });
    }
  });

  app.get("/api/cv-reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const report = await storage.getCvReport(id);
      if (!report) return res.status(404).json({ message: "Report not found" });
      return res.json(report);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch CV report" });
    }
  });

  app.post("/api/cv-reports", async (req, res) => {
    try {
      const parsed = insertCvReportSchema.parse(req.body);
      const report = await storage.createCvReport(parsed);
      return res.status(201).json(report);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "Invalid data" });
    }
  });

  app.patch("/api/cv-reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const parsed = partialCvReportSchema.parse(req.body);
      const updated = await storage.updateCvReport(id, parsed);
      if (!updated) return res.status(404).json({ message: "Report not found" });
      return res.json(updated);
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "Failed to update" });
    }
  });

  const assignSchema = z.object({
    ids: z.array(z.number().int().positive()).min(1),
    assignedTo: z.string(),
  });

  app.post("/api/cv-reports/assign", async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
      if ((req.user as any).role !== "admin") return res.status(403).json({ message: "Admin access required" });
      const parsed = assignSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
      const { ids, assignedTo } = parsed.data;
      for (const id of ids) {
        await storage.updateCvReport(id, { assignedTo });
      }
      return res.json({ ok: true, updated: ids.length });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "Failed to assign" });
    }
  });

  app.delete("/api/cv-reports", async (_req, res) => {
    try {
      await storage.deleteAllCvReports();
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to delete all" });
    }
  });

  app.post("/api/cv-reports/delete-bulk", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    try {
      const parsed = z.object({ ids: z.array(z.number().int().positive()).min(1) }).parse(req.body);
      for (const id of parsed.ids) {
        await storage.deleteCvReport(id);
      }
      return res.json({ ok: true, deleted: parsed.ids.length });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "Failed to delete selected" });
    }
  });

  app.delete("/api/cv-reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteCvReport(id);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to delete" });
    }
  });

  app.post("/api/cv-reports/check-duplicates", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Not authenticated" });
    const taskId = "check-duplicates";
    try {
      const reports = await storage.getCvReports();
      if (!reports || reports.length === 0) {
        return res.json({ message: "No reports", emailsFound: 0, duplicatesFound: 0 });
      }

      const totalSteps = reports.length * 2;
      progressStore[taskId] = { current: 0, total: totalSteps, stage: "Loading PT Finder data..." };

      const PT_FINDER_PREFIX = "pt_finder_";
      const credentials = await storage.getSetting(`${PT_FINDER_PREFIX}credentials`);
      const spreadsheetId = await storage.getSetting(`${PT_FINDER_PREFIX}spreadsheet_id`);
      const sheetName = await storage.getSetting(`${PT_FINDER_PREFIX}sheet_name`) || "Sheet1";
      const headerRowNum = parseInt(await storage.getSetting(`${PT_FINDER_PREFIX}header_row`) || "1");

      if (!credentials || !spreadsheetId) {
        delete progressStore[taskId];
        return res.status(400).json({ message: "PT Finder is not configured. Connect Google Sheet first." });
      }

      const creds = JSON.parse(credentials);
      const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
      const sheets = google.sheets({ version: "v4", auth });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: sheetName,
      });

      const allRows = response.data.values || [];
      if (allRows.length < headerRowNum) {
        delete progressStore[taskId];
        return res.json({ message: "Sheet is empty", emailsFound: 0, duplicatesFound: 0 });
      }

      const headers = allRows[headerRowNum - 1] || [];
      const dataRows = allRows.slice(headerRowNum);
      const emailColIdx = headers.findIndex((h: string) => h.toLowerCase().includes("email"));
      const caseIdColIdx = headers.findIndex((h: string) => {
        const hl = h.toLowerCase();
        return hl.includes("case") && hl.includes("id") || hl === "caseid" || hl === "case_id";
      });

      const sheetEmails = new Set<string>();
      if (emailColIdx >= 0) {
        for (const row of dataRows) {
          const email = (row[emailColIdx] || "").trim().toLowerCase();
          if (email) sheetEmails.add(email);
        }
      }

      progressStore[taskId] = { current: 0, total: totalSteps, stage: "Fetching missing emails..." };

      let emailsFound = 0;
      const missingEmailReports = reports.filter((r) => !r.customerEmail || r.customerEmail === "—" || r.customerEmail.trim() === "");
      let step = 0;
      for (const report of reports) {
        step++;
        progressStore[taskId] = { current: step, total: totalSteps, stage: `Checking emails (${step}/${reports.length})...` };

        const isMissing = missingEmailReports.some((m) => m.id === report.id);
        if (!isMissing) continue;

        const searchQuery = report.caseId || "";
        if (!searchQuery.trim()) continue;

        const qLower = searchQuery.toLowerCase().trim();
        let match: string[] | undefined;

        if (caseIdColIdx >= 0) {
          match = dataRows.find((row: string[]) => {
            const cellVal = (row[caseIdColIdx] || "").toLowerCase().trim();
            return cellVal === qLower || cellVal.includes(qLower);
          });
        }

        if (!match) {
          match = dataRows.find((row: string[]) => {
            const rowText = row.join(" ").toLowerCase();
            return rowText.includes(qLower);
          });
        }

        if (match && emailColIdx >= 0 && match[emailColIdx]) {
          const foundEmail = match[emailColIdx].trim();
          if (foundEmail) {
            await storage.updateCvReport(report.id, { customerEmail: foundEmail });
            report.customerEmail = foundEmail;
            emailsFound++;
          }
        }
      }

      let duplicatesFound = 0;
      const updatedReports = await storage.getCvReports();
      for (let i = 0; i < updatedReports.length; i++) {
        const r = updatedReports[i];
        progressStore[taskId] = { current: reports.length + i + 1, total: totalSteps, stage: `Checking duplicates (${i + 1}/${updatedReports.length})...` };

        const email = (r.customerEmail || "").trim().toLowerCase();
        const caseId = (r.caseId || "").toLowerCase().trim();

        let isDuplicate = false;

        if (email && email !== "—") {
          const emailOccurrences = updatedReports.filter((other) =>
            other.id !== r.id && (other.customerEmail || "").trim().toLowerCase() === email
          );
          if (emailOccurrences.length > 0) {
            isDuplicate = true;
          }

          if (sheetEmails.has(email)) {
            isDuplicate = true;
          }
        }

        if (!isDuplicate && caseId) {
          if (caseIdColIdx >= 0) {
            const sheetMatch = dataRows.find((row: string[]) => {
              const cellVal = (row[caseIdColIdx] || "").toLowerCase().trim();
              return cellVal === caseId || cellVal.includes(caseId);
            });
            if (sheetMatch) isDuplicate = true;
          }

          if (!isDuplicate) {
            const sheetMatch = dataRows.find((row: string[]) => {
              return row.join(" ").toLowerCase().includes(caseId);
            });
            if (sheetMatch) isDuplicate = true;
          }
        }

        if (isDuplicate) {
          if (r.duplicated !== "Yes") {
            await storage.updateCvReport(r.id, { duplicated: "Yes" });
            duplicatesFound++;
          }
        } else {
          if (r.duplicated === "Yes") {
            await storage.updateCvReport(r.id, { duplicated: "" });
          }
        }
      }

      delete progressStore[taskId];
      return res.json({ message: "Done", emailsFound, duplicatesFound });
    } catch (err: any) {
      delete progressStore[taskId];
      return res.status(500).json({ message: err.message || "Failed to check duplicates" });
    }
  });
}
