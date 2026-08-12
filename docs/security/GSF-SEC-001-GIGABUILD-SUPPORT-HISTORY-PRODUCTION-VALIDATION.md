# GSF-SEC-001 — GigaBuild support-history production validation

The route now fails closed unless a trusted server-side auth adapter supplies
the authenticated user, tenant, and business context. The repository does not
prove which deployment middleware will populate `req.authContext`, so this
branch does not claim live provider authentication or RLS readiness.

Before production promotion, bind the route to the canonical GigaSphere
session verifier and verify issuer, audience, signature, expiry, revocation, and
active tenant membership. Then validate the actual support and incident schema:
tenant columns, RLS policies, service-role grants, and least-privilege route
access. Run isolated cross-tenant, missing-membership, IDOR, forged-context,
rate-limit, and safe-error tests against the deployed adapter.

Classification: `READY_FOR_PRODUCTION_VALIDATION`, not production proven.
