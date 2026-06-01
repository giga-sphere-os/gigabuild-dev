import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { resolveTxt } from 'node:dns/promises';

export const config = {
  api: {
    bodyParser: false,
  },
};

function stripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
}

function supabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase order storage is not configured');
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function updateOrder(orderId, patch) {
  const db = supabase();
  if (!orderId) return;
  const { error } = await db
    .from('gigabuild_orders')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('order_id', orderId);
  if (error) throw new Error(`Order update failed: ${error.message}`);
}

async function getOrder(orderId) {
  const { data, error } = await supabase()
    .from('gigabuild_orders')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) throw new Error(`Order lookup failed: ${error.message}`);
  return data;
}

async function getOrderForEvent(orderId, eventId) {
  const order = await getOrder(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (order.stripe_event_id === eventId) return { order, duplicate: true };
  return { order, duplicate: false };
}

async function domainIsVerified(domain, token) {
  if (!token) return false;
  const records = await resolveTxt(`_gigabuild.${domain}`).catch(() => []);
  return records.flat().some((value) => value.trim() === token);
}

async function addDomainToVercel(domain) {
  if (!process.env.VERCEL_TOKEN || !process.env.VERCEL_PROJECT_ID) {
    return { skipped: true, reason: 'VERCEL_TOKEN or VERCEL_PROJECT_ID missing' };
  }

  const teamQuery = process.env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : '';
  const response = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(process.env.VERCEL_PROJECT_ID)}/domains${teamQuery}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    },
  );

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Vercel domain add failed: ${body?.error?.message || response.status}`);
  }
  return { skipped: false, body };
}

async function handleCheckoutCompleted(session, eventId) {
  const orderId = session.metadata?.order_id || session.client_reference_id;
  const domain = session.metadata?.domain;
  if (!orderId || !domain) return;

  const { order, duplicate } = await getOrderForEvent(orderId, eventId);
  if (duplicate) return;

  if (session.mode !== 'subscription' || session.payment_status !== 'paid' || !session.subscription) {
    await updateOrder(orderId, {
      status: 'payment_not_validated',
      stripe_event_id: eventId,
      domain_status: 'blocked_until_payment_validates',
    });
    return;
  }

  const subscription = await stripe().subscriptions.retrieve(session.subscription);
  if (!['active', 'trialing'].includes(subscription.status)) {
    await updateOrder(orderId, {
      status: 'subscription_not_active',
      stripe_event_id: eventId,
      stripe_session_id: session.id,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      domain_status: `blocked_subscription_${subscription.status}`,
    });
    return;
  }

  await updateOrder(orderId, {
    status: 'paid',
    stripe_event_id: eventId,
    stripe_session_id: session.id,
    stripe_customer_id: session.customer,
    stripe_subscription_id: session.subscription,
  });

  const token = order.domain_verification_token || session.metadata?.domain_verification_token;
  const verified = await domainIsVerified(domain, token);
  if (!verified) {
    await updateOrder(orderId, {
      status: 'paid_pending_domain_verification',
      stripe_event_id: eventId,
      domain_status: `Add TXT _gigabuild.${domain} = ${token}`,
    });
    return;
  }

  try {
    const vercelResult = await addDomainToVercel(domain);
    await updateOrder(orderId, {
      status: vercelResult.skipped ? 'paid_pending_domain_setup' : 'domain_submitted',
      stripe_event_id: eventId,
      domain_status: vercelResult.skipped ? vercelResult.reason : 'submitted_to_vercel',
    });
  } catch (err) {
    console.error('[gigabuild] domain provisioning failed:', err);
    await updateOrder(orderId, {
      status: 'paid_domain_error',
      stripe_event_id: eventId,
      domain_status: err.message,
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Stripe webhook is not configured' });
  }

  const signature = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe().webhooks.constructEvent(
      await getRawBody(req),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('[gigabuild] webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object, event.id);
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[gigabuild] webhook handler failed:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
