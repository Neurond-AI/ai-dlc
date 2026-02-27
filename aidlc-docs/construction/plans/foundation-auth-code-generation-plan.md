# Code Generation Plan -- UOW-01: Foundation & Auth

## 1. Unit Context

### Unit Identity

| Field | Value |
|-------|-------|
| **Unit ID** | UOW-01 |
| **Unit Name** | Foundation & Auth |
| **Stories** | US-001 through US-006 (6 stories, all Must priority) |
| **Complexity** | High (heaviest setup overhead; all other units depend on this) |
| **Dependencies From** | None (foundation unit) |
| **Dependencies To** | UOW-02, UOW-03, UOW-04, UOW-05, UOW-06 (all units depend on UOW-01) |

### Stories in Scope

| Story | Title | Priority | Description |
|-------|-------|----------|-------------|
| US-001 | User Registration | Must | Create account with email/password, bcrypt hashing, redirect to dashboard |
| US-002 | User Login | Must | Login with credentials, session cookie, rate limiting, generic errors |
| US-003 | User Logout | Must | Logout via user menu, session invalidation, back-button protection |
| US-004 | Session Persistence | Must | Session survives refresh, sliding expiry (7 days), DB-backed |
| US-005 | API Key Setup | Must | Enter/save/remove Anthropic API key, encrypted localStorage, validation |
| US-006 | API Key Validation on Pipeline Start | Must | Pre-flight check before pipeline, blocking message if missing/invalid |

### Domain Entities (Prisma Models)

| Model | Role in UOW-01 | Full/Stub |
|-------|---------------|-----------|
| User | Core identity entity, better-auth managed | Full |
| Session | Active user sessions, better-auth managed | Full |
| Account | Auth provider link (credential), better-auth managed | Full |
| Verification | Email verification tokens, better-auth managed | Full (reserved, not actively used) |
| Project | Multi-project support | Stub (CRUD in UOW-02) |
| Task | Task management | Stub (CRUD in UOW-03) |
| PipelineRun | AI pipeline runs | Stub (implementation in UOW-04) |

### Business Rules Enforced

| Rule ID | Domain | Summary |
|---------|--------|---------|
| BR-01-001 | Registration | Email format validation (Zod) |
| BR-01-002 | Registration | Email uniqueness (case-insensitive, DB constraint) |
| BR-01-003 | Registration | Password min 8 characters |
| BR-01-004 | Registration | Password complexity (upper, lower, digit) |
| BR-01-005 | Registration | Name required, 1-100 chars |
| BR-01-006 | Login | Rate limiting: 5 failed attempts / 15-min window |
| BR-01-007 | Login | No email existence leak on lockout |
| BR-01-008 | Login | Generic login error message |
| BR-01-009 | Session | 7-day sliding expiry (updateAge: 24h) |
| BR-01-010 | Session | httpOnly, secure (prod), sameSite=lax cookie |
| BR-01-011 | Session | Full invalidation on logout |
| BR-01-012 | Session | Protected route enforcement via middleware |
| BR-01-013 | API Key | Must start with "sk-ant-", min 10 chars |
| BR-01-014 | API Key | localStorage only, never in database |
| BR-01-015 | API Key | Required for pipeline start, blocking message |
| BR-01-016 | Layout | Sidebar responsive widths (240/64/overlay) |
| BR-01-017 | Layout | BottomDock collapsed by default |
| BR-01-018 | Layout | User menu shows name, email, logout |

### NFRs Addressed

| NFR ID | Category | Summary |
|--------|----------|---------|
| NFR-01-001 | Performance | LCP < 3s |
| NFR-01-002 | Performance | Auth API P95 < 500ms |
| NFR-01-003 | Performance | Client navigation < 200ms |
| NFR-01-004 | Security | bcrypt, 10+ salt rounds |
| NFR-01-005 | Security | Session cookie attributes |
| NFR-01-006 | Security | Login rate limiting |
| NFR-01-007 | Security | HTTP security headers (CSP, HSTS, etc.) |
| NFR-01-008 | Security | Zod input validation on all auth endpoints |
| NFR-01-009 | Security | Generic error messages (no enumeration) |
| NFR-01-010 | Security | No secrets in source code |
| NFR-01-011 | Security | Global error handler, safe responses |
| NFR-01-012 | Security | CSRF protection via better-auth |
| NFR-01-013 | Security | Structured logging with correlation IDs |
| NFR-01-014 | Reliability | Graceful DB connection failure (503) |
| NFR-01-015 | Reliability | Session recovery after server restart |
| NFR-01-016 | Reliability | Prisma connection pooling (singleton) |
| NFR-01-017 | Usability | Responsive layout (1280/768/375) |
| NFR-01-018 | Usability | Loading indicators on auth forms |
| NFR-01-019 | Usability | Toast notifications (Sonner) |
| NFR-01-020 | Usability | Keyboard navigation support |
| NFR-01-021 | Maintainability | Shared Zod schemas (single source of truth) |
| NFR-01-022 | Maintainability | Env var validation with Zod (fail-fast) |
| NFR-01-023 | Maintainability | TypeScript strict mode |

---

## 2. Code Generation Steps

### Step 1: Project Scaffolding

**Goal**: Initialize the Next.js 15 project with all tooling configured and ready.

**Files to create**:

- [ ] `package.json` -- All dependencies with exact pinned versions: next 15.x, react 19.x, react-dom 19.x, typescript 5.x, prisma 6.x, @prisma/client 6.x, better-auth (latest), zustand 5.x, tailwindcss 4.x, @tailwindcss/postcss, framer-motion, lucide-react, zod 3.x, sonner, @radix-ui/react-* (as needed by shadcn/ui). Dev deps: @types/node, @types/react, @types/react-dom, eslint, eslint-config-next, vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom.
  - **Test file**: N/A
  - **NFRs**: NFR-01-023 (TypeScript strict), NFR-01-010 (no secrets)

