# NFR Requirements -- UOW-01: Foundation & Auth

## Overview

Non-functional requirements for UOW-01 scoped to: project scaffolding, Prisma schema, Docker Compose, authentication (better-auth), base layout, authStore, and uiStore. Each NFR has a unique ID (NFR-01-XXX), measurable target, verification method, and SECURITY rule mapping where applicable.

---

## Performance

### NFR-01-001: Page Load Time

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Initial page load time must be under 3 seconds |
| **Metric/Target** | LCP (Largest Contentful Paint) < 3s on 4G connection (simulated throttle) |
| **SECURITY Mapping** | N/A |
| **Verification** | Lighthouse audit on /login and /board pages; LCP metric < 3000ms. Chrome DevTools Performance tab with "Fast 3G" throttling. |

### NFR-01-002: Auth API Response Time

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Auth API endpoints must respond within 500ms |
| **Metric/Target** | P95 response time < 500ms for POST /api/auth/register, POST /api/auth/login, GET /api/auth/me |
| **SECURITY Mapping** | N/A |
| **Verification** | Manual timing via browser DevTools Network tab. Measure 20 consecutive requests; P95 must be under 500ms. During development, use `console.time`/`console.timeEnd` around auth service calls. |

### NFR-01-003: Client-Side Navigation Speed

| Field | Value |
|-------|-------|
| **Category** | Performance |
| **Requirement** | Client-side route transitions must complete within 200ms |
| **Metric/Target** | Navigation between /login, /register, /board, /settings < 200ms (measured as time from click to rendered content) |
| **SECURITY Mapping** | N/A |
| **Verification** | Next.js App Router prefetching enabled. Measure via Performance API `navigation` entries or React Profiler. No full-page reloads on internal navigation. |

---

## Security

### NFR-01-004: Password Hashing Algorithm

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Passwords must be hashed using bcrypt via better-auth with minimum 10 salt rounds |
| **Metric/Target** | bcrypt with cost factor >= 10 (better-auth default). No plaintext or reversible password storage. |
| **SECURITY Mapping** | SECURITY-12 (Authentication and Credential Management) |
| **Verification** | Inspect better-auth configuration for password hashing settings. Query DB to confirm passwordHash column contains bcrypt-format strings (`$2b$10$...`). Attempt to decode -- must fail. |

### NFR-01-005: Session Cookie Security

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Session cookies must use httpOnly, secure (production), and sameSite=lax attributes |
| **Metric/Target** | Cookie attributes: `HttpOnly=true`, `Secure=true` (when NODE_ENV=production), `SameSite=Lax` |
| **SECURITY Mapping** | SECURITY-12 (Authentication and Credential Management) |
| **Verification** | Inspect Set-Cookie header via browser DevTools Application > Cookies. Verify all three attributes present. Attempt to read cookie via `document.cookie` in console -- must not appear. |

### NFR-01-006: Login Rate Limiting

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Login endpoint must enforce rate limiting: max 5 failed attempts per email per 15-minute window |
| **Metric/Target** | 6th failed login attempt within 15 minutes returns 429. Counter resets after window expiration or successful login. |
| **SECURITY Mapping** | SECURITY-12 (Authentication and Credential Management) |
| **Verification** | Send 5 consecutive failed login requests for same email. 6th request must return HTTP 429 with generic error message. Wait 15 minutes (or mock timer), confirm 6th attempt succeeds. |

