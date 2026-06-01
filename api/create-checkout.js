import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const REQUIRED_FIELDS = [
  'fullName',
  'domain',
  'modules',
  'billing',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://www.gigabuild.dev',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const LAUNCH_PLANS = {
  'Operator Launch': { code: 'GSO-PLAN-OL', name: 'Operator Launch', base: 199, included: 1, extra: 29 },
  'Fleet Pro': { code: 'GSO-PLAN-FP', name: 'Fleet Pro', base: 499, included: 5, extra: 49 },
  'Compliance Command': { code: 'GSO-PLAN-CC', name: 'Compliance Command', base: 1250, included: 10, extra: 79 },
};

const ALLOWED_MODULE_IDS = new Set([
  'gigabooks',
  'fleet',
  'compliance',
  'compliance_calendar',
  'dynamic_reminder_calendar',
  'document_vault',
  'invoice_capture',
  'ifta',
  'payroll',
  'onboarding',
  'repair_work_orders',
  'inventory_center',
  'warranty_tracking',
  'vendor_directory',
  'reporting_dashboard',
  'driver_assistant',
  'driver_updates',
  'route_readiness',
  'onboarding_progress',
  'hazmat',
  'temp',
  'securement',
  'shipment',
]);

function json(res, status, body) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  return res.status(status).json(body);
}

function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
}

function supabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase order storage is not configured');
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function normalizeDomain(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\*\./, '');
}

function validDomain(domain) {
  if (!/^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(domain)) return false;
  return !domain.endsWith('.gigabuild.dev') && domain !== 'gigabuild.dev';
}

function orderId() {
  return `GBO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function validatePayload(body) {
  const missing = REQUIRED_FIELDS.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
  if (missing.length) return `Missing required field(s): ${missing.join(', ')}`;
  if (!Array.isArray(body.modules) || body.modules.length === 0) return 'At least one module is required';
  if (!['monthly', 'annual'].includes(body.billing)) return 'Billing must be monthly or annual';
  if (String(body.fullName || '').trim().length > 120) return 'Full name is too long';
  if (String(body.companyName || '').trim().length > 160) return 'Company name is too long';
  if (!body.refundTermsAccepted) return 'Refund and non-refundable domain/custom-build terms must be accepted';
  if (body.modules.some((m) => !ALLOWED_MODULE_IDS.has(m?.id))) return 'One or more selected modules are not available';
  const domain = normalizeDomain(body.domain);
  if (!validDomain(domain)) return 'Enter a valid custom domain, such as fleet.example.com';
  return null;
}

function launchPlanFor(payload) {
  if (LAUNCH_PLANS[payload.launchPlan]) return LAUNCH_PLANS[payload.launchPlan];
  const modules = Array.isArray(payload.modules) ? payload.modules : [];
  const highRiskModules = new Set([
    'compliance',
    'hazmat',
    'temp',
    'securement',
    'shipment',
    'repair_work_orders',
    'inventory_center',
    'warranty_tracking',
    'reporting_dashboard',
    'driver_assistant',
    'driver_updates',
    'route_readiness',
    'onboarding_progress',
  ]);
  const highRiskCount = modules.filter((m) => highRiskModules.has(m.id)).length;
  const fleetSize = Number(payload.fleetSize || 1);
  if (fleetSize >= 10 || modules.length >= 6 || highRiskCount >= 3) return LAUNCH_PLANS['Compliance Command'];
  if (fleetSize >= 3 || modules.length >= 3 || highRiskCount >= 2) return LAUNCH_PLANS['Fleet Pro'];
  return LAUNCH_PLANS['Operator Launch'];
}

function monthlyTotalFor(payload) {
  const plan = launchPlanFor(payload);
  const fleetSize = Number(payload.fleetSize || 1);
  return plan.base + Math.max(0, fleetSize - plan.included) * plan.extra;
}

function amountFor(payload) {
  const monthly = Math.round(monthlyTotalFor(payload) * 100);
  if (payload.billing === 'annual') return Math.round(monthly * 12 * 0.85);
  return monthly;
}

function intervalFor(payload) {
  return payload.billing === 'annual' ? 'year' : 'month';
}

async function saveOrder(db, record) {
  const { error } = await db
    .from('gigabuild_orders')
    .upsert(
      { ...record, updated_at: new Date().toISOString() },
      { onConflict: 'order_id' },
    );
  if (error) throw new Error(`Order save failed: ${error.message}`);
}

async function ensureDomainAvailable(db, domain) {
  const { data, error } = await db
    .from('gigabuild_orders')
    .select('order_id,status')
    .eq('domain', domain)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Domain availability check failed: ${error.message}`);
  if (data) {
    const err = new Error('That domain is already attached to a GigaBuild order. Use a different domain or contact support.');
    err.statusCode = 409;
    throw err;
  }
}

