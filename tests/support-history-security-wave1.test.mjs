import assert from 'node:assert/strict';
import test from 'node:test';
import { allowlistedRecord, authorizeTenantScope, createSupportHistoryHandler, resolveTrustedAuthContext } from '../api/support-history.js';

const trusted = { trusted: true, userId: 'user-a', tenantId: 'tenant-a', businessId: 'business-a', roles: ['SUPPORT'] };
function response() { return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, end() { return this; } }; }

test('support history fails closed without a trusted server auth context', () => {
  assert.equal(resolveTrustedAuthContext({ headers: { 'x-tenant-id': 'tenant-a' } }), null);
  assert.equal(authorizeTenantScope(null, {} ).allowed, false);
});

test('support history rejects cross-tenant tampering and strips authority fields', () => {
  assert.equal(authorizeTenantScope(trusted, { tenant_id: 'tenant-b' }).code, 'FORBIDDEN');
  const record = allowlistedRecord({ message: 'hello', tenant_id: 'tenant-b', business_id: 'business-b', role: 'ADMIN', actor_user_id: 'attacker' }, trusted, 'support');
  assert.equal(record.tenant_id, 'tenant-a');
  assert.equal(record.business_id, 'business-a');
  assert.equal(record.actor_user_id, 'user-a');
  assert.equal(record.role, undefined);
});

test('actual support history handler returns generic unauthenticated and method errors', async () => {
  const unauth = response();
  await createSupportHistoryHandler({ getDb: () => { throw new Error('must not open db'); } })({ method: 'GET', query: {} }, unauth);
  assert.equal(unauth.statusCode, 401);
  const method = response();
  await createSupportHistoryHandler({ getDb: () => ({}) })({ method: 'PUT', authContext: trusted, query: {}, body: {} }, method);
  assert.equal(method.statusCode, 405);
  assert.equal(method.body.error, 'METHOD_NOT_ALLOWED');
});