### NFR-01-007: HTTP Security Headers

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Next.js middleware must set CSP, HSTS, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy headers |
| **Metric/Target** | All HTML responses include: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` |
| **SECURITY Mapping** | SECURITY-04 (HTTP Security Headers) |
| **Verification** | Inspect response headers via `curl -I` or browser DevTools Network tab. All 5 headers present with correct values. CSP does not include `unsafe-eval`. HSTS max-age >= 31536000. |

### NFR-01-008: Input Validation on Auth Endpoints

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | All auth API endpoints must validate input using Zod schemas before processing |
| **Metric/Target** | Every field validated: email (format), password (min 8, complexity), name (min 1, max 100). Invalid input returns 400 with field-level errors. No raw input reaches DB queries. |
| **SECURITY Mapping** | SECURITY-05 (Input Validation) |
| **Verification** | Send malformed payloads to /api/auth/register and /api/auth/login: empty body, missing fields, SQL injection strings, XSS payloads, oversized strings (10K chars). All must return 400 with validation errors. No server errors (500). |

### NFR-01-009: Generic Error Messages

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Auth error responses must not reveal whether an email exists in the system |
| **Metric/Target** | Login with non-existent email and login with wrong password return identical response body and similar response time (within 100ms variance). Message: "Invalid email or password". |
| **SECURITY Mapping** | SECURITY-09 (Hardening and Misconfiguration Prevention) |
| **Verification** | Compare response bodies and timing for: (a) valid email + wrong password, (b) non-existent email + any password. Bodies must be identical. Timing variance < 100ms (prevent timing attacks). |

### NFR-01-010: No Secrets in Source Code

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | No passwords, API keys, database URLs, or secrets committed to source code. All secrets via .env files excluded from VCS. |
| **Metric/Target** | Zero secrets in tracked files. `.env` in `.gitignore`. `.env.example` contains placeholder values only. |
| **SECURITY Mapping** | SECURITY-12 (Authentication and Credential Management) |
| **Verification** | `grep -r "sk-ant-\|password=\|DATABASE_URL=" src/` returns zero results. `.gitignore` includes `.env`. `.env.example` exists with dummy values (e.g., `DATABASE_URL=postgresql://user:password@localhost:5432/autocoder`). |

### NFR-01-011: Global Error Handler

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Next.js must have a global error handler that returns safe responses without stack traces in production |
| **Metric/Target** | `app/error.tsx` (client boundary) and `app/global-error.tsx` exist. API routes wrapped in try/catch returning `{ error: "Something went wrong" }` on unhandled exceptions. No stack traces in response body when NODE_ENV=production. |
| **SECURITY Mapping** | SECURITY-15 (Exception Handling and Fail-Safe Defaults) |
| **Verification** | Trigger an unhandled error in an API route (e.g., throw manually). Verify response is `{ error: "Something went wrong" }` with status 500. Response body contains no file paths, line numbers, or stack frames. Error is logged server-side with correlation ID. |

### NFR-01-012: CSRF Protection

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | CSRF protection must be enabled on all state-changing endpoints via better-auth |
| **Metric/Target** | better-auth CSRF token validation active. State-changing requests (POST, PATCH, DELETE) without valid CSRF token return 403. |
| **SECURITY Mapping** | SECURITY-08 (Application-Level Access Control) |
| **Verification** | Attempt POST /api/auth/login from a different origin without CSRF token. Request must be rejected. Verify better-auth CSRF configuration is enabled (default behavior). |

### NFR-01-013: Structured Logging with Correlation IDs

| Field | Value |
|-------|-------|
| **Category** | Security |
| **Requirement** | Application logging must be structured (JSON) with correlation IDs on every request |
| **Metric/Target** | Every log entry includes: `timestamp` (ISO 8601), `correlationId` (UUID per request), `level` (info/warn/error), `message`. No PII (passwords, full emails) in logs. |
| **SECURITY Mapping** | SECURITY-03 (Application-Level Logging) |
| **Verification** | Inspect server console output during auth operations. Each log line is valid JSON with all required fields. Search for password or raw email in log output -- must not appear. Correlation ID consistent across a single request lifecycle. |

---

## Reliability

### NFR-01-014: Graceful DB Connection Failure

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Application must handle database connection failures gracefully without crashing |
| **Metric/Target** | When PostgreSQL is unreachable: API routes return HTTP 503 with `{ error: "Service temporarily unavailable" }`. UI shows error toast. Application process remains running. |
| **SECURITY Mapping** | SECURITY-15 (fail closed) |
| **Verification** | Stop Docker PostgreSQL container. Send login request. Verify 503 response (not 500 with stack trace). Restart container. Verify app auto-reconnects on next request. No process crash during outage. |