- [ ] `tsconfig.json` -- TypeScript strict mode enabled, paths alias `@/*` -> `./src/*`, target ES2022, module ESNext, moduleResolution bundler, jsx preserve, incremental true.
  - **Test file**: N/A
  - **NFRs**: NFR-01-023

- [ ] `next.config.ts` -- Minimal Next.js 15 config. Enable experimental features if needed. No custom webpack config unless required.
  - **Test file**: N/A

- [ ] `postcss.config.mjs` -- PostCSS config with `@tailwindcss/postcss` plugin for Tailwind v4.
  - **Test file**: N/A

- [ ] `src/app/globals.css` -- Tailwind v4 CSS-first config: `@import "tailwindcss"`, CSS custom properties for shadcn/ui theme tokens (--background, --foreground, --card, --primary, --secondary, --muted, --accent, --destructive, --border, --input, --ring, --radius), light theme values.
  - **Test file**: N/A
  - **NFRs**: NFR-01-017 (responsive design foundation)

- [ ] `docker-compose.yml` -- PostgreSQL 16-alpine service. Port 5432:5432 mapped to localhost only. Environment: POSTGRES_USER=autocoder, POSTGRES_PASSWORD=${POSTGRES_PASSWORD}, POSTGRES_DB=autocoder. Named volume postgres_data for persistence. Health check configured.
  - **Test file**: N/A

- [ ] `.env.example` -- Template with placeholder values: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, POSTGRES_PASSWORD, NODE_ENV. All values are clearly marked as examples.
  - **Test file**: N/A
  - **NFRs**: NFR-01-010 (no secrets in code)

- [ ] `.gitignore` -- Standard Next.js gitignore plus: .env, .env.local, .env.*.local, node_modules/, .next/, postgres_data/. Ensure .env.example is NOT ignored.
  - **Test file**: N/A
  - **NFRs**: NFR-01-010

- [ ] `components.json` -- shadcn/ui configuration: style "new-york", rsc true, tsx true, tailwind config with CSS variables enabled, aliases mapping to @/components, @/lib, @/hooks.
  - **Test file**: N/A

---

### Step 2: Database Setup (Prisma Schema)

**Goal**: Define the complete Prisma schema with all models. Auth models are fully specified; application models are stubs for future UOWs.

**Files to create**:

- [ ] `prisma/schema.prisma` -- Datasource: postgresql, provider "prisma-client-js" generator. Models: User (id cuid, email unique, emailVerified bool default false, name string, image string?, createdAt, updatedAt, relations to Session[], Account[], Project[]). Session (id cuid, userId FK, token unique, expiresAt, ipAddress?, userAgent?, createdAt, updatedAt, relation to User with onDelete Cascade). Account (id cuid, userId FK, accountId, providerId, accessToken?, refreshToken?, accessTokenExpiresAt?, refreshTokenExpiresAt?, scope?, password?, createdAt, updatedAt, relation to User with onDelete Cascade). Verification (id cuid, identifier, value, expiresAt, createdAt, updatedAt). Project stub (id cuid, name, userId FK, createdAt, updatedAt, relations to User, Task[]). Task stub (id cuid, title, description?, category default "feature", priority default "medium", status default "backlog", pipelineState Json?, subtasks Json?, projectId FK, createdAt, updatedAt, relations to Project, PipelineRun[]). PipelineRun stub (id cuid, taskId FK, phase default "planning", iteration default 1, status default "running", agentLogs Json?, fileChanges Json?, reviewFindings Json?, startedAt, completedAt?, relation to Task). All models use @@map for snake_case table names.
  - **Test file**: `src/__tests__/prisma/schema.test.ts` -- Validate schema loads without errors (import and instantiate PrismaClient, check model metadata).
  - **NFRs**: NFR-01-016 (connection pooling setup), NFR-01-015 (DB-backed sessions)
  - **Stories**: US-001 (User model), US-004 (Session model)

---

### Step 3: Auth Configuration (better-auth)

**Goal**: Configure better-auth server instance and client instance, plus the Next.js catch-all API route.

**Files to create**:

- [ ] `src/lib/auth.ts` -- better-auth server configuration. Import betterAuth from "better-auth". Configure: database via prismaAdapter (import from "better-auth/adapters/prisma"), session config (expiresIn: 604800 seconds / 7 days, updateAge: 86400 seconds / 24 hours), emailAndPassword plugin enabled with password complexity requirements, rate limiting config (window: 900 seconds, max: 5 for login endpoint). Export the `auth` instance. This is the single source of truth for server-side auth.
  - **Test file**: `src/__tests__/lib/auth.test.ts` -- Verify auth instance exports expected API surface (auth.api.getSession, etc.), verify session config values.
  - **Stories**: US-001, US-002, US-003, US-004
  - **Rules**: BR-01-004, BR-01-006, BR-01-009, BR-01-010

- [ ] `src/lib/auth-client.ts` -- better-auth client configuration. Import createAuthClient from "better-auth/react". Configure baseURL from environment or window.location.origin. Export `authClient` with typed methods: signIn.email, signUp.email, signOut, getSession. Also export `useSession` hook from better-auth/react for components that need reactive session state.
  - **Test file**: `src/__tests__/lib/auth-client.test.ts` -- Verify authClient exports signIn, signUp, signOut, getSession methods.
  - **Stories**: US-001, US-002, US-003, US-004

- [ ] `src/app/api/auth/[...all]/route.ts` -- Next.js catch-all route for better-auth. Import `auth` from `@/lib/auth`. Export GET and POST handlers by converting auth.handler to Next.js compatible handlers using `toNextJsHandler` from better-auth. This single route handles all auth endpoints (/api/auth/sign-up, /api/auth/sign-in, /api/auth/sign-out, /api/auth/get-session, etc.).
  - **Test file**: `src/__tests__/app/api/auth/route.test.ts` -- Verify route module exports GET and POST handlers.
  - **Stories**: US-001, US-002, US-003, US-004
  - **NFRs**: NFR-01-008 (input validation), NFR-01-012 (CSRF)

---

### Step 4: Prisma Client & DB Utility

**Goal**: Create the Prisma client singleton and environment variable validation.

