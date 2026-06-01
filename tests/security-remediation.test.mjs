import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('configurator has continuous draft save and resume UI', async () => {
  const [html, js] = await Promise.all([read('index.html'), read('app.js')]);
  assert.match(html, /id="resumeBanner"/);
  assert.match(js, /const DRAFT_KEY = 'gigaBuildDraft'/);
  assert.match(js, /function scheduleDraftSave\(\)/);
  assert.match(js, /function maybeOfferResume\(\)/);
});

test('assistant messages are rendered as text nodes, not HTML strings', async () => {
  const js = await read('app.js');
  assert.match(js, /bubble\.textContent = message\.text/);
  assert.doesNotMatch(js, /log\.innerHTML\s*=\s*messages\.map/);
});

test('assistant refuses jailbreaks and redacts sensitive support text', async () => {
  const js = await read('app.js');
  assert.match(js, /const adversarialWords = \[/);
  assert.match(js, /I cannot help with requests to bypass instructions/);
  assert.match(js, /function redactSensitiveText\(value\)/);
  assert.match(js, /REDACTED_CARD/);
  assert.match(js, /REDACTED_PASSWORD/);
  assert.match(js, /sessionStorage\.setItem\('gbuild_support_cases_v1'/);
});

test('checkout and webhook enforce payment and domain safety gates', async () => {
  const [checkout, webhook, sql] = await Promise.all([
    read('api/create-checkout.js'),
    read('api/stripe-webhook.js'),
    read('supabase/gigabuild_orders.sql'),
  ]);
  assert.match(checkout, /ensureDomainAvailable/);
  assert.match(checkout, /domain_verification_token/);
  assert.match(webhook, /session\.payment_status !== 'paid'/);
  assert.match(webhook, /subscriptions\.retrieve/);
  assert.match(webhook, /domainIsVerified/);
  assert.doesNotMatch(webhook, /domain_already_in_use/);
  assert.match(sql, /gigabuild_orders_domain_unique_idx/);
});

test('app store readiness links exist', async () => {
  const [html, privacy, deletion] = await Promise.all([
    read('index.html'),
    read('privacy.html'),
    read('delete-account.html'),
  ]);
  assert.match(html, /Privacy Policy/);
  assert.match(html, /Delete account\/data/);
  assert.match(privacy, /privacy@gigasphere\.io/);
  assert.match(deletion, /Delete GigaBuild Account\/Data/);
});

test('native app mode does not expose Stripe checkout as an in-app purchase path', async () => {
  const [html, js, css, cap] = await Promise.all([
    read('index.html'),
    read('app.js'),
    read('styles.css'),
    read('capacitor.config.json'),
  ]);
  assert.match(cap, /"appId": "io\.gigasphere\.gigabuild"/);
  assert.match(html, /data-web-commerce-only/);
  assert.match(html, /data-native-commerce-note/);
  assert.match(js, /function isNativeApp\(\)/);
  assert.match(js, /Workspace payment and launch are completed outside the native app/);
  assert.match(css, /body\.gb-native \.checkout-panel/);
});