### NFR-01-015: Session Recovery After Restart

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | User sessions must persist across server restarts (DB-backed sessions) |
| **Metric/Target** | Sessions stored in PostgreSQL via better-auth Prisma adapter. After `npm run dev` restart, existing session cookies still authenticate successfully. |
| **SECURITY Mapping** | N/A |
| **Verification** | Log in, note session cookie. Restart dev server. Send GET /api/auth/me with same cookie. Response must return authenticated user data (not 401). |

### NFR-01-016: Prisma Connection Pooling

| Field | Value |
|-------|-------|
| **Category** | Reliability |
| **Requirement** | Prisma client must use connection pooling to prevent connection exhaustion |
| **Metric/Target** | Prisma client instantiated as singleton (one instance per process). Default pool size used (Prisma default: `connection_limit` based on CPU cores). No "too many connections" errors under normal load. |
| **SECURITY Mapping** | N/A |
| **Verification** | Inspect `lib/db/prisma.ts` for singleton pattern (`globalThis` caching in development). Send 20 concurrent auth requests. No connection pool exhaustion errors. |

---

## Usability

### NFR-01-017: Responsive Layout Breakpoints

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Layout must be responsive across desktop (1280px+), tablet (768px+), and mobile (375px+) |
| **Metric/Target** | Desktop: full sidebar (240px) + main content. Tablet: collapsed sidebar (64px icons). Mobile: hidden sidebar with overlay toggle. No horizontal scroll at any breakpoint. |
| **SECURITY Mapping** | N/A |
| **Verification** | Resize browser to 1280px, 768px, and 375px widths. At each: no overflow, no broken layout, all interactive elements reachable. Test on Chrome DevTools device emulation. |

### NFR-01-018: Loading Skeletons on Auth Pages

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Auth pages must show loading indicators during form submission |
| **Metric/Target** | Submit button shows spinner/disabled state during API call. Form fields disabled during submission. Skeleton not needed for initial page render (static forms). |
| **SECURITY Mapping** | N/A |
| **Verification** | Click Login/Register with valid data. Button must show loading state within 100ms of click. Button must be non-clickable during loading (prevents double submission). Loading state clears on success or error. |

### NFR-01-019: Toast Notifications

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Success and error states must show toast notifications |
| **Metric/Target** | Success: green toast, auto-dismiss after 3s. Error: red toast, persists until dismissed. Position: top-right. Max 3 stacked toasts. Accessible (role="alert"). |
| **SECURITY Mapping** | N/A |
| **Verification** | Trigger success (register) and error (invalid login) actions. Toast appears within 200ms. Success toast auto-dismisses. Error toast requires manual dismiss. Screen reader announces toast content. |

### NFR-01-020: Keyboard Navigation

| Field | Value |
|-------|-------|
| **Category** | Usability |
| **Requirement** | Auth forms and layout navigation must support keyboard-only operation |
| **Metric/Target** | Tab order follows visual layout. Enter submits forms. Escape closes dropdowns/modals. Focus visible on all interactive elements (2px ring). |
| **SECURITY Mapping** | N/A |
| **Verification** | Navigate login form using only keyboard: Tab through email, password, submit. Enter to submit. Tab to "Register" link. All elements show visible focus indicator. No focus traps (except modals). |

---

## Maintainability

### NFR-01-021: Zod Schemas as Single Source of Truth