**Files to create**:

- [ ] `src/lib/db.ts` -- Prisma client singleton pattern. Use globalThis caching in development to prevent connection exhaustion during HMR. In production, create a single instance. Export `db` (the PrismaClient instance). Include connection error handling.
  - **Test file**: `src/__tests__/lib/db.test.ts` -- Verify singleton returns same instance on multiple imports, verify globalThis caching in development.
  - **NFRs**: NFR-01-016 (connection pooling), NFR-01-014 (graceful DB failure)

- [ ] `src/lib/env.ts` -- Zod-validated environment configuration. Define envSchema with: DATABASE_URL (string URL), BETTER_AUTH_SECRET (string min 32 chars), BETTER_AUTH_URL (string URL, default "http://localhost:3000"), NODE_ENV (enum: development, production, test). Parse process.env at module load. Export typed `env` object. Throw descriptive error on validation failure for fail-fast behavior.
  - **Test file**: `src/__tests__/lib/env.test.ts` -- Verify schema rejects missing DATABASE_URL, rejects short BETTER_AUTH_SECRET, accepts valid env.
  - **NFRs**: NFR-01-022 (env var validation), NFR-01-010 (no hardcoded secrets)

- [ ] `src/lib/logger.ts` -- Structured JSON logger. Functions: info, warn, error. Each log entry includes: timestamp (ISO 8601), correlationId (UUID generated per request via crypto.randomUUID), level, message, optional metadata object. No PII in logs (passwords, full emails). Export logger singleton.
  - **Test file**: `src/__tests__/lib/logger.test.ts` -- Verify log output is valid JSON, verify required fields present, verify no PII leakage with test data.
  - **NFRs**: NFR-01-013 (structured logging)

---

### Step 5: Zod Validators (Auth Schemas)

**Goal**: Define shared Zod validation schemas for auth forms and API routes. Single source of truth.

**Files to create**:

- [ ] `src/lib/validators/auth.ts` -- Export `loginSchema`: z.object({ email: z.string().email("Please enter a valid email address"), password: z.string().min(1, "Password is required") }). Export `registerSchema`: z.object({ name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or fewer").trim(), email: z.string().email("Please enter a valid email address"), password: z.string().min(8, "Password must be at least 8 characters").regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number"), confirmPassword: z.string() }).refine((data) => data.password === data.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] }). Export `apiKeySchema`: z.string().startsWith("sk-ant-", "Invalid API key format. Key must start with 'sk-ant-'").min(10, "API key is too short"). Export inferred TypeScript types: LoginInput, RegisterInput.
  - **Test file**: `src/__tests__/lib/validators/auth.test.ts` -- Comprehensive validation tests: valid inputs pass, invalid email rejected, weak password rejected, password mismatch caught, empty name caught, name over 100 chars rejected, API key format validated. Test every business rule: BR-01-001, BR-01-003, BR-01-004, BR-01-005, BR-01-013.
  - **Stories**: US-001, US-002, US-005
  - **Rules**: BR-01-001, BR-01-003, BR-01-004, BR-01-005, BR-01-013
  - **NFRs**: NFR-01-008, NFR-01-021

---

### Step 6: Zustand Stores

**Goal**: Create authStore and uiStore with typed state and actions.

**Files to create**:

- [ ] `src/stores/auth-store.ts` -- Zustand store with: State: user (AuthUser | null), isLoading (boolean, default true), error (string | null). Actions: hydrate() -- calls authClient.getSession(), populates user or redirects to /login, sets isLoading false. login(email, password) -- calls authClient.signIn.email, sets user on success, sets error on failure. register(name, email, password) -- calls authClient.signUp.email, sets user on success, sets error on failure. logout() -- calls authClient.signOut, clears user, redirects to /login. clearError() -- resets error to null. Use `create` from zustand. Type AuthUser: { id: string; name: string; email: string; image?: string | null }.
  - **Test file**: `src/__tests__/stores/auth-store.test.ts` -- Test initial state, hydrate sets user, login/register success/error flows, logout clears user, clearError resets error.
  - **Stories**: US-001, US-002, US-003, US-004
  - **Rules**: BR-01-008

- [ ] `src/stores/ui-store.ts` -- Zustand store with: State: isSidebarCollapsed (boolean, default false), isBottomDockOpen (boolean, default false), isTaskModalOpen (boolean, default false), activeLogTab ("planner" | "coder" | "reviewer", default "planner"), selectedTaskId (string | null, default null). Actions: toggleSidebar(), toggleBottomDock(), openTaskModal(), closeTaskModal(), setActiveLogTab(tab), selectTask(taskId).
  - **Test file**: `src/__tests__/stores/ui-store.test.ts` -- Test initial state values, each toggle action, set actions.
  - **Rules**: BR-01-016, BR-01-017

---

### Step 7: Custom Hooks

**Goal**: Create a useSession hook for convenient session access in components.

**Files to create**:

- [ ] `src/hooks/use-session.ts` -- Custom hook wrapping authClient.useSession() from better-auth/react. Returns { user, isLoading, error, session }. Provides a clean interface for components to consume session state without directly importing authClient. Re-exports the better-auth hook with proper typing.
  - **Test file**: `src/__tests__/hooks/use-session.test.ts` -- Test hook returns expected shape, loading state, authenticated state, unauthenticated state.
  - **Stories**: US-004

---

### Step 8: shadcn/ui Setup & Base Components

**Goal**: Install and configure shadcn/ui primitives required by UOW-01 components.

**Files to create (via shadcn/ui add or manual creation)**:

- [ ] `src/components/ui/button.tsx` -- shadcn/ui Button with variants: default, destructive, outline, secondary, ghost, link. Sizes: default, sm, lg, icon. Include `data-testid` on root element. Support `loading` prop with spinner.
  - **Test file**: `src/__tests__/components/ui/button.test.ts` -- Render test, variant rendering, disabled state, loading state with spinner.