function verificationToken() {
  return randomBytes(16).toString('hex');
}

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const payload = req.body || {};
    const validationError = validatePayload(payload);
    if (validationError) return json(res, 400, { error: validationError });

    const domain = normalizeDomain(payload.domain);
    const db = supabase();
    await ensureDomainAvailable(db, domain);

    const id = orderId();
    const domainToken = verificationToken();
    const plan = launchPlanFor(payload);
    const monthlyTotal = monthlyTotalFor(payload);
    const origin = process.env.PUBLIC_SITE_URL || 'https://www.gigabuild.dev';
    const compactConfig = {
      id,
      domain,
      fullName: payload.fullName,
      companyName: payload.companyName,
      freightType: payload.freightType,
      homeState: payload.homeState,
      vehicleClass: payload.vehicleClass,
      driverCount: payload.driverCount,
      billing: payload.billing,
      launchPlan: plan.name,
      launchPlanCode: plan.code,
      monthlyTotal,
      domainVerification: {
        type: 'TXT',
        host: `_gigabuild.${domain}`,
        value: domainToken,
        status: 'pending',
      },
      modules: payload.modules.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        tier: m.tier,
        price: m.price,
      })),
    };

    await saveOrder(db, {
      order_id: id,
      status: 'checkout_created',
      domain,
      customer_name: payload.fullName,
      company_name: payload.companyName,
      billing: payload.billing,
      launch_plan: plan.name,
      catalog_codes: [plan.code, ...compactConfig.modules.map((m) => m.code).filter(Boolean)],
      monthly_total: monthlyTotal,
      domain_verification_token: domainToken,
      domain_status: 'pending_dns_verification',
      config: compactConfig,
    });

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: id,
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      // Payment methods are controlled from the Stripe Dashboard so cards,
      // Apple Pay, Google Pay, Link, and PayPal can appear when eligible.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountFor(payload),
            recurring: { interval: intervalFor(payload) },
            product_data: {
              name: 'Giga-Sphere OS Configured Workspace',
              description: `${plan.name}: ${payload.modules.length} configured module${payload.modules.length === 1 ? '' : 's'} for ${domain}. Subscription fees include a 30-day money-back guarantee; domain registration and custom build work are non-refundable once started.`,
              metadata: {
                order_id: id,
                domain,
              },
            },
          },
        },
      ],
      success_url: `${origin}/?checkout=success&order=${encodeURIComponent(id)}`,
      cancel_url: `${origin}/?checkout=cancelled&order=${encodeURIComponent(id)}`,
      metadata: {
        order_id: id,
        domain,
        domain_verification_token: domainToken,
        product: 'gigasphere_configured_workspace',
        billing: payload.billing,
        launch_plan: plan.name,
        launch_plan_code: plan.code,
        monthly_total: String(monthlyTotal),
        module_count: String(payload.modules.length),
      },
      subscription_data: {
        metadata: {
          order_id: id,
          domain,
          domain_verification_token: domainToken,
          product: 'gigasphere_configured_workspace',
        },
      },
    });

    await saveOrder(db, {
      order_id: id,
      status: 'stripe_session_created',
      domain,
      customer_name: payload.fullName,
      company_name: payload.companyName,
      billing: payload.billing,
      launch_plan: plan.name,
      catalog_codes: [plan.code, ...compactConfig.modules.map((m) => m.code).filter(Boolean)],
      monthly_total: monthlyTotal,
      stripe_session_id: session.id,
      domain_verification_token: domainToken,
      domain_status: 'pending_dns_verification',
      config: compactConfig,
    });

    return json(res, 200, { orderId: id, checkoutUrl: session.url });
  } catch (err) {
    console.error('[gigabuild] checkout failed:', err);
    return json(res, err.statusCode || 500, {
      error: 'Checkout is not fully configured yet. Giga-Sphere needs Stripe and provisioning environment variables before live orders can be accepted.',
      message: err.statusCode ? err.message : undefined,
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}