| Field | Value |
|-------|-------|
| **Category** | Maintainability |
| **Requirement** | Zod schemas must be the single source of truth for validation, shared between client forms and API routes |
| **Metric/Target** | One schema definition per entity (e.g., `registerSchema` in `lib/validations/auth-schemas.ts`). Client forms import and use the same schema. API routes import and use the same schema. No duplicate validation logic. |
| **SECURITY Mapping** | SECURITY-05 (Input Validation) |
| **Verification** | Inspect `lib/validations/auth-schemas.ts`. Verify `registerSchema` and `loginSchema` exist. Search for duplicate Zod schemas or manual validation in form components and API routes -- must find only imports from the shared file. |

### NFR-01-022: Environment Variables with Zod Validation

| Field | Value |
|-------|-------|
| **Category** | Maintainability |
| **Requirement** | Environment variables must be loaded via .env and validated at startup with Zod |
| **Metric/Target** | `lib/env.ts` exports validated env config. Required vars: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `NODE_ENV`. App fails fast on missing/invalid env vars at startup with descriptive error. |
| **SECURITY Mapping** | SECURITY-12 (no hardcoded credentials) |
| **Verification** | Remove `DATABASE_URL` from .env. Start dev server. Must fail immediately with error: "Missing required environment variable: DATABASE_URL". Restore and verify normal startup. |

### NFR-01-023: TypeScript Strict Mode

| Field | Value |
|-------|-------|
| **Category** | Maintainability |
| **Requirement** | TypeScript must be configured with strict mode enabled |
| **Metric/Target** | `tsconfig.json` includes `"strict": true`. No `@ts-ignore` or `any` types except with documented justification. Zero TypeScript errors on `npx tsc --noEmit`. |
| **SECURITY Mapping** | N/A |
| **Verification** | Inspect `tsconfig.json` for `"strict": true`. Run `npx tsc --noEmit` -- must exit with code 0. Search for `@ts-ignore` and `: any` in src/ -- must be zero or have inline justification comments. |

---

## SECURITY Compliance Matrix

Mapping of all 15 SECURITY baseline rules to UOW-01 applicability.

| SECURITY Rule | Rule Name | Applicable to UOW-01? | Implementation | NFR ID |
|---------------|-----------|----------------------|----------------|--------|
| SECURITY-01 | Encryption at Rest and in Transit | Partial | PostgreSQL via Docker uses local connection (no TLS in dev). Production: enforce `sslmode=require` in DATABASE_URL. Passwords encrypted via bcrypt. | NFR-01-004 |
| SECURITY-02 | Access Logging on Network Intermediaries | N/A | No load balancers, API gateways, or CDN in UOW-01 scope. Local dev only. Applicable in Operations phase. | -- |
| SECURITY-03 | Application-Level Logging | Yes | Structured JSON logging with correlation IDs. Logger configured in lib/logger.ts. No PII in logs. | NFR-01-013 |
| SECURITY-04 | HTTP Security Headers | Yes | Next.js middleware sets CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy on all responses. | NFR-01-007 |
| SECURITY-05 | Input Validation | Yes | Zod schemas validate all auth endpoint inputs. Shared schemas between client and server. Max-length constraints on all string fields. | NFR-01-008, NFR-01-021 |
| SECURITY-06 | Least-Privilege Access | Partial | Prisma queries scoped to authenticated user's ID. No wildcard permissions. Object-level auth via `userId` filter on all queries. | NFR-01-012 |
| SECURITY-07 | Restrictive Network Configuration | N/A | No cloud networking in UOW-01 scope. Docker Compose exposes PostgreSQL on localhost only (127.0.0.1:5432). Applicable in Operations phase. | -- |
| SECURITY-08 | Application-Level Access Control | Yes | better-auth CSRF protection. Deny-by-default routing (middleware redirects unauthenticated users). Session token validated server-side on every request. | NFR-01-012 |
| SECURITY-09 | Hardening and Misconfiguration Prevention | Yes | Generic auth error messages prevent credential enumeration. No stack traces in production error responses. No default credentials. | NFR-01-009, NFR-01-011 |
| SECURITY-10 | Software Supply Chain Security | Partial | Lock file (package-lock.json) committed. Exact versions in package.json. No unused dependencies. Full vulnerability scanning deferred to CI/CD setup. | NFR-01-022 |
| SECURITY-11 | Secure Design Principles | Yes | Auth logic isolated in lib/auth/. Validation isolated in lib/validations/. Rate limiting on login endpoint. Defense in depth: validation + auth + session checks layered. | NFR-01-006, NFR-01-021 |
| SECURITY-12 | Authentication and Credential Management | Yes | bcrypt hashing (min 10 rounds). Secure session cookies (httpOnly, secure, sameSite). Rate limiting on login. No hardcoded credentials. Env vars via .env. | NFR-01-004, NFR-01-005, NFR-01-006, NFR-01-010 |
| SECURITY-13 | Software and Data Integrity | Partial | No external CDN scripts (all bundled). Prisma migrations versioned. Lock file committed. SRI not applicable (no CDN resources in UOW-01). | -- |
| SECURITY-14 | Alerting and Monitoring | N/A | No alerting infrastructure in UOW-01 scope. Structured logging (SECURITY-03) provides foundation. Alerting applicable in Operations phase. | NFR-01-013 (foundation) |
| SECURITY-15 | Exception Handling and Fail-Safe Defaults | Yes | Global error handler (app/error.tsx, app/global-error.tsx). API routes wrapped in try/catch. Fail closed on auth errors. Resource cleanup in Prisma client. Safe error responses. | NFR-01-011, NFR-01-014 |