- [ ] `src/components/ui/input.tsx` -- shadcn/ui Input with forwardRef, supports type="password", error state styling (red border), `data-testid` prop passthrough.
  - **Test file**: `src/__tests__/components/ui/input.test.ts` -- Render test, value change, disabled state, error styling.

- [ ] `src/components/ui/label.tsx` -- shadcn/ui Label, Radix-based.
  - **Test file**: `src/__tests__/components/ui/label.test.ts` -- Render test, association with input.

- [ ] `src/components/ui/card.tsx` -- shadcn/ui Card with Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter subcomponents.
  - **Test file**: `src/__tests__/components/ui/card.test.ts` -- Render test, subcomponent composition.

- [ ] `src/components/ui/dropdown-menu.tsx` -- shadcn/ui DropdownMenu (Radix-based) with DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator.
  - **Test file**: `src/__tests__/components/ui/dropdown-menu.test.ts` -- Open/close test, item click handler.

- [ ] `src/components/ui/tabs.tsx` -- shadcn/ui Tabs with Tabs, TabsList, TabsTrigger, TabsContent.
  - **Test file**: `src/__tests__/components/ui/tabs.test.ts` -- Tab switching test, content display.

- [ ] `src/components/ui/tooltip.tsx` -- shadcn/ui Tooltip with TooltipProvider, Tooltip, TooltipTrigger, TooltipContent.
  - **Test file**: `src/__tests__/components/ui/tooltip.test.ts` -- Hover display test.

- [ ] `src/components/ui/separator.tsx` -- shadcn/ui Separator (horizontal/vertical).
  - **Test file**: `src/__tests__/components/ui/separator.test.ts` -- Render test, orientation.

- [ ] `src/components/ui/sonner.tsx` -- Sonner toast provider integration with shadcn/ui theming. Export Toaster component.
  - **Test file**: `src/__tests__/components/ui/sonner.test.ts` -- Render test, toast trigger.

- [ ] `src/components/ui/alert.tsx` -- shadcn/ui Alert with Alert, AlertTitle, AlertDescription. Variants: default, destructive.
  - **Test file**: `src/__tests__/components/ui/alert.test.ts` -- Render test, variant rendering.

---

### Step 9: Layout Components

**Goal**: Build the application shell with Sidebar, Header, BottomDock, UserMenu. All interactive elements get `data-testid` attributes.

**Files to create**:

- [ ] `src/components/layout/app-shell.tsx` -- Client Component ("use client"). Props: { children: React.ReactNode }. Reads uiStore (isSidebarCollapsed, isBottomDockOpen) and authStore (user). Layout: flex h-screen container with Sidebar, vertical flex column for Header + main + BottomDock. Main content area: flex-1 overflow-auto. `data-testid="app-shell"`.
  - **Test file**: `src/__tests__/components/layout/app-shell.test.tsx` -- Renders children, renders Sidebar/Header/BottomDock, responsive layout assertions.
  - **Rules**: BR-01-016

- [ ] `src/components/layout/sidebar.tsx` -- Client Component. Reads uiStore.isSidebarCollapsed, usePathname() for active route. Nav items: [{icon: KanbanSquare, label: "Board", href: "/board"}, {icon: Settings, label: "Settings", href: "/settings"}]. Desktop (>=1024px): 240px expanded with icon+text, collapsible to 64px. Tablet (768-1023px): 64px icon-only with Tooltip on hover. Mobile (<768px): hidden by default, slide-in overlay with backdrop. Footer: "My Project" stub text. Toggle button: `data-testid="sidebar-toggle"`. Nav items: `data-testid="nav-{label.toLowerCase()}"` (e.g., "nav-board", "nav-settings"). Active route: highlighted background. Framer Motion for expand/collapse animation.
  - **Test file**: `src/__tests__/components/layout/sidebar.test.tsx` -- Renders nav items, active route highlighting, toggle collapse, mobile overlay.
  - **Rules**: BR-01-016

- [ ] `src/components/layout/header.tsx` -- Client Component. Reads authStore.user, uiStore.isSidebarCollapsed. Layout: left (logo/app name link to /board, hamburger on mobile), center (project name stub "My Project"), right (UserMenu). Hamburger: `data-testid="hamburger-menu"`, visible only on mobile. Logo: `data-testid="app-logo"`.
  - **Test file**: `src/__tests__/components/layout/header.test.tsx` -- Renders logo, project name, UserMenu. Hamburger visible on mobile mock.
  - **Rules**: BR-01-018

- [ ] `src/components/layout/user-menu.tsx` -- Client Component. Reads authStore (user.name, user.email). Trigger: avatar (initials from user.name, colored background derived from user ID hash) + user name + ChevronDown icon. Dropdown (shadcn/ui DropdownMenu): user name (bold), user email (muted), separator, "Log out" item with LogOut icon. Logout calls authStore.logout(). `data-testid="user-menu-trigger"`, `data-testid="user-menu-logout"`. Avatar initials: first letter of name, uppercase.
  - **Test file**: `src/__tests__/components/layout/user-menu.test.tsx` -- Renders user initials, dropdown opens on click, logout action fires, displays name and email.
  - **Stories**: US-003
  - **Rules**: BR-01-011, BR-01-018

- [ ] `src/components/layout/bottom-dock.tsx` -- Client Component. Reads uiStore.isBottomDockOpen. Collapsed: 36px height, toggle bar with ChevronUp icon, `data-testid="bottom-dock-toggle"`. Expanded: 300px height (Framer Motion animated spring transition ~300ms), shows placeholder text "No logs yet -- start a pipeline to see agent output." with `data-testid="bottom-dock-placeholder"`. ChevronDown when expanded. `data-testid="bottom-dock"`.
  - **Test file**: `src/__tests__/components/layout/bottom-dock.test.tsx` -- Collapsed by default, toggle expands, placeholder text displayed, animation triggers.
  - **Rules**: BR-01-017

---

### Step 10: Auth Components

**Goal**: Build LoginForm and RegisterForm client components with validation, API calls, and error handling.

**Files to create**:

- [ ] `src/components/auth/login-form.tsx` -- Client Component ("use client"). Self-contained (no props). Internal state: email, password, errors ({email?, password?, form?}), isSubmitting. Uses loginSchema from validators/auth.ts for client-side validation. onBlur: validate individual field. onSubmit: validate all fields with Zod, call authClient.signIn.email({ email, password, callbackURL: "/board" }), handle onSuccess (redirect) and onError (set form error "Invalid email or password"). UI: Card container, email Input with Label and error, password Input (type="password") with Label and error, form-level Alert (destructive) if form error, "Log in" Button with loading spinner when isSubmitting, "Don't have an account? Register" link. `data-testid` attributes: "login-email-input", "login-password-input", "login-submit-button", "login-form-error", "login-register-link". Fields disabled during submission.
  - **Test file**: `src/__tests__/components/auth/login-form.test.tsx` -- Empty email shows error, empty password shows error, valid submission calls authClient, server error displays form error, loading state disables button, register link navigates.
  - **Stories**: US-002
  - **Rules**: BR-01-001, BR-01-006, BR-01-007, BR-01-008
  - **NFRs**: NFR-01-018 (loading indicator), NFR-01-020 (keyboard nav)

- [ ] `src/components/auth/register-form.tsx` -- Client Component ("use client"). Self-contained (no props). Internal state: name, email, password, confirmPassword, errors ({name?, email?, password?, confirmPassword?, form?}), isSubmitting. Uses registerSchema from validators/auth.ts. onBlur: validate individual field. onSubmit: validate all with Zod (including refine for password match), call authClient.signUp.email({ email, password, name, callbackURL: "/board" }), handle onSuccess and onError (email duplicate -> "Email already registered", else "Something went wrong. Please try again."). UI: Card container, name Input, email Input, password Input (type="password") with strength indicator bar, confirmPassword Input (type="password"), form-level Alert, "Create account" Button with spinner, "Already have an account? Log in" link. Password strength indicator: bar below password field, states: weak (red, <8 chars), fair (yellow, meets length but not complexity), strong (green, meets all). `data-testid` attributes: "register-name-input", "register-email-input", "register-password-input", "register-confirm-password-input", "register-submit-button", "register-form-error", "register-login-link", "password-strength-indicator".
  - **Test file**: `src/__tests__/components/auth/register-form.test.tsx` -- Each field validation, password mismatch, strength indicator states, successful submission, duplicate email error, loading state.
  - **Stories**: US-001
  - **Rules**: BR-01-001, BR-01-002, BR-01-003, BR-01-004, BR-01-005
  - **NFRs**: NFR-01-018, NFR-01-020

---

### Step 11: Auth Pages

**Goal**: Create the auth route group layout and login/register page shells.

**Files to create**:

- [ ] `src/app/(auth)/layout.tsx` -- Server Component. Check session via `auth.api.getSession({ headers: await headers() })`. If session exists, redirect("/board"). Render: centered flex container, min-h-screen, bg-muted/40 background, children centered vertically and horizontally. `data-testid="auth-layout"`.
  - **Test file**: `src/__tests__/app/(auth)/layout.test.tsx` -- Redirect when session exists, render children when no session.
  - **Stories**: US-002 (AC: redirect if already logged in)

- [ ] `src/app/(auth)/login/page.tsx` -- Server Component shell rendering LoginForm. Page metadata: title "Log In - AutoCoder". Content: LoginForm component within the auth layout. `data-testid="login-page"`.
  - **Test file**: `src/__tests__/app/(auth)/login/page.test.tsx` -- Renders LoginForm component.
  - **Stories**: US-002

- [ ] `src/app/(auth)/register/page.tsx` -- Server Component shell rendering RegisterForm. Page metadata: title "Create Account - AutoCoder". Content: RegisterForm component within the auth layout. `data-testid="register-page"`.
  - **Test file**: `src/__tests__/app/(auth)/register/page.test.tsx` -- Renders RegisterForm component.
  - **Stories**: US-001

---

### Step 12: Dashboard Layout & Page

**Goal**: Create the dashboard route group with auth-guarded AppShell layout and placeholder board page.

**Files to create**:

- [ ] `src/app/(dashboard)/layout.tsx` -- Server Component. Wraps children with AppShell. Auth guard handled by middleware.ts (Step 14). Import and render AppShell around {children}. `data-testid="dashboard-layout"`.
  - **Test file**: `src/__tests__/app/(dashboard)/layout.test.tsx` -- Renders AppShell wrapper with children.
  - **Stories**: US-004

- [ ] `src/app/(dashboard)/page.tsx` -- Dashboard root page. Redirect to /board. Uses redirect() from "next/navigation". This ensures navigating to "/" when authenticated goes to the board.
  - **Test file**: `src/__tests__/app/(dashboard)/page.test.tsx` -- Verify redirect to /board.

- [ ] `src/app/(dashboard)/board/page.tsx` -- Placeholder board page for UOW-01. Page metadata: title "Board - AutoCoder". Content: centered placeholder card with heading "Board" and text "Kanban board coming in UOW-03. Create tasks and manage your projects here." with `data-testid="board-placeholder"`.
  - **Test file**: `src/__tests__/app/(dashboard)/board/page.test.tsx` -- Renders placeholder text.
  - **Stories**: N/A (placeholder)

---

### Step 13: Settings Page & API Key Form

**Goal**: Build the Settings page with tabbed layout and the API Key management form (localStorage only).

**Files to create**:

- [ ] `src/lib/crypto.ts` -- Client-side encryption utility using Web Crypto API (AES-GCM). Functions: encryptApiKey(plaintext: string, userId: string): Promise<string> -- derives key from userId + static salt using PBKDF2, encrypts with AES-GCM, returns base64-encoded ciphertext with IV prepended. decryptApiKey(ciphertext: string, userId: string): Promise<string | null> -- reverses encryption, returns plaintext or null on failure. getStoredApiKey(userId: string): Promise<string | null> -- reads from localStorage "ac_api_key", decrypts, returns key. saveApiKey(key: string, userId: string): Promise<void> -- encrypts and stores. removeApiKey(): void -- removes "ac_api_key" from localStorage. hasApiKey(): boolean -- checks localStorage for "ac_api_key" existence.
  - **Test file**: `src/__tests__/lib/crypto.test.ts` -- Encrypt/decrypt round-trip, wrong userId fails decrypt, remove clears storage, hasApiKey detection.
  - **Stories**: US-005
  - **Rules**: BR-01-014

