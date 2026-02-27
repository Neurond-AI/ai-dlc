# Business Logic Model -- UOW-01: Foundation & Auth

## Overview

This document defines the business processes for UOW-01, covering user registration, login, session management, API key management, and the application shell layout. All auth flows delegate to **better-auth** for password hashing, session lifecycle, and cookie management. The application uses **Prisma** as the database adapter for better-auth, storing all auth state in PostgreSQL.

---

## 1. User Registration Flow

**Trigger**: User submits registration form at `/register`

```
Client (RegisterForm)
  |
  [1] Collect name, email, password, confirmPassword
  [2] Client-side validation (Zod):
      - email: valid format (RFC 5322 simplified)
      - password: min 8 chars, 1 uppercase, 1 lowercase, 1 number
      - confirmPassword: must match password
      - name: required, 1-100 characters
  |
  [3] Call authClient.signUp.email({ email, password, name })
  |
better-auth (server)
  |
  [4] Validate email uniqueness (case-insensitive lookup via Prisma)
      - If duplicate: return error "Email already registered"
  [5] Hash password (bcrypt, adaptive rounds)
  [6] Create User record in PostgreSQL (via Prisma adapter)
  [7] Create Account record (providerId: "credential")
  [8] Create Session record in PostgreSQL
  [9] Set session cookie (httpOnly, secure in prod, sameSite=lax)
  [10] Return session + user data
  |
Client (onSuccess callback)
  |
  [11] authStore: set user state
  [12] Redirect to /board (dashboard)
```

**Post-Registration Hook** (handled in UOW-02):
- Default project "My First Project" created for the new user
- This is a server-side hook triggered after user creation

**Error States**:

| Condition | Error Message | HTTP Status |
|-----------|--------------|-------------|
| Invalid email format | "Please enter a valid email address" | 400 (client-side) |
| Weak password | "Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number" | 400 (client-side) |
| Password mismatch | "Passwords do not match" | 400 (client-side) |
| Empty name | "Name is required" | 400 (client-side) |
| Duplicate email | "Email already registered" | 409 |
| Server error | "Something went wrong. Please try again." | 500 |

---

## 2. User Login Flow

**Trigger**: User submits login form at `/login`

```
Client (LoginForm)
  |
  [1] Collect email, password
  [2] Client-side validation (Zod):
      - email: valid format
      - password: not empty
  |
  [3] Call authClient.signIn.email({ email, password })
  |
better-auth (server)
  |
  [4] Rate limit check: max 5 failed attempts per email per 15-minute window
      - If exceeded: return 429 "Too many login attempts. Please try again later."
  [5] Lookup user by email (case-insensitive)
      - If not found: return generic 401
  [6] Verify password hash (bcrypt.compare)
      - If mismatch: increment failed attempt counter, return generic 401
  [7] Reset failed attempt counter on success
  [8] Create Session record in PostgreSQL
  [9] Set session cookie (httpOnly, secure in prod, sameSite=lax)
  [10] Return session + user data
  |
Client (onSuccess callback)
  |
  [11] authStore: set user state
  [12] Redirect to /board (dashboard)
```

**Rate Limiting Implementation**:
- Configured via better-auth `rateLimit` option
- Window: 15 minutes (900 seconds)
- Max failed attempts per email: 5
- Lockout response: generic message (no email existence leak)

**Already Authenticated Guard**:
- If user navigates to `/login` with valid session, middleware redirects to `/board`
- Checked in `(auth)/layout.tsx` server component

**Error States**:

| Condition | Error Message | HTTP Status |
|-----------|--------------|-------------|
| Invalid credentials | "Invalid email or password" | 401 |
| Rate limited | "Too many login attempts. Please try again later." | 429 |
| Server error | "Something went wrong. Please try again." | 500 |

---

## 3. Session Management

**Provider**: better-auth (fully managed)

### Session Lifecycle

```
[Creation]
  - On successful login or registration
  - better-auth creates Session record in PostgreSQL (via Prisma adapter)
  - Session token set as httpOnly cookie

[Validation]
  - Next.js middleware intercepts every request to protected routes
  - Calls auth.api.getSession({ headers })
  - If invalid/expired: redirect to /login
  - If valid: request proceeds

[Refresh (Sliding Expiry)]
  - Session expiresIn: 7 days (604800 seconds)
  - updateAge: 24 hours (86400 seconds)
  - On each validated request within updateAge window: session expiry extended
  - Effect: active users stay logged in; inactive users expire after 7 days

[Invalidation]
  - On logout: better-auth deletes Session record from PostgreSQL
  - Cookie cleared from browser
  - Client-side: authStore.user set to null
```