---

## NFR Summary Matrix

| NFR ID | Category | Short Description | Target | SECURITY Rule |
|--------|----------|------------------|--------|---------------|
| NFR-01-001 | Performance | Page load time | LCP < 3s | -- |
| NFR-01-002 | Performance | Auth API response | P95 < 500ms | -- |
| NFR-01-003 | Performance | Client navigation | < 200ms | -- |
| NFR-01-004 | Security | Password hashing | bcrypt, 10+ rounds | SECURITY-12 |
| NFR-01-005 | Security | Session cookies | httpOnly, secure, sameSite=lax | SECURITY-12 |
| NFR-01-006 | Security | Login rate limiting | 5 attempts / 15 min | SECURITY-12 |
| NFR-01-007 | Security | HTTP security headers | CSP, HSTS, X-Content-Type, X-Frame, Referrer | SECURITY-04 |
| NFR-01-008 | Security | Input validation | Zod on all auth endpoints | SECURITY-05 |
| NFR-01-009 | Security | Generic errors | No credential enumeration | SECURITY-09 |
| NFR-01-010 | Security | No secrets in code | .env only, .gitignore | SECURITY-12 |
| NFR-01-011 | Security | Global error handler | Safe responses, no stack traces | SECURITY-15 |
| NFR-01-012 | Security | CSRF protection | better-auth CSRF tokens | SECURITY-08 |
| NFR-01-013 | Security | Structured logging | JSON, correlation IDs, no PII | SECURITY-03 |
| NFR-01-014 | Reliability | DB failure handling | 503 response, no crash | SECURITY-15 |
| NFR-01-015 | Reliability | Session recovery | DB-persisted, survives restart | -- |
| NFR-01-016 | Reliability | Connection pooling | Prisma singleton, default pool | -- |
| NFR-01-017 | Usability | Responsive layout | 1280px / 768px / 375px | -- |
| NFR-01-018 | Usability | Loading skeletons | Spinner on auth submission | -- |
| NFR-01-019 | Usability | Toast notifications | Success/error, auto-dismiss | -- |
| NFR-01-020 | Usability | Keyboard navigation | Tab order, enter submit, focus ring | -- |
| NFR-01-021 | Maintainability | Shared Zod schemas | Single source, client + server | SECURITY-05 |
| NFR-01-022 | Maintainability | Env var validation | Zod-validated config, fail-fast | SECURITY-12 |
| NFR-01-023 | Maintainability | TypeScript strict | strict: true, zero errors | -- |
