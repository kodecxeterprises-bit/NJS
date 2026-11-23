import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BillingDatabase,
  BillingInterval,
  BillingSubscriptionEventRow,
  BillingSubscriptionUpdate,
  SubscriptionStatus,
} from "./billing-database.types";

export interface BillingEnv {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_WEBHOOK_SECRET?: string;
}

type BillingClient = SupabaseClient<BillingDatabase, "public">;
type PlanCode = "pro_monthly" | "pro_annual" | "enterprise_monthly" | "enterprise_annual";

const PLANS: Record<PlanCode, { paystackCode: string; publicPlan: "pro" | "enterprise" }> = {
  pro_monthly: { paystackCode: "PLN_zywosdp6f0zzf7c", publicPlan: "pro" },
  pro_annual: { paystackCode: "PLN_xezcdn9iihl5tez", publicPlan: "pro" },
  enterprise_monthly: { paystackCode: "PLN_rvh1gflfoilesru", publicPlan: "enterprise" },
  enterprise_annual: { paystackCode: "PLN_2w0l4q51l03918s", publicPlan: "enterprise" },
};
const APPROVED_AMOUNTS: Record<PlanCode, number> = {
  pro_monthly: 1_500_000,
  pro_annual: 15_000_000,
  enterprise_monthly: 5_000_000,
  enterprise_annual: 50_000_000,
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function database(env: BillingEnv): BillingClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error("Missing Supabase Worker configuration.");
  }
  return createClient<BillingDatabase>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function requireUser(request: Request, env: BillingEnv) {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ") || !header.slice(7).trim()) {
    return { error: "Not authenticated", status: 401 as const };
  }
  const supabase = database(env);
  const { data, error } = await supabase.auth.getUser(header.slice(7).trim());
  if (error || !data.user?.email) {
    return { error: "Invalid or expired session. Please sign in again.", status: 401 as const };
  }
  return { supabase, user: data.user };
}

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === "string" && Object.hasOwn(PLANS, value);
}

export function subscriptionStateTransition(event: string, currentStatus: string): SubscriptionStatus | null {
  switch (event) {
    case "charge.success":
    case "invoice.payment_success": return "active";
    case "charge.failed":
      if (currentStatus === "pending") return "failed";
      if (currentStatus === "active") return null;
      if (currentStatus === "past_due" || currentStatus === "non_renewing"
        || currentStatus === "cancelled" || currentStatus === "expired") return currentStatus;
      return "failed";
    case "invoice.payment_failed": return "past_due";
    case "subscription.not_renew":
    case "subscription.expiring": return "non_renewing";
    case "subscription.disable": return "cancelled";
    case "subscription.expired": return "expired";
    default: return null;
  }
}

export function effectiveSubscriptionStatus(
  status: SubscriptionStatus,
  currentPeriodEnd: string | null,
  now = Date.now(),
): SubscriptionStatus {
  const paidPeriodEnded = currentPeriodEnd !== null
    && Date.parse(currentPeriodEnd) <= now
    && ["active", "non_renewing", "past_due"].includes(status);
  return paidPeriodEnded ? "expired" : status;
}

export function reconcileSubscriptionStatus(
  currentStatus: SubscriptionStatus,
  paystackStatus: string,
  allowActivation = true,
): SubscriptionStatus | null {
  const mayBeActive = ["active", "non_renewing", "past_due"].includes(currentStatus);
  switch (paystackStatus) {
    case "active": return allowActivation && mayBeActive ? "active" : null;
    case "non-renewing": return mayBeActive ? "non_renewing" : null;
    case "attention": return mayBeActive ? "past_due" : null;
    case "cancelled": return "cancelled";
    case "completed": return "expired";
    default: return null;
  }
}

export function checkoutVerificationOutcome(status: string): "paid" | "terminal" | "pending" {
  if (status === "success") return "paid";
  if (status === "failed" || status === "abandoned" || status === "reversed") return "terminal";
  return "pending";
}

function paystackKey(env: BillingEnv): string {
  // This initial integration is deliberately restricted to Paystack Test Mode.
  if (!env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_")) {
    throw new Error("Paystack Test Mode is not configured.");
  }
  return env.PAYSTACK_SECRET_KEY;
}

async function paystackRequest(env: BillingEnv, path: string, body?: unknown) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${paystackKey(env)}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok || payload?.status !== true) {
    throw new Error("Paystack request failed.");
  }
  return payload.data;
}

