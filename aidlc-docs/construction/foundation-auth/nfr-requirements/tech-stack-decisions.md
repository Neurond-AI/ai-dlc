# Tech Stack Decisions -- UOW-01: Foundation & Auth

## Overview

All technology decisions for UOW-01 with version targets, rationale, alternatives considered, and version pinning strategy. Decisions are final -- established during Inception requirements analysis.

---

## Technology Stack

| Technology | Version | Purpose | Rationale |
|-----------|---------|---------|-----------|
| Next.js | 15.x | Full-stack framework | App Router with RSC, built-in API routes, middleware for security headers + auth guards, file-based routing reduces boilerplate |
| React | 19.x | UI library | Concurrent features (Suspense, transitions), required by Next.js 15, server component support |
| TypeScript | 5.x | Language | Type safety across full stack, strict mode eliminates common runtime errors, Zod schema inference |
| PostgreSQL | 16.x | Primary database | Production-grade RDBMS, JSON column support for pipeline state, full-text search for future task search, mature ecosystem |
| Prisma | 6.x | ORM | Type-safe queries generated from schema, declarative migrations, better-auth Prisma adapter, schema-first design aligns with SDD |
| better-auth | latest | Authentication | Framework-agnostic, first-class Prisma adapter, built-in session management + CSRF + rate limiting, bcrypt hashing, minimal config |
| Zustand | 5.x | Client state management | Lightweight (~1KB), TypeScript-first with inferred types, no boilerplate (no reducers/actions), React 19 compatible |
| Tailwind CSS | 4.x | Styling | Utility-first removes CSS file management, JIT compilation, design tokens via CSS variables, shadcn/ui prerequisite |
| shadcn/ui | latest | Component library | Accessible (Radix primitives), copy-paste ownership (no version lock-in), Tailwind-native, consistent design system |
| Framer Motion | latest | Animation library | Declarative API, layout animations for route transitions, exit animations, Spring physics |
| Lucide React | latest | Icon library | Tree-shakeable (only used icons bundled), consistent stroke-based style, 1000+ icons, MIT license |
| Zod | 3.x | Validation | Schema-first validation, TypeScript type inference (`z.infer<>`), works on client and server, composable schemas |
| Docker / Docker Compose | latest | Dev infrastructure | PostgreSQL container eliminates local install, reproducible dev environment, single `docker compose up` |
| bcrypt | (via better-auth) | Password hashing | Adaptive cost factor, industry standard, better-auth handles integration transparently |

---

## Decision Rationale -- Key Choices

### Next.js 15 over alternatives

**Decision**: Next.js 15 with App Router as the full-stack framework.

**Rationale**:
- App Router provides RSC (React Server Components) for initial page loads -- reduces client JS bundle
- Built-in middleware for auth guards and security headers (no Express needed)
- API routes colocated with frontend -- single deployment unit
- File-based routing eliminates manual route configuration
- Streaming SSR support for future SSE integration (UOW-04)

**Alternatives considered**:
| Alternative | Why rejected |
|-------------|-------------|
| Remix | Smaller ecosystem, less mature middleware story, weaker deployment options |
| Vite + Express | Two deployment targets, manual SSR setup, more boilerplate for equivalent features |
| SvelteKit | Team expertise gap, smaller component library ecosystem, no equivalent to shadcn/ui |
| Astro | Optimized for content sites, weaker SPA interactivity story for Kanban board |

### better-auth over alternatives

**Decision**: better-auth for authentication.

**Rationale**:
- First-class Prisma adapter -- sessions stored in same PostgreSQL instance (no Redis needed)
- Built-in rate limiting, CSRF protection, bcrypt hashing -- fewer manual security implementations
- Framework-agnostic -- works with Next.js App Router without adapter hacks
- Session-based auth (not JWT) -- server-side invalidation on logout, no token revocation complexity
- Minimal configuration for full auth flow (register, login, logout, session check)

**Alternatives considered**:
| Alternative | Why rejected |
|-------------|-------------|
| NextAuth.js (Auth.js v5) | Complex adapter system, JWT-first by default (session DB adapter less documented), migration churn between v4/v5 |
| Clerk / Auth0 | External dependency, cost at scale, vendor lock-in, API key required to authenticate (circular dependency for this app) |
| Custom auth from scratch | High security risk, reinventing bcrypt integration + session management + CSRF -- better-auth handles all of this |
| Lucia Auth | Deprecated as of March 2024, author recommends rolling your own or using better-auth |

### Zustand over alternatives

**Decision**: Zustand 5 for client-side state management.

**Rationale**:
- ~1KB gzipped -- minimal bundle impact for a demo/MVP
- TypeScript-first with automatic type inference from store definition
- No boilerplate (no actions, reducers, providers, or context wrapping)
- Supports middleware (persist, devtools) for future needs
- React 19 compatible with `useSyncExternalStore`

**Alternatives considered**:
| Alternative | Why rejected |
|-------------|-------------|
| Redux Toolkit | Overkill for 5 stores, more boilerplate (slices, thunks, provider), larger bundle |
| Jotai | Atomic model better for fine-grained state, less intuitive for domain stores (auth, ui, task) |
| React Context + useReducer | Re-renders entire subtree on state change, no built-in devtools, verbose for multiple stores |
| TanStack Query | Complementary (server state), not a replacement for client state (auth, UI). May add in future UOWs for API caching. |

### PostgreSQL over alternatives

**Decision**: PostgreSQL 16 as the primary database.

