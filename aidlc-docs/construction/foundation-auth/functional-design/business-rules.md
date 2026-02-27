# Business Rules -- UOW-01: Foundation & Auth

## Overview

All business rules for UOW-01 are listed below with unique IDs (BR-01-XXX), rule statement, validation logic, and error messages. Rules are grouped by domain: Registration, Login, Session, API Key, Layout.

---

## Registration Rules

### BR-01-001: Email Format Validation

| Field | Value |
|-------|-------|
| **Rule** | Email must be a valid format (RFC 5322 simplified) |
| **Validation** | Zod `z.string().email()` on client and server. Checks for `local@domain.tld` pattern with valid characters. |
| **Error Message** | "Please enter a valid email address" |
| **Enforcement** | Client-side (inline, on blur + submit), Server-side (better-auth input validation) |
| **Stories** | US-001 |

### BR-01-002: Email Uniqueness

| Field | Value |
|-------|-------|
| **Rule** | Email must be unique across all users (case-insensitive) |
| **Validation** | better-auth performs case-insensitive lookup via Prisma `findUnique` with `email` field lowercased before storage. Duplicate detected at DB constraint level. |
| **Error Message** | "Email already registered" |
| **Enforcement** | Server-side (better-auth returns error on duplicate) |
| **Stories** | US-001 |

### BR-01-003: Password Minimum Length

| Field | Value |
|-------|-------|
| **Rule** | Password must be at least 8 characters |
| **Validation** | Zod `z.string().min(8)`. Checked before submission. |
| **Error Message** | "Password must be at least 8 characters" |
| **Enforcement** | Client-side (inline), Server-side (Zod schema in better-auth config or custom validator) |
| **Stories** | US-001 |

### BR-01-004: Password Complexity

| Field | Value |
|-------|-------|
| **Rule** | Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number |
| **Validation** | Zod `.regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)` applied after min length check. |
| **Error Message** | "Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number" |
| **Enforcement** | Client-side (inline, on blur + submit), Server-side (custom password validator in better-auth config) |
| **Stories** | US-001 |

### BR-01-005: Name Required

| Field | Value |
|-------|-------|
| **Rule** | Display name is required, 1-100 characters |
| **Validation** | Zod `z.string().min(1).max(100).trim()`. Leading/trailing whitespace trimmed before validation. |
| **Error Message** | Empty: "Name is required" / Too long: "Name must be 100 characters or fewer" |
| **Enforcement** | Client-side (inline), Server-side (Zod schema) |
| **Stories** | US-001 |

---

## Login Rules

### BR-01-006: Login Rate Limiting

| Field | Value |
|-------|-------|
| **Rule** | Maximum 5 failed login attempts per email address per 15-minute window |
| **Validation** | better-auth `rateLimit` configuration: `window: 900` (seconds), `max: 5`. Tracks failed attempts by IP + email combination. Counter resets after window expires or on successful login. |
| **Error Message** | "Too many login attempts. Please try again later." |
| **Enforcement** | Server-side (better-auth rate limiter) |
| **Stories** | US-002 |

### BR-01-007: Lockout Information Security

| Field | Value |
|-------|-------|
| **Rule** | After lockout, do not reveal whether the email exists in the system |
| **Validation** | Same generic error message used for all failed login scenarios (wrong password, non-existent email, rate limited). No differential response timing. |
| **Error Message** | Rate limited: "Too many login attempts. Please try again later." / Invalid: "Invalid email or password" |
| **Enforcement** | Server-side (better-auth response standardization) |
| **Stories** | US-002 |

### BR-01-008: Generic Login Error

| Field | Value |
|-------|-------|
| **Rule** | On login failure (wrong email or wrong password), show a generic error message |
| **Validation** | better-auth returns 401 with generic message. Client displays the same string regardless of failure reason (email not found vs. wrong password). |
| **Error Message** | "Invalid email or password" |
| **Enforcement** | Server-side (better-auth), Client-side (LoginForm error display) |
| **Stories** | US-002 |

---

## Session Rules

### BR-01-009: Session Expiry

| Field | Value |
|-------|-------|
| **Rule** | Sessions expire after 7 days of inactivity (sliding window) |
| **Validation** | better-auth config: `session.expiresIn = 604800` (7 days in seconds), `session.updateAge = 86400` (refresh every 24 hours). Each authenticated request within the update window extends the expiry by another 7 days. |
| **Error Message** | "Session expired, please log in again." (shown on redirect to /login) |
| **Enforcement** | Server-side (better-auth session management) |
| **Stories** | US-004 |

### BR-01-010: Session Cookie Security

| Field | Value |
|-------|-------|
| **Rule** | Session cookie must be httpOnly, secure (in production), and sameSite=lax |
| **Validation** | better-auth default cookie configuration. `httpOnly: true` prevents JavaScript access. `secure: true` in production (HTTPS only). `sameSite: lax` prevents CSRF on cross-origin POST. |
| **Error Message** | N/A (infrastructure rule, no user-facing error) |
| **Enforcement** | Server-side (better-auth cookie settings) |
| **Stories** | US-004 |

### BR-01-011: Session Invalidation on Logout

| Field | Value |
|-------|-------|
| **Rule** | Session must be fully invalidated on logout (DB record deleted, cookie cleared) |
| **Validation** | better-auth `signOut()` deletes Session record from PostgreSQL and clears the cookie. Subsequent requests with the old cookie are rejected. Browser back button after logout triggers middleware redirect. |
| **Error Message** | N/A (successful operation, no error) |
| **Enforcement** | Server-side (better-auth signOut handler) |
| **Stories** | US-003 |