export function periodEnd(start: Date, interval: BillingInterval): string {
  const monthOffset = interval === "annual" ? 12 : 1;
  const monthIndex = start.getUTCMonth() + monthOffset;
  const year = start.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = monthIndex % 12;
  const day = Math.min(start.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(
    year,
    month,
    day,
    start.getUTCHours(),
    start.getUTCMinutes(),
    start.getUTCSeconds(),
    start.getUTCMilliseconds(),
  )).toISOString();
}

function safePayment(payment: any) {
  if (!payment) return null;
  return {
    reference: payment.reference,
    amountKobo: Number(payment.amount_kobo),
    currency: payment.currency,
    status: payment.status,
    paidAt: payment.paid_at,
    createdAt: payment.created_at,
  };
}

export async function getBillingSubscription(request: Request, env: BillingEnv) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const auth = await requireUser(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);

  const { data: currentRows, error } = await auth.supabase
    .from("subscriptions")
    .select("id, plan_code, status, amount_kobo, currency, current_period_start, current_period_end, cancel_at_period_end, cancelled_at, created_at")
    .eq("user_id", auth.user.id)
    .in("status", ["active", "non_renewing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return json({ error: "Could not load your subscription." }, 500);
  let subscription = currentRows?.[0] ?? null;
  if (!subscription) {
    const { data: latestRows, error: latestError } = await auth.supabase
      .from("subscriptions")
      .select("id, plan_code, status, amount_kobo, currency, current_period_start, current_period_end, cancel_at_period_end, cancelled_at, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (latestError) return json({ error: "Could not load your subscription." }, 500);
    subscription = latestRows?.[0] ?? null;
  }
  let payment = null;
  if (subscription) {
    const { data, error: paymentError } = await auth.supabase
      .from("payment_transactions")
      .select("reference, amount_kobo, currency, status, paid_at, created_at")
      .eq("subscription_id", subscription.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (paymentError) return json({ error: "Could not load your payment information." }, 500);
    payment = safePayment(data?.[0]);
  }
  const state = subscription
    ? effectiveSubscriptionStatus(subscription.status, subscription.current_period_end)
    : undefined;
  return json({ success: true, subscription: subscription ? {
    id: subscription.id,
    plan: PLANS[subscription.plan_code as PlanCode]?.publicPlan ?? "free",
    planCode: subscription.plan_code,
    billingInterval: subscription.plan_code.endsWith("annual") ? "annually" : "monthly",
    status: state,
    amountKobo: Number(subscription.amount_kobo),
    currency: subscription.currency,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelledAt: subscription.cancelled_at,
    createdAt: subscription.created_at,
    latestPayment: payment,
  } : null });
}

export async function initializeCheckout(request: Request, env: BillingEnv) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const auth = await requireUser(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);
  const bodyBytes = await readRawBody(request, 16_384);
  if (!bodyBytes) return json({ error: "Checkout request is too large." }, 413);
  let body: unknown;
  try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes)); }
  catch { return json({ error: "Invalid JSON request body." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || !isPlanCode((body as any).planCode)) {
    return json({ error: "Choose a valid billing plan." }, 400);
  }
  const planCode = (body as { planCode: PlanCode }).planCode;
  const mapping = PLANS[planCode];
  const { data: plan, error: planError } = await auth.supabase
    .from("billing_plans")
    .select("code, name, billing_interval, amount_kobo, currency, is_active")
    .eq("code", planCode)
    .eq("is_active", true)
    .maybeSingle();
  if (planError || !plan) return json({ error: "This billing plan is unavailable." }, 404);
  const expectedAmount = APPROVED_AMOUNTS[planCode];
  if (Number(plan.amount_kobo) !== expectedAmount || plan.currency !== "NGN"
    || plan.billing_interval !== (planCode.endsWith("annual") ? "annual" : "monthly")) {
    return json({ error: "The configured plan price does not match the approved price." }, 409);
  }
  const { data: existingEntitlement, error: existingError } = await auth.supabase.from("subscriptions")
    .select("id, status, current_period_end").eq("user_id", auth.user.id)
    .in("status", ["active", "non_renewing", "past_due"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existingError) return json({ error: "Could not check your existing subscription." }, 500);
  if (existingEntitlement) {
    const periodEnded = existingEntitlement.current_period_end
      && new Date(existingEntitlement.current_period_end).getTime() <= Date.now();
    if (periodEnded && ["active", "non_renewing", "past_due"].includes(existingEntitlement.status)) {
      const { error: expireError } = await auth.supabase.from("subscriptions").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", existingEntitlement.id);
      if (expireError) return json({ error: "Could not update your expired subscription." }, 500);
    } else {
      return json({ error: "Manage or cancel your current subscription before starting another plan." }, 409);
    }
  }
  const pendingSince = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recentCheckout, error: pendingError } = await auth.supabase.from("subscriptions")
    .select("id").eq("user_id", auth.user.id).eq("status", "pending")
    .gte("created_at", pendingSince).limit(1).maybeSingle();
  if (pendingError) return json({ error: "Could not check for an existing checkout." }, 500);
  if (recentCheckout) return json({ error: "A checkout is already in progress. Please finish it or try again later." }, 409);

  const { data: staleCheckouts, error: staleCheckoutError } = await auth.supabase.from("subscriptions")
    .select("id").eq("user_id", auth.user.id).eq("status", "pending")
    .lt("created_at", pendingSince).order("created_at", { ascending: true });
  if (staleCheckoutError) return json({ error: "Could not check for an earlier checkout." }, 500);
  for (const staleCheckout of staleCheckouts ?? []) {
    const { data: stalePayment, error: stalePaymentError } = await auth.supabase.from("payment_transactions")
      .select("id, reference, plan_code, amount_kobo, currency, status")
      .eq("subscription_id", staleCheckout.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (stalePaymentError || !stalePayment || !isPlanCode(stalePayment.plan_code)) {
      return json({ error: "An earlier checkout needs to be resolved before starting another." }, 409);
    }

    let verifiedPayload: unknown;
    try { verifiedPayload = await verifyTransaction(env, stalePayment.reference); }
    catch { return json({ error: "Could not verify your earlier checkout. Please retry shortly." }, 502); }
    if (!isRecord(verifiedPayload) || typeof verifiedPayload.status !== "string"
      || verifiedPayload.reference !== stalePayment.reference || verifiedPayload.domain !== "test"
      || Number(verifiedPayload.amount) !== Number(stalePayment.amount_kobo)
      || Number(verifiedPayload.amount) !== APPROVED_AMOUNTS[stalePayment.plan_code]
      || verifiedPayload.currency !== stalePayment.currency || verifiedPayload.currency !== "NGN") {
      return json({ error: "Your earlier checkout could not be verified. Please contact support." }, 409);
    }
    if (checkoutVerificationOutcome(verifiedPayload.status) === "paid") {
      await processSuccessfulPayment(auth.supabase, env, { reference: stalePayment.reference });
      return json({ error: "Your earlier payment was verified. Refresh your subscription status before checking out again." }, 409);
    }
    if (checkoutVerificationOutcome(verifiedPayload.status) !== "terminal") {
      return json({ error: "Your earlier checkout is still processing. Please finish it or try again later." }, 409);
    }
    const terminalStatus = verifiedPayload.status === "reversed" ? "reversed"
      : verifiedPayload.status === "abandoned" ? "abandoned" : "failed";
    const { data: closedPayment, error: closePaymentError } = await auth.supabase.from("payment_transactions").update({
      status: terminalStatus,
      updated_at: new Date().toISOString(),
      gateway_response: {
        status: verifiedPayload.status,
        reference: stalePayment.reference,
        amount: Number(verifiedPayload.amount),
        currency: String(verifiedPayload.currency),
      },
    }).eq("id", stalePayment.id).eq("status", stalePayment.status).select("id").maybeSingle();
    if (closePaymentError) return json({ error: "Could not close your earlier checkout." }, 500);
    if (!closedPayment) return json({ error: "Your earlier payment changed while being verified. Refresh and try again." }, 409);

    const { data: closedCheckout, error: closeCheckoutError } = await auth.supabase.from("subscriptions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", staleCheckout.id).eq("status", "pending").select("id").maybeSingle();
    if (closeCheckoutError) return json({ error: "Could not close your earlier checkout." }, 500);
    if (!closedCheckout) return json({ error: "Your earlier checkout changed while being verified. Refresh and try again." }, 409);
  }

  const { data: pending, error: subscriptionError } = await auth.supabase
    .from("subscriptions")
    .insert({
      user_id: auth.user.id,
      plan_code: plan.code,
      status: "pending",
      amount_kobo: expectedAmount,
      currency: "NGN",
      metadata: { paystack_plan_code: mapping.paystackCode },
    })
    .select("id")
    .single();
  if (subscriptionError?.code === "23505") {
    return json({ error: "A checkout or subscription is already in progress for your account." }, 409);
  }
  if (subscriptionError || !pending) return json({ error: "Could not start your subscription." }, 500);

  const reference = `njs-${crypto.randomUUID().replaceAll("-", "")}`;
  const { error: transactionError } = await auth.supabase.from("payment_transactions").insert({
    user_id: auth.user.id,
    subscription_id: pending.id,
    plan_code: plan.code,
    reference,
    gateway: "paystack",
    amount_kobo: expectedAmount,
    currency: "NGN",
    status: "pending",
  });
  if (transactionError) {
    await auth.supabase.from("subscriptions").update({ status: "failed" }).eq("id", pending.id);
    return json({ error: "Could not record your checkout." }, 500);
  }

  try {
    const callbackUrl = new URL("/billing?checkout=complete", request.url).toString();
    const initialized = await paystackRequest(env, "/transaction/initialize", {
      email: auth.user.email,
      plan: mapping.paystackCode,
      reference,
      callback_url: callbackUrl,
      metadata: { njs_plan_code: plan.code, njs_subscription_id: pending.id },
    });
    if (initialized.reference !== reference || typeof initialized.authorization_url !== "string") {
      throw new Error("Invalid checkout response.");
    }
    return json({ success: true, authorizationUrl: initialized.authorization_url, reference });
  } catch {
    await auth.supabase.from("payment_transactions").update({ status: "failed" }).eq("reference", reference);
    await auth.supabase.from("subscriptions").update({ status: "failed" }).eq("id", pending.id);
    return json({ error: "Could not initialize Paystack checkout. Please try again." }, 502);
  }
}

async function manageSubscription(request: Request, env: BillingEnv, action: "cancel" | "resume") {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const auth = await requireUser(request, env);
  if ("error" in auth) return json({ error: auth.error }, auth.status);
  const { data: subscription, error } = await auth.supabase
    .from("subscriptions")
    .select("id, status, current_period_end, paystack_subscription_code, paystack_email_token, cancel_at_period_end")
    .eq("user_id", auth.user.id)
    .in("status", ["active", "non_renewing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return json({ error: "Could not load your subscription." }, 500);
  if (!subscription?.paystack_subscription_code || !subscription.paystack_email_token) {
    return json({ error: "There is no manageable Paystack subscription." }, 409);
  }
  if (action === "cancel" && subscription.cancel_at_period_end) {
    return json({ success: true, subscription: { status: "non_renewing", cancelAtPeriodEnd: true } });
  }
  try {
    await paystackRequest(env, action === "cancel" ? "/subscription/disable" : "/subscription/enable", {
      code: subscription.paystack_subscription_code,
      token: subscription.paystack_email_token,
    });
  } catch {
    return json({ error: `Could not ${action} your subscription with Paystack.` }, 502);
  }
  const now = new Date().toISOString();
  const values: BillingSubscriptionUpdate = action === "cancel"
    ? { status: "non_renewing", cancel_at_period_end: true, cancelled_at: null, updated_at: now }
    : { status: "active", cancel_at_period_end: false, cancelled_at: null, updated_at: now };
  const { error: updateError } = await auth.supabase.from("subscriptions").update(values).eq("id", subscription.id);
  if (updateError) return json({ error: "Paystack updated the subscription, but NJS could not save the change. Refresh and retry." }, 500);
  return json({ success: true, subscription: {
    status: values.status,
    cancelAtPeriodEnd: values.cancel_at_period_end,
    currentPeriodEnd: subscription.current_period_end,
  } });
}

export function cancelSubscription(request: Request, env: BillingEnv) {
  return manageSubscription(request, env, "cancel");
}

export function resumeSubscription(request: Request, env: BillingEnv) {
  return manageSubscription(request, env, "resume");
}

export async function hmacSha512Hex(secret: string, body: string | Uint8Array): Promise<string> {
  const toArrayBuffer = (value: string | Uint8Array) => {
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  };
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, toArrayBuffer(body));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function webhookEventKey(rawBody: string | Uint8Array): Promise<string> {
  return hmacSha512Hex("njs-paystack-event-v1", rawBody);
}

async function readRawBody(request: Request, maxBytes = 1_000_000): Promise<Uint8Array | null> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const raw = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    raw.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return raw;
}

function concatBytes(prefix: string, body: Uint8Array): Uint8Array {
  const prefixBytes = new TextEncoder().encode(prefix);
  const result = new Uint8Array(prefixBytes.length + body.length);
  result.set(prefixBytes);
  result.set(body, prefixBytes.length);
  return result;
}

export function verifyPaystackSignature(left: string, right: string): boolean {
  if (!/^[a-f\d]{128}$/i.test(left) || !/^[a-f\d]{128}$/i.test(right)) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

async function verifyTransaction(env: BillingEnv, reference: string) {
  return await paystackRequest(env, `/transaction/verify/${encodeURIComponent(reference)}`);
}

async function getPaystackSubscriptionStatus(env: BillingEnv, code: string): Promise<string> {
  const current = await paystackRequest(env, `/subscription/${encodeURIComponent(code)}`);
  if (current?.subscription_code !== code || current?.domain !== "test" || typeof current?.status !== "string") {
    throw new Error("Could not verify Paystack subscription state.");
  }
  return current.status;
}

async function processSuccessfulPayment(supabase: BillingClient, env: BillingEnv, eventData: any) {
  const reference = typeof eventData?.reference === "string" ? eventData.reference
    : typeof eventData?.transaction?.reference === "string" ? eventData.transaction.reference : "";
  if (!/^[A-Za-z0-9_.=-]{6,120}$/.test(reference)) return;
  const verified = await verifyTransaction(env, reference);
  if (verified?.status !== "success" || verified.reference !== reference || verified.domain !== "test") {
    throw new Error("Payment verification failed.");
  }

  let { data: transaction, error } = await supabase.from("payment_transactions")
    .select("id, user_id, subscription_id, plan_code, reference, amount_kobo, currency, status")
    .eq("reference", reference).maybeSingle();
  if (error) throw new Error("Could not load payment transaction.");
  let subscription: any = null;
  const paystackSubscriptionCode = eventData?.subscription?.subscription_code ?? eventData?.subscription_code;
  if (!transaction && typeof paystackSubscriptionCode === "string") {
    const result = await supabase.from("subscriptions")
      .select("id, user_id, plan_code, amount_kobo, currency, status")
      .eq("paystack_subscription_code", paystackSubscriptionCode)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (result.error) throw new Error("Could not find subscription for renewal.");
    subscription = result.data;
    if (!subscription) return;
    const inserted = await supabase.from("payment_transactions").insert({
      user_id: subscription.user_id,
      subscription_id: subscription.id,
      plan_code: subscription.plan_code,
      reference,
      gateway: "paystack",
      gateway_transaction_id: String(verified.id),
      amount_kobo: Number(verified.amount),
      currency: verified.currency,
      status: "pending",
    }).select("id, user_id, subscription_id, plan_code, reference, amount_kobo, currency, status").single();
    if (inserted.error || !inserted.data) {
      const existing = await supabase.from("payment_transactions").select("id, user_id, subscription_id, plan_code, reference, amount_kobo, currency, status").eq("reference", reference).maybeSingle();
      if (existing.error || !existing.data) throw new Error("Could not record renewal transaction.");
      transaction = existing.data;
    } else transaction = inserted.data;
  }
  if (!transaction) return;
  if (!isPlanCode(transaction.plan_code)) throw new Error("Could not verify payment plan.");
  const { data: plan, error: planError } = await supabase.from("billing_plans")
    .select("amount_kobo, currency, billing_interval").eq("code", transaction.plan_code).maybeSingle();
  if (planError || !plan) throw new Error("Could not verify payment plan.");
  if (Number(verified.amount) !== Number(transaction.amount_kobo)
    || Number(verified.amount) !== Number(plan.amount_kobo)
    || Number(plan.amount_kobo) !== APPROVED_AMOUNTS[transaction.plan_code]
    || verified.currency !== "NGN" || verified.currency !== plan.currency
    || verified.currency !== transaction.currency) {
    throw new Error("Payment amount or currency does not match the plan.");
  }
  const paidAt = typeof verified.paid_at === "string" ? verified.paid_at
    : typeof verified.paidAt === "string" ? verified.paidAt : new Date().toISOString();
  const gatewayTransactionId = String(verified.id);
  if (transaction.status !== "success") {
    const { error: updatePaymentError } = await supabase.from("payment_transactions").update({
      status: "success",
      gateway_transaction_id: gatewayTransactionId,
      paid_at: paidAt,
      gateway_response: {
        id: verified.id,
        reference,
        status: verified.status,
        amount: verified.amount,
        currency: verified.currency,
        paid_at: paidAt,
        channel: verified.channel ?? null,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", transaction.id).neq("status", "success");
    if (updatePaymentError) throw new Error("Could not save payment result.");
  }

  if (!transaction.subscription_id) return;
  const { data: currentSubscription, error: currentSubscriptionError } = await supabase.from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end, cancelled_at")
    .eq("id", transaction.subscription_id)
    .maybeSingle();
  if (currentSubscriptionError) throw new Error("Could not load subscription after payment verification.");
  if (!currentSubscription || currentSubscription.status === "cancelled" || currentSubscription.status === "expired") return;
  if (transaction.status === "success" && currentSubscription.current_period_end
    && Date.parse(paidAt) <= Date.parse(currentSubscription.current_period_end)) return;
  const start = new Date(paidAt);
  const nextPaystackDate = eventData?.subscription?.next_payment_date
    ?? eventData?.next_payment_date
    ?? verified?.subscription?.next_payment_date;
  const validNextPaymentDate = typeof nextPaystackDate === "string" && Number.isFinite(Date.parse(nextPaystackDate))
    ? new Date(nextPaystackDate).toISOString() : periodEnd(start, plan.billing_interval);
  const { error: updateSubscriptionError } = await supabase.from("subscriptions").update({
    status: currentSubscription.status === "non_renewing" ? "non_renewing" : "active",
    current_period_start: start.toISOString(),
    current_period_end: validNextPaymentDate,
    cancel_at_period_end: currentSubscription.status === "non_renewing"
      ? currentSubscription.cancel_at_period_end : false,
    cancelled_at: currentSubscription.status === "non_renewing"
      ? currentSubscription.cancelled_at : null,
    paystack_customer_code: eventData?.customer?.customer_code ?? undefined,
    paystack_subscription_code: eventData?.subscription?.subscription_code
      ?? eventData?.subscription_code
      ?? verified?.subscription?.subscription_code
      ?? undefined,
    paystack_email_token: eventData?.subscription?.email_token
      ?? eventData?.email_token
      ?? verified?.subscription?.email_token
      ?? undefined,
    updated_at: new Date().toISOString(),
  }).eq("id", transaction.subscription_id);
  if (updateSubscriptionError) throw new Error("Could not activate subscription.");
}

export async function handlePaystackWebhook(request: Request, env: BillingEnv) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  let secret: string;
  try { secret = paystackKey(env); } catch { return json({ error: "Webhook is not configured." }, 503); }
  const rawBody = await readRawBody(request);
  if (!rawBody) return json({ error: "Webhook payload is too large." }, 413);
  const modernHeader = request.headers.get("paystack-signature");
  let signatureIsValid = false;
  if (modernHeader) {
    if (!env.PAYSTACK_WEBHOOK_SECRET) return json({ error: "Webhook signing secret is not configured." }, 503);
    const timestampText = modernHeader.match(/(?:^|,)\s*t=(\d+)/)?.[1];
    const timestamp = timestampText ? Number(timestampText) : NaN;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) {
      return json({ error: "Webhook signature timestamp is invalid." }, 401);
    }
    const expected = await hmacSha512Hex(env.PAYSTACK_WEBHOOK_SECRET, concatBytes(`${timestamp}.`, rawBody));
    const signatures = [...modernHeader.matchAll(/(?:^|,)\s*v1=[^:,]+:([a-f\d]{128})(?=\s*(?:,|$))/gi)].map((match) => match[1]);
    signatureIsValid = signatures.some((candidate) => verifyPaystackSignature(candidate, expected));
  } else {
    const signature = request.headers.get("x-paystack-signature") ?? "";
    const expected = await hmacSha512Hex(secret, rawBody);
    signatureIsValid = verifyPaystackSignature(signature, expected);
  }
  if (!signatureIsValid) return json({ error: "Invalid webhook signature." }, 401);
  let event: any;
  try { event = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody)); } catch { return json({ error: "Invalid webhook payload." }, 400); }
  if (!event || typeof event.event !== "string" || !event.data || typeof event.data !== "object") {
    return json({ error: "Invalid webhook payload." }, 400);
  }

  const supabase = database(env);
  const eventKey = await webhookEventKey(rawBody);
  const { error: insertError } = await supabase.from("paystack_webhook_events").insert({
    event_key: eventKey,
    event_type: event.event.slice(0, 120),
    paystack_event_id: event.data.id == null ? null : String(event.data.id),
    signature_verified: true,
    processed: false,
    payload: {
      event: event.event.slice(0, 120),
      data: {
        id: event.data.id ?? null,
        reference: event.data.reference ?? event.data.transaction?.reference ?? null,
        status: event.data.status ?? null,
        amount: event.data.amount ?? null,
        currency: event.data.currency ?? null,
        subscription_code: event.data.subscription?.subscription_code ?? event.data.subscription_code ?? null,
        customer_code: event.data.customer?.customer_code ?? null,
      },
    },
  });
  if (insertError) {
    const { data: existing, error: lookupError } = await supabase.from("paystack_webhook_events")
      .select("id, processed").eq("event_key", eventKey).maybeSingle();
    if (lookupError || !existing) return json({ error: "Could not record webhook event." }, 500);
    if (existing.processed) return json({ success: true, duplicate: true });
  }

  try {
    switch (event.event) {
      case "charge.success":
      case "invoice.payment_success":
        await processSuccessfulPayment(supabase, env, event.data);
        break;
      case "charge.failed":
      case "invoice.payment_failed": {
        const reference = typeof event.data.reference === "string" ? event.data.reference
          : typeof event.data.transaction?.reference === "string" ? event.data.transaction.reference : "";
        let alreadyPaid = false;
        if (reference) {
          const { data: transaction, error: transactionLookupError } = await supabase.from("payment_transactions")
            .select("id, subscription_id, plan_code, amount_kobo, currency, status").eq("reference", reference).maybeSingle();
          if (transactionLookupError) throw new Error("Could not load failed payment transaction.");
          if (transaction && (!isPlanCode(transaction.plan_code)
            || (event.data.amount != null && Number(event.data.amount) !== Number(transaction.amount_kobo))
            || (event.data.currency != null && (event.data.currency !== transaction.currency || event.data.currency !== "NGN")))) {
            throw new Error("Failed payment reference or amount does not match the stored transaction.");
          }
          alreadyPaid = transaction?.status === "success";
          if (transaction && !alreadyPaid) {
            if (transaction.status === "pending") {
              const { data: failedPayment, error: paymentUpdateError } = await supabase.from("payment_transactions")
                .update({ status: "failed", updated_at: new Date().toISOString() })
                .eq("id", transaction.id).eq("status", "pending").select("id").maybeSingle();
              if (paymentUpdateError) throw new Error("Could not save failed payment result.");
              if (!failedPayment) {
                const { data: latestTransaction, error: latestTransactionError } = await supabase.from("payment_transactions")
                  .select("status").eq("id", transaction.id).maybeSingle();
                if (latestTransactionError) throw new Error("Could not confirm failed payment state.");
                alreadyPaid = latestTransaction?.status === "success";
              }
            }
            if (!alreadyPaid && transaction.subscription_id) {
              const { data: relatedSubscription, error: relatedError } = await supabase.from("subscriptions").select("status").eq("id", transaction.subscription_id).maybeSingle();
              if (relatedError) throw new Error("Could not load subscription after failed payment.");
              const status = relatedSubscription ? subscriptionStateTransition("charge.failed", relatedSubscription.status) : null;
              if (relatedSubscription && status) {
                const { error: subscriptionUpdateError } = await supabase.from("subscriptions")
                  .update({ status, updated_at: new Date().toISOString() })
                  .eq("id", transaction.subscription_id).eq("status", relatedSubscription.status);
                if (subscriptionUpdateError) throw new Error("Could not update failed subscription.");
              }
            }
          }
        }
        const paystackSubscriptionCode = event.data.subscription?.subscription_code ?? event.data.subscription_code;
        if (event.event === "invoice.payment_failed" && typeof paystackSubscriptionCode === "string") {
          const { data: subscription, error: subscriptionLookupError } = await supabase.from("subscriptions")
            .select("id, user_id, plan_code, amount_kobo, currency, status")
            .eq("paystack_subscription_code", paystackSubscriptionCode)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (subscriptionLookupError) throw new Error("Could not find subscription for failed renewal.");
          const failedReference = reference || (event.data.id != null ? `paystack_invoice_${event.data.id}` : "");
          if (subscription && failedReference) {
            if (!isPlanCode(subscription.plan_code)) throw new Error("Failed renewal has an unknown billing plan.");
            const expectedRenewalAmount = APPROVED_AMOUNTS[subscription.plan_code];
            if (Number(subscription.amount_kobo) !== expectedRenewalAmount || subscription.currency !== "NGN") {
              throw new Error("Failed renewal does not match an approved plan.");
            }
            const { data: existingPayment, error: existingPaymentError } = await supabase.from("payment_transactions")
              .select("id, status").eq("reference", failedReference).maybeSingle();
            if (existingPaymentError) throw new Error("Could not inspect failed renewal transaction.");
            if (!existingPayment) {
              const failedAmount = Number(event.data.amount ?? subscription.amount_kobo);
              const failedCurrency = String(event.data.currency ?? subscription.currency);
              if (failedAmount !== Number(subscription.amount_kobo) || failedCurrency !== subscription.currency || failedCurrency !== "NGN") {
                throw new Error("Failed renewal amount or currency does not match the plan.");
              }
              const { error: insertFailedError } = await supabase.from("payment_transactions").insert({
                user_id: subscription.user_id,
                subscription_id: subscription.id,
                plan_code: subscription.plan_code,
                reference: failedReference,
                gateway: "paystack",
                gateway_transaction_id: event.data.transaction?.id == null ? null : String(event.data.transaction.id),
                amount_kobo: failedAmount,
                currency: failedCurrency,
                status: "failed",
                gateway_response: { status: "failed", reference: failedReference, amount: failedAmount, currency: failedCurrency },
              });
              if (insertFailedError) throw new Error("Could not record failed renewal transaction.");
            }
          }
          if (!alreadyPaid && subscription) {
            const providerStatus = await getPaystackSubscriptionStatus(env, paystackSubscriptionCode);
            const nextStatus = reconcileSubscriptionStatus(subscription.status, providerStatus, false);
            if (nextStatus && nextStatus !== subscription.status) {
              const { error: subscriptionUpdateError } = await supabase.from("subscriptions")
                .update({ status: nextStatus, updated_at: new Date().toISOString() })
                .eq("id", subscription.id).eq("status", subscription.status);
              if (subscriptionUpdateError) throw new Error("Could not reconcile failed subscription payment.");
            }
          }
        }
        break;
      }
      case "subscription.create":
      case "subscription.update":
      case "subscription.not_renew":
      case "subscription.disable":
      case "subscription.expiring":
      case "subscription.expired": {
        const code = event.data.subscription?.subscription_code ?? event.data.subscription_code;
        const metadataId = event.data.metadata?.njs_subscription_id;
        let subscription: BillingSubscriptionEventRow | null = null;
        if (typeof code === "string") {
          const result = await supabase.from("subscriptions")
            .select("id, status, current_period_end").eq("paystack_subscription_code", code)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (result.error) throw new Error("Could not find Paystack subscription.");
          subscription = result.data;
        }
        if (!subscription && typeof metadataId === "string") {
          const result = await supabase.from("subscriptions")
            .select("id, status, current_period_end").eq("id", metadataId).maybeSingle();
          if (result.error) throw new Error("Could not find Paystack subscription.");
          subscription = result.data;
        }
        if (typeof code !== "string" && typeof metadataId !== "string") break;
        if (!subscription) break;
        let nextStatus: SubscriptionStatus | null;
        if (typeof code === "string" && ["subscription.not_renew", "subscription.disable", "subscription.expired"].includes(event.event)) {
          const providerStatus = await getPaystackSubscriptionStatus(env, code);
          nextStatus = reconcileSubscriptionStatus(subscription.status, providerStatus);
        } else {
          nextStatus = subscriptionStateTransition(event.event, subscription.status);
        }
        const patch: BillingSubscriptionUpdate = {
          updated_at: new Date().toISOString(),
          ...(typeof code === "string" ? { paystack_subscription_code: code } : {}),
          ...(typeof event.data.customer?.customer_code === "string" ? { paystack_customer_code: event.data.customer.customer_code } : {}),
          ...(typeof (event.data.subscription?.email_token ?? event.data.email_token) === "string"
            ? { paystack_email_token: event.data.subscription?.email_token ?? event.data.email_token }
            : {}),
        };
        if (nextStatus) patch.status = nextStatus;
        if (event.event === "subscription.disable" && event.data.status === "complete") patch.status = "expired";
        if (event.event === "subscription.disable") { patch.cancelled_at = new Date().toISOString(); patch.cancel_at_period_end = false; }
        if (["subscription.not_renew", "subscription.expiring"].includes(event.event)) patch.cancel_at_period_end = true;
        if (event.event === "subscription.expired") patch.cancel_at_period_end = false;
        const { error: updateError } = await supabase.from("subscriptions").update(patch).eq("id", subscription.id);
        if (updateError) throw new Error("Could not update subscription state.");
        break;
      }
      default:
        break;
    }
    const { error: markError } = await supabase.from("paystack_webhook_events").update({ processed: true, processed_at: new Date().toISOString(), processing_error: null }).eq("event_key", eventKey);
    if (markError) throw new Error("Could not mark webhook event processed.");
    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    await supabase.from("paystack_webhook_events").update({ processing_error: message.slice(0, 500) }).eq("event_key", eventKey);
    return json({ error: "Webhook processing failed; Paystack may retry delivery." }, 500);
  }
}