### Session Storage Schema (PostgreSQL via Prisma)

```
Session table (managed by better-auth):
  - id: String (primary key)
  - userId: String (FK -> User)
  - token: String (unique, hashed)
  - expiresAt: DateTime
  - ipAddress: String? (optional, for audit)
  - userAgent: String? (optional, for audit)
  - createdAt: DateTime
  - updatedAt: DateTime
```

### Middleware Configuration

```
Protected route patterns:
  /board/*       -> requires session
  /settings/*    -> requires session
  /task/*        -> requires session

Public route patterns:
  /login         -> accessible without session (redirect if authenticated)
  /register      -> accessible without session (redirect if authenticated)
  /api/auth/*    -> handled by better-auth directly
```

### Session Hydration (Client-Side)

```
App mount (root layout)
  |
  [1] authStore.hydrate() called in useEffect
  [2] Calls authClient.getSession()
  [3] If session valid: populate authStore.user
  [4] If session invalid/expired: redirect to /login
  [5] Set authStore.isLoading = false (unblocks UI render)
```

---

## 4. User Logout Flow

**Trigger**: User clicks "Logout" in UserMenu dropdown

```
Client (UserMenu)
  |
  [1] Call authClient.signOut()
  |
better-auth (server)
  |
  [2] Delete Session record from PostgreSQL
  [3] Clear session cookie
  [4] Return success
  |
Client (onSuccess callback)
  |
  [5] authStore: set user to null, clear state
  [6] Redirect to /login
```

**Back Button Protection**:
- After logout, pressing browser back button triggers middleware session check
- Invalid session detected -> redirect to /login
- No authenticated content is cached or visible

---

## 5. API Key Management

**Trigger**: User navigates to Settings page -> API Key tab

### Save API Key Flow

```
Client (ApiKeyForm)
  |
  [1] User enters Anthropic API key
  [2] Client-side format validation:
      - Must start with "sk-ant-"
      - Must be non-empty after prefix
  |
  [3] Optional: validate against Anthropic API
      - Make lightweight API call (e.g., list models)
      - If 401/403: key is invalid
      - If 200: key is valid
      - If network error: warn but allow save
  |
  [4] Encrypt key using Web Crypto API (AES-GCM)
      - Derive encryption key from a client-side secret (e.g., user ID + salt)
      - Store encrypted blob in localStorage under key "ac_api_key"
  [5] Show success toast: "API key saved successfully"
```

### Retrieve API Key Flow

```
Client (any component needing API key)
  |
  [1] Read encrypted blob from localStorage "ac_api_key"
  [2] Decrypt using Web Crypto API
  [3] Return plaintext key for use in API request headers
  |
  If no key found:
  [4] Return null
  [5] Consuming component shows "API key required" message
```

### API Key Usage in Pipeline Requests

```
Client triggers pipeline start
  |
  [1] Retrieve API key from localStorage (decrypt)
  [2] If null: block action, show "Configure API key in Settings"
  [3] If present: include key in request header
      Header: x-anthropic-key: <decrypted-key>
  |
Server (API route)
  |
  [4] Read key from request header
  [5] Pass key to AgentService for Anthropic SDK calls
  [6] Key is NEVER persisted server-side (memory only during request)
```

### Remove API Key Flow

```
Client (ApiKeyForm)
  |
  [1] User clicks "Remove Key"
  [2] Confirmation dialog: "Remove API key? Pipelines will be blocked until a new key is set."
  [3] On confirm: remove "ac_api_key" from localStorage
  [4] Show toast: "API key removed"
```

**Security Constraints**:
- API key NEVER stored in PostgreSQL database
- API key NEVER logged on server
- API key encrypted at rest in localStorage
- API key transmitted only via HTTPS request headers
- API key exists in server memory only during active request processing

---

## 6. Application Shell / Layout

**Scope**: AppShell wraps all authenticated `(dashboard)` routes

### Layout Structure