**Rationale**:
- Production-grade RDBMS with ACID transactions
- JSON/JSONB columns for flexible pipeline state storage (pipelineState, subtasks, agentLogs)
- Full-text search for future task search feature
- Prisma has first-class PostgreSQL support
- better-auth Prisma adapter stores sessions in PostgreSQL
- Docker image readily available for local dev

**Alternatives considered**:
| Alternative | Why rejected |
|-------------|-------------|
| SQLite | No concurrent write support, not production-representative, file-based limits deployment options |
| MySQL | Weaker JSON support, no native full-text search on JSON fields, PostgreSQL is Prisma's best-supported DB |
| MongoDB | Schema-less is a liability (Prisma works better with relational), no ACID transactions across documents, overkill for structured data |
| Supabase (hosted PG) | External dependency, unnecessary for local-first dev, adds network latency in development |

### Tailwind CSS v4 + shadcn/ui

**Decision**: Tailwind v4 for styling with shadcn/ui as the component library.

**Rationale**:
- Tailwind v4: CSS-first config (no `tailwind.config.ts`), native CSS variables for design tokens, faster JIT
- shadcn/ui: components are copied into project (full ownership, no version lock-in), built on Radix primitives (accessible by default), Tailwind-native styling
- Combined: consistent design system with accessibility guarantees, rapid UI development

**Alternatives considered**:
| Alternative | Why rejected |
|-------------|-------------|
| CSS Modules | Manual responsive utilities, no design token system, slower development velocity |
| Chakra UI | Runtime CSS-in-JS (performance penalty), larger bundle, Tailwind incompatible |
| MUI (Material UI) | Opinionated Material Design aesthetic, heavy bundle, Tailwind incompatible |
| Mantine | Good DX but runtime styles, smaller community than shadcn/ui, less Tailwind integration |

### Zod for validation

**Decision**: Zod 3.x as the validation library.

**Rationale**:
- TypeScript type inference: `z.infer<typeof schema>` generates types from schemas (single source of truth)
- Works identically on client (form validation) and server (API validation) -- DRY
- Composable: extend, merge, pick, omit schemas without duplication
- better-auth and Prisma ecosystem both integrate with Zod
- Error messages are structured and field-level (good for form UX)

**Alternatives considered**:
| Alternative | Why rejected |
|-------------|-------------|
| Yup | Weaker TypeScript inference, less composable, losing community momentum to Zod |
| Joi | Node-only (no browser support), cannot share schemas client/server |
| ArkType | Newer, smaller ecosystem, less battle-tested |
| Manual validation | DRY violation, error-prone, no type inference |

---

## Version Pinning Strategy

### Policy
- **Exact versions** in `package.json` for all dependencies (no `^` or `~` prefixes)
- **Lock file** (`package-lock.json`) committed to version control
- **Rationale**: Reproducible builds. No surprise breaking changes from minor/patch updates.

### Pinned Versions (UOW-01 targets)

| Package | Pinned Version | Notes |
|---------|---------------|-------|
| next | 15.x.x | Pin to latest stable 15.x at project init |
| react | 19.x.x | Must match Next.js 15 peer dependency |
| react-dom | 19.x.x | Must match React version |
| typescript | 5.x.x | Pin to latest 5.x stable |
| prisma | 6.x.x | Pin to latest 6.x stable |
| @prisma/client | 6.x.x | Must match prisma version |
| better-auth | x.x.x | Pin to latest stable at init |
| zustand | 5.x.x | Pin to latest 5.x stable |
| tailwindcss | 4.x.x | Pin to latest 4.x stable |
| framer-motion | x.x.x | Pin to latest stable at init |
| lucide-react | x.x.x | Pin to latest stable at init |
| zod | 3.x.x | Pin to latest 3.x stable |

### Update Strategy
- Dependencies updated per UOW boundary (not mid-UOW)
- Security patches applied immediately regardless of UOW boundary
- Major version upgrades evaluated during OPERATIONS phase

---

## Infrastructure Decisions

### Docker Compose (local dev)

**Configuration**:
```yaml
# PostgreSQL only -- app runs via npm run dev
services:
  postgres:
    image: postgres:16-alpine  # Pinned major version
    ports:
      - "5432:5432"            # Localhost only
    environment:
      POSTGRES_USER: autocoder
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # From .env
      POSTGRES_DB: autocoder
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

**Rationale**: PostgreSQL container only. App runs natively via `npm run dev` for fast HMR. No need to containerize the app during development.

### Environment Variables

**Required for UOW-01**:

| Variable | Purpose | Example |
|----------|---------|---------|
| DATABASE_URL | Prisma connection string | `postgresql://autocoder:secret@localhost:5432/autocoder` |
| BETTER_AUTH_SECRET | Session signing secret | Random 32+ character string |
| BETTER_AUTH_URL | Auth base URL | `http://localhost:3000` |
| NODE_ENV | Environment flag | `development` |

**Validation**: All variables validated at startup via `lib/env.ts` using Zod. Missing or invalid values cause immediate process exit with descriptive error.

---

## Compatibility Matrix

| Technology | Requires | Compatible With |
|-----------|----------|-----------------|
| Next.js 15 | React 19, Node 18.17+ | Prisma 6, Tailwind 4 |
| better-auth | Prisma adapter | Next.js App Router, PostgreSQL |
| Prisma 6 | Node 18+, PostgreSQL 12+ | better-auth adapter |
| shadcn/ui | Tailwind CSS 4, React 19 | Radix UI, Lucide icons |
| Zustand 5 | React 18+ | React 19, TypeScript 5 |
| Tailwind CSS 4 | PostCSS | Next.js 15, shadcn/ui |
