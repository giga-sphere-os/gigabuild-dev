import { createClient } from '@supabase/supabase-js';

const SUPPORT_TABLE = 'gigasphere_support_history';
const INCIDENT_TABLE = 'gigasphere_incident_history';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 60;
const rateBuckets = new Map();

function safeError(res, status = 503, code = 'SERVICE_UNAVAILABLE') {
  return res.status(status).json({ ok: false, error: code });
}

function logSecurity(event, context = {}) {
  console.warn('[support-history-security]', { event, requestId: context.requestId || null, userId: context.userId || null, tenantId: context.tenantId || null });
}

export function resolveTrustedAuthContext(req = {}) {
  const value = req.authContext;
  if (!value || value.trusted !== true || typeof value.userId !== 'string' || typeof value.tenantId !== 'string' || typeof value.businessId !== 'string') return null;
  return Object.freeze({
    userId: value.userId,
    tenantId: value.tenantId,
    businessId: value.businessId,
    roles: Array.isArray(value.roles) ? [...value.roles] : [],
    requestId: typeof value.requestId === 'string' ? value.requestId : null,
  });
}

export function authorizeTenantScope(context, supplied = {}) {
  if (!context?.tenantId || !context?.businessId) return { allowed: false, code: 'UNAUTHENTICATED' };
  if ((supplied.tenant_id && supplied.tenant_id !== context.tenantId) || (supplied.tenantId && supplied.tenantId !== context.tenantId) || (supplied.business_id && supplied.business_id !== context.businessId) || (supplied.businessId && supplied.businessId !== context.businessId)) return { allowed: false, code: 'FORBIDDEN' };
  return { allowed: true, code: null };
}

export function allowlistedRecord(input = {}, context, kind) {
  const fields = kind === 'incident'
    ? ['incident_id', 'support_case_id', 'severity', 'status', 'remediation_owner', 'resolution_evidence', 'incident_summary', 'detected_at', 'resolved_at', 'category', 'route_id', 'escalation_path', 'recommendation_id', 'evidence_refs']
    : ['support_case_id', 'record_type', 'category', 'severity', 'route_id', 'owner', 'escalation_path', 'requires_founder', 'status', 'message', 'recommendation_id', 'incident_id', 'evidence_refs'];
  const output = {};
  for (const field of fields) if (input[field] !== undefined) output[field] = input[field];
  const id = kind === 'incident' ? (output.incident_id || input.id) : (output.support_case_id || input.id);
  if (id) output[kind === 'incident' ? 'incident_id' : 'support_case_id'] = String(id);
  output.tenant_id = context.tenantId;
  output.business_id = context.businessId;
  output.actor_user_id = context.userId;
  output.product = 'GigaBuild';
  output.updated_at = new Date().toISOString();
  return output;
}

function withinRateLimit(context) {
  const key = `${context.tenantId}:${context.userId}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start >= RATE_WINDOW_MS) { bucket.start = now; bucket.count = 0; }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count <= RATE_LIMIT;
}

function dbClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('storage unavailable');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(String(value || DEFAULT_LIMIT), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : DEFAULT_LIMIT;
}

function applyFilters(query, context, params = {}) {
  query = query.eq('tenant_id', context.tenantId).eq('business_id', context.businessId);
  for (const field of ['category', 'severity', 'status', 'product']) if (params[field]) query = query.eq(field, String(params[field]));
  return query;
}

export function createSupportHistoryHandler({ getDb = dbClient } = {}) {
  return async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(204).end();
    const context = resolveTrustedAuthContext(req);
    if (!context) { logSecurity('missing_trusted_auth'); return safeError(res, 401, 'UNAUTHENTICATED'); }
    if (!withinRateLimit(context)) { logSecurity('rate_limited', context); return safeError(res, 429, 'RATE_LIMITED'); }
    const scope = authorizeTenantScope(context, { ...(req.query || {}), ...(req.body || {}) });
    if (!scope.allowed) { logSecurity('tenant_scope_denied', context); return safeError(res, scope.code === 'UNAUTHENTICATED' ? 401 : 403, scope.code); }
    try {
      const db = getDb();
      if (req.method === 'GET') {
        const params = req.query || {};
        const type = params.type === 'incident' ? 'incident' : params.type === 'support' ? 'support' : 'both';
        const limit = normalizeLimit(params.limit);
        const response = {};
        if (type === 'support' || type === 'both') {
          const { data, error } = await applyFilters(db.from(SUPPORT_TABLE).select('*').order('created_at', { ascending: false }).limit(limit), context, params);
          if (error) throw error;
          response.support = data || [];
        }
        if (type === 'incident' || type === 'both') {
          const { data, error } = await applyFilters(db.from(INCIDENT_TABLE).select('*').order('created_at', { ascending: false }).limit(limit), context, params);
          if (error) throw error;
          response.incident = data || [];
        }
        return res.status(200).json({ ok: true, ...response });
      }
      if (req.method !== 'POST') return safeError(res, 405, 'METHOD_NOT_ALLOWED');
      const body = req.body || {};
      const supportInput = body.supportRecord || body.support_case || body.supportCase;
      const incidentInput = body.incidentRecord || body.incident;
      if (!supportInput && !incidentInput) return safeError(res, 400, 'RECORD_REQUIRED');
      const response = {};
      if (supportInput) {
        const record = allowlistedRecord(supportInput, context, 'support');
        const { data, error } = await db.from(SUPPORT_TABLE).upsert(record, { onConflict: 'support_case_id' }).select('*').maybeSingle();
        if (error) throw error;
        response.support = data || record;
      }
      if (incidentInput) {
        const record = allowlistedRecord(incidentInput, context, 'incident');
        const { data, error } = await db.from(INCIDENT_TABLE).upsert(record, { onConflict: 'incident_id' }).select('*').maybeSingle();
        if (error) throw error;
        response.incident = data || record;
      }
      return res.status(200).json({ ok: true, ...response });
    } catch (error) {
      logSecurity('storage_failure', context);
      return safeError(res);
    }
  };
}

export default createSupportHistoryHandler();