```
+----------------------------------------------------------+
| Header                                                     |
| [AutoCoder Logo]    [Project Switcher ▾]    [UserMenu ▾]  |
+----------+-----------------------------------------------+
| Sidebar  | Main Content Area                              |
|          |                                                |
| [K] Board|  (Active route content)                        |
|          |  - /board -> KanbanBoard                       |
| [S] Set. |  - /settings -> SettingsPage                   |
|          |  - /task/[id] -> TaskDetailView                |
|          |                                                |
| Project  |                                                |
| Name     |                                                |
+----------+-----------------------------------------------+
| BottomDock (collapsed by default)              [^ Toggle] |
| [Planner] [Coder] [Reviewer]                              |
| (empty shell in UOW-01, populated by UOW-05)              |
+----------------------------------------------------------+
```

### Sidebar Behavior

```
Desktop (>= 1024px):
  - Expanded: 240px width
  - Shows icon + text labels for nav items
  - Shows project name at bottom
  - Toggle button to collapse

Tablet (768px - 1023px):
  - Collapsed: 64px width (icon-only)
  - Tooltip on hover shows label text
  - Project name hidden

Mobile (< 768px):
  - Hidden by default
  - Hamburger button in Header triggers slide-in overlay
  - Backdrop click or nav item click closes sidebar
```

### Sidebar Navigation Items

| Icon | Label | Route | Active Condition |
|------|-------|-------|-----------------|
| KanbanSquare | Board | /board | pathname starts with /board |
| Settings | Settings | /settings | pathname starts with /settings |

### Header Behavior

```
[Left Section]
  - AutoCoder logo/text (link to /board)

[Center Section]
  - Project switcher dropdown (stub in UOW-01, functional in UOW-02)
  - Shows current project name

[Right Section]
  - User avatar (initials-based, from user.name)
  - User name text
  - Click opens UserMenu dropdown:
    - User name (display)
    - User email (display, muted)
    - Divider
    - "Log out" action -> triggers logout flow
```

### BottomDock Behavior

```
Default state: collapsed (36px height, shows toggle bar only)

Collapsed:
  - Shows expand chevron icon (ChevronUp)
  - Activity indicator dot when pipeline is streaming (future: UOW-05)

Expanded:
  - Height: 300px (default), resizable 200-500px
  - Shows collapse chevron icon (ChevronDown)
  - Content area: empty placeholder in UOW-01
    "No logs yet -- start a pipeline to see agent output."

State persisted in uiStore.isBottomDockOpen
```

### Responsive Breakpoints

| Breakpoint | Sidebar | Header | BottomDock | Main Content |
|-----------|---------|--------|-----------|-------------|
| Desktop (>= 1024px) | 240px expanded | Full | Visible | Fills remaining space |
| Tablet (768-1023px) | 64px icon-only | Full | Visible | Fills remaining space |
| Mobile (< 768px) | Hidden/overlay | Hamburger added | Visible | Full width |

---

## 7. Zustand Store Definitions

### authStore

```
Purpose: Track authenticated user state

State:
  - user: { id, name, email } | null
  - isLoading: boolean (true during hydration)
  - error: string | null

Actions:
  - hydrate(): Fetch session from better-auth, populate user
  - login(email, password): Call authClient.signIn.email, set user
  - register(name, email, password): Call authClient.signUp.email, set user
  - logout(): Call authClient.signOut, clear user
  - clearError(): Reset error to null

Lifecycle:
  - hydrate() called on app mount (root layout useEffect)
  - login/register/logout called from auth forms and UserMenu
  - isLoading blocks UI render until session status known
```

### uiStore

```
Purpose: Track UI-level transient state

State:
  - isSidebarCollapsed: boolean (default: false on desktop, true on tablet)
  - isBottomDockOpen: boolean (default: false)
  - isTaskModalOpen: boolean (default: false)
  - activeLogTab: "planner" | "coder" | "reviewer" (default: "planner")
  - selectedTaskId: string | null (default: null)

Actions:
  - toggleSidebar(): Toggle isSidebarCollapsed
  - toggleBottomDock(): Toggle isBottomDockOpen
  - openTaskModal(): Set isTaskModalOpen = true
  - closeTaskModal(): Set isTaskModalOpen = false
  - setActiveLogTab(tab): Set activeLogTab
  - selectTask(taskId): Set selectedTaskId
```

---

## Process-to-Story Traceability

| Business Process | Stories Covered |
|-----------------|----------------|
| User Registration | US-001 |
| User Login | US-002 |
| User Logout | US-003 |
| Session Management | US-004 |
| API Key Management | US-005, US-006 |
| Application Shell | (infrastructure, supports all stories) |