- [ ] `src/components/settings/api-key-form.tsx` -- Client Component. Self-contained. Internal state: keyInput, maskedKey, hasKey, isValidating, isSaving, error, success, isEditing. On mount: check hasApiKey() and derive maskedKey from stored key (first 7 chars "sk-ant-" + "..." + last 4 chars). States: no key/not editing (show "No API key configured" + "Add API Key" button), no key/editing (key Input + Save + Cancel), has key/not editing (masked display + Update + Remove buttons), has key/editing (key Input empty + Save + Cancel). Save flow: validate with apiKeySchema, optional Anthropic API validation (POST with minimal request, handle 200/401/network error), encrypt and store. Remove flow: confirmation dialog, remove from localStorage, toast "API key removed". `data-testid` attributes: "api-key-form", "api-key-input", "api-key-save-button", "api-key-remove-button", "api-key-update-button", "api-key-cancel-button", "api-key-validate-button", "api-key-masked-display", "api-key-status".
  - **Test file**: `src/__tests__/components/settings/api-key-form.test.tsx` -- Initial no-key state, add key flow, validation error for invalid format, masked display after save, remove key flow, update flow.
  - **Stories**: US-005, US-006
  - **Rules**: BR-01-013, BR-01-014, BR-01-015
  - **NFRs**: NFR-01-019 (toast notifications)

- [ ] `src/app/(dashboard)/settings/page.tsx` -- Client Component page. Page metadata: title "Settings - AutoCoder". Tabbed layout using shadcn/ui Tabs. Tabs: "API Key" (default active, renders ApiKeyForm), "Profile" (stub: shows user name from authStore, placeholder text "Profile editing coming soon"). Heading: "Settings". `data-testid="settings-page"`, `data-testid="settings-tab-api-key"`, `data-testid="settings-tab-profile"`.
  - **Test file**: `src/__tests__/app/(dashboard)/settings/page.test.tsx` -- Renders tabs, API Key tab active by default, profile tab shows stub, tab switching works.
  - **Stories**: US-005

---

### Step 14: Security Middleware

**Goal**: Create Next.js middleware for auth protection, HTTP security headers, and route guards.

**Files to create**:

- [ ] `src/middleware.ts` -- Next.js middleware at src root. Functions: (1) Auth guard: for protected route patterns (/board/:path*, /settings/:path*, /task/:path*), call auth.api.getSession({ headers }). If null/expired, redirect to /login. (2) Auth redirect: for auth routes (/login, /register), if session exists, redirect to /board. (3) Security headers on ALL responses: Content-Security-Policy (default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'), Strict-Transport-Security (max-age=31536000; includeSubDomains), X-Content-Type-Options (nosniff), X-Frame-Options (DENY), Referrer-Policy (strict-origin-when-cross-origin). Matcher config: exclude _next/static, _next/image, favicon.ico, and public assets. Export config with matcher pattern.
  - **Test file**: `src/__tests__/middleware.test.ts` -- Protected route redirects unauthenticated to /login, auth route redirects authenticated to /board, security headers present on response, public routes accessible without session.
  - **Stories**: US-004 (session enforcement)
  - **Rules**: BR-01-012 (protected route enforcement)
  - **NFRs**: NFR-01-007 (HTTP security headers), NFR-01-005 (cookie security), NFR-01-012 (CSRF)

- [ ] `src/app/error.tsx` -- Client error boundary. "use client". Displays user-friendly error message: "Something went wrong." with a "Try again" button that calls reset(). No stack traces exposed. `data-testid="error-boundary"`.
  - **Test file**: `src/__tests__/app/error.test.tsx` -- Renders error message, reset button calls reset function.
  - **NFRs**: NFR-01-011 (global error handler)

- [ ] `src/app/global-error.tsx` -- Global error boundary for root layout errors. "use client". Renders full HTML document with error message. No stack traces. `data-testid="global-error-boundary"`.
  - **Test file**: `src/__tests__/app/global-error.test.tsx` -- Renders error message in full HTML shell.
  - **NFRs**: NFR-01-011

- [ ] `src/app/layout.tsx` -- Root layout. Server Component. Import globals.css. HTML lang="en". Body with inter font. Include Sonner Toaster component for toast notifications. Wrap children with session hydration provider if needed. Metadata: title "AutoCoder", description "AI-powered autonomous coding assistant".
  - **Test file**: `src/__tests__/app/layout.test.tsx` -- Renders html/body, includes Toaster, metadata present.
  - **NFRs**: NFR-01-019 (toast setup)

---

### Step 15: Types & Documentation

**Goal**: Define shared TypeScript types and create summary documentation.

**Files to create**:

- [ ] `src/types/index.ts` -- Central type barrel file. Export AuthUser, AuthSession types. Export Project stub type. Export Task stub type with TaskCategory, TaskPriority, TaskStatus enums. Export PipelinePhase, PipelineRunStatus type stubs. All types match Prisma schema definitions from domain-entities.md.
  - **Test file**: `src/__tests__/types/index.test.ts` -- Type compilation test (verify types are importable and assignable).

---

## 3. Story Traceability Matrix

| Story | Files Implementing | Steps | Business Rules |
|-------|-------------------|-------|---------------|
| **US-001** (Registration) | `register-form.tsx`, `auth.ts`, `auth-client.ts`, `[...all]/route.ts`, `validators/auth.ts`, `auth-store.ts`, `register/page.tsx`, `(auth)/layout.tsx`, `prisma/schema.prisma` (User, Account) | 2, 3, 5, 6, 10, 11 | BR-01-001, BR-01-002, BR-01-003, BR-01-004, BR-01-005 |
| **US-002** (Login) | `login-form.tsx`, `auth.ts`, `auth-client.ts`, `[...all]/route.ts`, `validators/auth.ts`, `auth-store.ts`, `login/page.tsx`, `(auth)/layout.tsx` | 3, 5, 6, 10, 11 | BR-01-001, BR-01-006, BR-01-007, BR-01-008 |
| **US-003** (Logout) | `user-menu.tsx`, `auth-store.ts`, `auth-client.ts`, `middleware.ts` | 3, 6, 9, 14 | BR-01-011, BR-01-018 |
| **US-004** (Session Persistence) | `auth.ts` (session config), `middleware.ts`, `(auth)/layout.tsx`, `(dashboard)/layout.tsx`, `use-session.ts`, `auth-store.ts` (hydrate) | 3, 6, 7, 11, 12, 14 | BR-01-009, BR-01-010, BR-01-012 |
| **US-005** (API Key Setup) | `api-key-form.tsx`, `crypto.ts`, `validators/auth.ts` (apiKeySchema), `settings/page.tsx` | 5, 13 | BR-01-013, BR-01-014 |
| **US-006** (API Key Validation) | `api-key-form.tsx`, `crypto.ts` (getStoredApiKey, hasApiKey) | 13 | BR-01-015 |

---

## 4. Cross-Unit Dependencies

### What UOW-01 Provides to Other Units

| Downstream Unit | What UOW-01 Provides |
|-----------------|---------------------|
| **UOW-02** (Project Management) | Prisma schema (Project model stub), auth middleware, AppShell layout, authStore (user context), Sidebar (to be updated with ProjectSwitcher), db.ts (Prisma client) |
| **UOW-03** (Tasks & Kanban Board) | Prisma schema (Task model stub), auth middleware, AppShell layout, board/page.tsx (to be replaced), uiStore (isTaskModalOpen, selectedTaskId), db.ts, validators pattern |
| **UOW-04** (AI Pipeline Engine) | Prisma schema (PipelineRun model stub), auth middleware, db.ts, crypto.ts (getStoredApiKey for API key retrieval), env.ts, logger.ts |
| **UOW-05** (Pipeline UI & Agent Logs) | AppShell layout, BottomDock (to be wired with AgentLogPanel), uiStore (isBottomDockOpen, activeLogTab) |
| **UOW-06** (Diff Review & Polish) | Settings page (to add ApiKeyForm, already done in UOW-01), auth middleware, AppShell layout, crypto.ts |

### What UOW-01 Depends On

Nothing. UOW-01 is the foundation unit with zero upstream dependencies.

### Integration Points for Future Units

| Integration Point | Current State (UOW-01) | Future State |
|-------------------|----------------------|-------------|
| Sidebar footer | Stub text "My Project" | UOW-02: ProjectSwitcher component |
| Board page | Placeholder card | UOW-03: KanbanBoard component |
| BottomDock content | Placeholder text | UOW-05: AgentLogPanel component |
| Settings Profile tab | Stub text | UOW-06: Profile edit form |
| Dashboard redirect | Redirects to /board | Stays same |

---

## 5. Testing Notes

> **IMPORTANT**: Test files are generated alongside implementation code but are NOT executed during the Code Generation phase. Test execution belongs to the Build & Test phase.

### Test Framework

- **Unit Tests**: Vitest + React Testing Library + @testing-library/jest-dom
- **Test Environment**: jsdom (for component tests), node (for utility tests)
- **Mocking**: Vitest vi.mock for external dependencies (better-auth, prisma, next/navigation)

### Test Coverage Targets

| Category | Files | Min Coverage |
|----------|-------|-------------|
| Zod Validators | `validators/auth.ts` | 100% (all rules tested) |
| Zustand Stores | `auth-store.ts`, `ui-store.ts` | 90%+ (all actions) |
| Auth Components | `login-form.tsx`, `register-form.tsx` | 85%+ (all interactions) |
| Layout Components | `app-shell.tsx`, `sidebar.tsx`, `header.tsx`, `bottom-dock.tsx`, `user-menu.tsx` | 80%+ |
| Utility Functions | `db.ts`, `env.ts`, `crypto.ts`, `logger.ts` | 90%+ |
| Middleware | `middleware.ts` | 85%+ (all route patterns) |
| Pages | All page.tsx files | 70%+ (render tests) |

### Test File Manifest

| Test File | Tests | Step |
|-----------|-------|------|
| `src/__tests__/prisma/schema.test.ts` | Schema validation | 2 |
| `src/__tests__/lib/auth.test.ts` | Auth server config | 3 |
| `src/__tests__/lib/auth-client.test.ts` | Auth client config | 3 |
| `src/__tests__/app/api/auth/route.test.ts` | Auth API route | 3 |
| `src/__tests__/lib/db.test.ts` | Prisma singleton | 4 |
| `src/__tests__/lib/env.test.ts` | Env validation | 4 |
| `src/__tests__/lib/logger.test.ts` | Structured logging | 4 |
| `src/__tests__/lib/validators/auth.test.ts` | Zod schemas | 5 |
| `src/__tests__/stores/auth-store.test.ts` | Auth store | 6 |
| `src/__tests__/stores/ui-store.test.ts` | UI store | 6 |
| `src/__tests__/hooks/use-session.test.ts` | Session hook | 7 |
| `src/__tests__/components/ui/button.test.ts` | Button component | 8 |
| `src/__tests__/components/ui/input.test.ts` | Input component | 8 |
| `src/__tests__/components/ui/label.test.ts` | Label component | 8 |
| `src/__tests__/components/ui/card.test.ts` | Card component | 8 |
| `src/__tests__/components/ui/dropdown-menu.test.ts` | DropdownMenu component | 8 |
| `src/__tests__/components/ui/tabs.test.ts` | Tabs component | 8 |
| `src/__tests__/components/ui/tooltip.test.ts` | Tooltip component | 8 |
| `src/__tests__/components/ui/separator.test.ts` | Separator component | 8 |
| `src/__tests__/components/ui/sonner.test.ts` | Sonner/Toast component | 8 |
| `src/__tests__/components/ui/alert.test.ts` | Alert component | 8 |
| `src/__tests__/components/layout/app-shell.test.tsx` | AppShell layout | 9 |
| `src/__tests__/components/layout/sidebar.test.tsx` | Sidebar navigation | 9 |
| `src/__tests__/components/layout/header.test.tsx` | Header component | 9 |
| `src/__tests__/components/layout/user-menu.test.tsx` | User menu dropdown | 9 |
| `src/__tests__/components/layout/bottom-dock.test.tsx` | BottomDock toggle | 9 |
| `src/__tests__/components/auth/login-form.test.tsx` | Login form | 10 |
| `src/__tests__/components/auth/register-form.test.tsx` | Register form | 10 |
| `src/__tests__/app/(auth)/layout.test.tsx` | Auth layout redirect | 11 |
| `src/__tests__/app/(auth)/login/page.test.tsx` | Login page | 11 |
| `src/__tests__/app/(auth)/register/page.test.tsx` | Register page | 11 |
| `src/__tests__/app/(dashboard)/layout.test.tsx` | Dashboard layout | 12 |
| `src/__tests__/app/(dashboard)/page.test.tsx` | Dashboard redirect | 12 |
| `src/__tests__/app/(dashboard)/board/page.test.tsx` | Board placeholder | 12 |
| `src/__tests__/lib/crypto.test.ts` | API key encryption | 13 |
| `src/__tests__/components/settings/api-key-form.test.tsx` | API key form | 13 |
| `src/__tests__/app/(dashboard)/settings/page.test.tsx` | Settings page | 13 |
| `src/__tests__/middleware.test.ts` | Auth middleware | 14 |
| `src/__tests__/app/error.test.tsx` | Error boundary | 14 |
| `src/__tests__/app/global-error.test.tsx` | Global error boundary | 14 |
| `src/__tests__/app/layout.test.tsx` | Root layout | 14 |
| `src/__tests__/types/index.test.ts` | Type compilation | 15 |

### Mocking Strategy

| External Dependency | Mock Approach |
|-------------------|--------------|
| better-auth (server) | vi.mock("better-auth") -- mock auth.api.getSession |
| better-auth (client) | vi.mock("better-auth/react") -- mock authClient methods |
| @prisma/client | vi.mock("@prisma/client") -- mock PrismaClient |
| next/navigation | vi.mock("next/navigation") -- mock useRouter, usePathname, redirect |
| next/headers | vi.mock("next/headers") -- mock headers() |
| localStorage | jsdom provides localStorage; use beforeEach to clear |
| Web Crypto API | vi.mock or use @peculiar/webcrypto polyfill for Node |
| fetch (Anthropic API validation) | vi.mock global fetch or use msw |

---

## 6. File Count Summary

| Category | Files | Test Files | Total |
|----------|-------|------------|-------|
| Config & Scaffolding (Step 1) | 9 | 0 | 9 |
| Prisma Schema (Step 2) | 1 | 1 | 2 |
| Auth Config (Step 3) | 3 | 3 | 6 |
| DB & Env Utilities (Step 4) | 3 | 3 | 6 |
| Validators (Step 5) | 1 | 1 | 2 |
| Zustand Stores (Step 6) | 2 | 2 | 4 |
| Hooks (Step 7) | 1 | 1 | 2 |
| shadcn/ui Components (Step 8) | 10 | 10 | 20 |
| Layout Components (Step 9) | 5 | 5 | 10 |
| Auth Components (Step 10) | 2 | 2 | 4 |
| Auth Pages (Step 11) | 3 | 3 | 6 |
| Dashboard Pages (Step 12) | 3 | 3 | 6 |
| Settings & Crypto (Step 13) | 3 | 3 | 6 |
| Middleware & Error (Step 14) | 4 | 4 | 8 |
| Types (Step 15) | 1 | 1 | 2 |
| **Total** | **51** | **42** | **93** |

---

## 7. Execution Order & Dependency Graph

```
Step 1: Project Scaffolding
  |
  v
Step 2: Database Setup (Prisma Schema)
  |
  v
Step 4: Prisma Client & DB Utility ----+
  |                                     |
  v                                     v
Step 3: Auth Configuration        Step 5: Zod Validators
  |                                     |
  v                                     |
Step 6: Zustand Stores <---------------+
  |
  v
Step 7: Custom Hooks
  |
  v
Step 8: shadcn/ui Base Components
  |
  +---> Step 9: Layout Components
  |       |
  |       v
  +---> Step 10: Auth Components
  |       |
  |       v
  +---> Step 11: Auth Pages
  |
  +---> Step 12: Dashboard Layout & Page
  |
  +---> Step 13: Settings Page & API Key Form
  |
  v
Step 14: Security Middleware (depends on auth config from Step 3)
  |
  v
Step 15: Types & Documentation
```

Steps that can potentially be parallelized (no direct dependencies between them):
- Steps 9, 10, 11, 12, 13 can proceed in parallel once Steps 1-8 are complete.
- Steps 3 and 5 can proceed in parallel once Step 2 is complete.

---

## 8. Critical Implementation Rules

1. **Application code goes in workspace root** (`/Users/minhvo/Desktop/Web/ai-dlc/`), NEVER in `aidlc-docs/`.
2. **All interactive elements** must have `data-testid` attributes for automated testing.
3. **Files must stay under 200 lines** where possible. Split into subcomponents/utilities if needed.
4. **kebab-case for file names**, camelCase for variables/functions.
5. **No secrets in source code**. All sensitive values via `.env` (excluded from VCS).
6. **Exact version pinning** in package.json (no `^` or `~`).
7. **Zod schemas are the single source of truth** for validation (shared between client and server).
8. **TypeScript strict mode** enabled. Zero `@ts-ignore` or untyped `any` without justification.
9. **YAGNI/KISS/DRY** -- do not over-engineer. Stubs for future features, not full implementations.
10. **better-auth handles auth complexity** -- do not reimplement bcrypt, session management, CSRF, or rate limiting manually.