### BR-01-012: Protected Route Enforcement

| Field | Value |
|-------|-------|
| **Rule** | All dashboard routes require a valid session; unauthenticated requests redirect to /login |
| **Validation** | Next.js middleware calls `auth.api.getSession({ headers })`. If null/expired, returns `NextResponse.redirect('/login')`. Matcher pattern: `/board/:path*`, `/settings/:path*`, `/task/:path*`. |
| **Error Message** | No inline error. User sees login page with optional "Session expired" toast if session was previously valid. |
| **Enforcement** | Server-side (Next.js middleware + better-auth session check) |
| **Stories** | US-004 |

---

## API Key Rules

### BR-01-013: API Key Format Validation

| Field | Value |
|-------|-------|
| **Rule** | API key must start with "sk-ant-" prefix |
| **Validation** | Zod `z.string().startsWith("sk-ant-").min(10)`. Checked on client before save. Minimum total length 10 characters to ensure non-trivial key content after prefix. |
| **Error Message** | "Invalid API key format. Key must start with 'sk-ant-'" |
| **Enforcement** | Client-side (ApiKeyForm validation) |
| **Stories** | US-005 |

### BR-01-014: API Key Storage Location

| Field | Value |
|-------|-------|
| **Rule** | API key stored encrypted in localStorage only; never persisted in the database |
| **Validation** | Key encrypted using Web Crypto API (AES-GCM) before writing to localStorage under key `ac_api_key`. Server-side code never writes the key to any persistent store. Key exists in server memory only during active API request processing. |
| **Error Message** | N/A (infrastructure rule) |
| **Enforcement** | Architecture constraint (client-side storage only) |
| **Stories** | US-005 |

### BR-01-015: API Key Required for Pipeline

| Field | Value |
|-------|-------|
| **Rule** | A valid API key must be present to start any pipeline; block with a clear message if missing |
| **Validation** | Before calling start-pipeline API: check localStorage for `ac_api_key`. If absent, show blocking message instead of starting. Server-side: check `x-anthropic-key` header presence before invoking any agent. |
| **Error Message** | "API key required. Please configure your Anthropic API key in Settings to start pipelines." |
| **Enforcement** | Client-side (pre-flight check in taskStore.startPipeline), Server-side (API route header validation) |
| **Stories** | US-006 |

---

## Layout Rules

### BR-01-016: Sidebar Responsive Widths

| Field | Value |
|-------|-------|
| **Rule** | Sidebar width: 240px expanded (desktop), 64px icon-only (tablet), hidden with overlay (mobile) |
| **Validation** | CSS breakpoints: desktop >= 1024px, tablet 768-1023px, mobile < 768px. State tracked in uiStore.isSidebarCollapsed. On tablet, sidebar auto-collapses. On mobile, sidebar renders as slide-in overlay with backdrop. |
| **Error Message** | N/A (UI behavior rule) |
| **Enforcement** | Client-side (CSS media queries + uiStore state) |
| **Stories** | N/A (infrastructure) |

### BR-01-017: BottomDock Default State

| Field | Value |
|-------|-------|
| **Rule** | BottomDock is collapsed by default on initial load |
| **Validation** | uiStore.isBottomDockOpen initialized to `false`. Toggle persists in session memory only (resets on page reload). Collapsed height: 36px (toggle bar). Expanded height: 300px default. |
| **Error Message** | N/A (UI behavior rule) |
| **Enforcement** | Client-side (uiStore initial state) |
| **Stories** | N/A (infrastructure) |

### BR-01-018: User Menu Content

| Field | Value |
|-------|-------|
| **Rule** | User menu dropdown shows user name, email, and a logout action |
| **Validation** | User name and email read from authStore.user. Logout action calls authStore.logout(). Dropdown rendered via shadcn/ui DropdownMenu component. |
| **Error Message** | N/A (UI behavior rule) |
| **Enforcement** | Client-side (Header -> UserMenu component) |
| **Stories** | US-003 |

---

## Rules Summary Matrix

| Rule ID | Domain | Type | Enforcement |
|---------|--------|------|------------|
| BR-01-001 | Registration | Input validation | Client + Server |
| BR-01-002 | Registration | Uniqueness constraint | Server (DB) |
| BR-01-003 | Registration | Input validation | Client + Server |
| BR-01-004 | Registration | Input validation | Client + Server |
| BR-01-005 | Registration | Input validation | Client + Server |
| BR-01-006 | Login | Rate limiting | Server |
| BR-01-007 | Login | Security (info leak) | Server |
| BR-01-008 | Login | Security (info leak) | Server + Client |
| BR-01-009 | Session | Expiry policy | Server |
| BR-01-010 | Session | Cookie security | Server |
| BR-01-011 | Session | Invalidation | Server |
| BR-01-012 | Session | Access control | Server (middleware) |
| BR-01-013 | API Key | Input validation | Client |
| BR-01-014 | API Key | Storage policy | Architecture |
| BR-01-015 | API Key | Pre-condition | Client + Server |
| BR-01-016 | Layout | Responsive behavior | Client (CSS) |
| BR-01-017 | Layout | Default state | Client (store) |
| BR-01-018 | Layout | UI content | Client |
