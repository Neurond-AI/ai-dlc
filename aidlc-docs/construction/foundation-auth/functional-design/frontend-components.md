# Frontend Components -- UOW-01: Foundation & Auth

## Overview

This document defines all frontend components delivered in UOW-01. Each component includes its route (if a page), props interface, internal state, user interactions, API calls, and applicable business rules. Components use shadcn/ui primitives, Tailwind v4 for styling, Framer Motion for animations, and Lucide for icons.

---

## Auth Pages

### LoginPage

| Field | Value |
|-------|-------|
| **Route** | `/login` (route group: `(auth)`) |
| **File** | `src/app/(auth)/login/page.tsx` |
| **Type** | Page (Server Component shell, Client Component form) |
| **Purpose** | Entry point for returning users to authenticate |

**Layout**:
- Centered card on neutral background
- App logo/name at top
- LoginForm component
- "Don't have an account? Register" link at bottom
- No AppShell wrapper (public route)

**Behavior**:
- If user already has valid session: redirect to `/board` (checked in `(auth)/layout.tsx` server component via `auth.api.getSession`)

---

### RegisterPage

| Field | Value |
|-------|-------|
| **Route** | `/register` (route group: `(auth)`) |
| **File** | `src/app/(auth)/register/page.tsx` |
| **Type** | Page (Server Component shell, Client Component form) |
| **Purpose** | Entry point for new users to create an account |

**Layout**:
- Centered card on neutral background
- App logo/name at top
- RegisterForm component
- "Already have an account? Log in" link at bottom
- No AppShell wrapper (public route)

**Behavior**:
- If user already has valid session: redirect to `/board`

---

### LoginForm

| Field | Value |
|-------|-------|
| **File** | `src/components/auth/login-form.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Email/password login form with validation and error handling |

**Props Interface**:
```ts
// No external props. Self-contained component.
// Reads/writes authStore internally.
```

**Internal State**:
```ts
{
  email: string;          // Input value
  password: string;       // Input value
  errors: {               // Field-level validation errors
    email?: string;
    password?: string;
    form?: string;        // Server-side error (e.g., "Invalid email or password")
  };
  isSubmitting: boolean;  // Loading state during API call
}
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Type in email field | `onChange` -> update `email` state | Clear email error on change |
| Type in password field | `onChange` -> update `password` state | Clear password error on change |
| Blur email field | `onBlur` -> validate email format | Show inline error if invalid (BR-01-001) |
| Click "Log in" / press Enter | `onSubmit` -> validate all -> call API | Submit form or show errors |
| Click "Register" link | `router.push("/register")` | Navigate to register page |

**Validation (Zod Schema)**:
```ts
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
```

**API Calls**:
```ts
// On submit (after client validation passes):
authClient.signIn.email({
  email,
  password,
  callbackURL: "/board",
}, {
  onSuccess: () => { /* redirect handled by callbackURL */ },
  onError: (ctx) => { setErrors({ form: "Invalid email or password" }) },
});
```

**Business Rules**: BR-01-001, BR-01-006, BR-01-007, BR-01-008

**UI Elements**:
- Email `<Input>` (shadcn/ui) with label and error message slot
- Password `<Input>` (type="password") with label and error message slot
- "Log in" `<Button>` (shadcn/ui) with loading spinner when `isSubmitting`
- Form-level error alert (red text above button)

---

### RegisterForm

| Field | Value |
|-------|-------|
| **File** | `src/components/auth/register-form.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | New user registration form with name, email, password, confirm password |

**Props Interface**:
```ts
// No external props. Self-contained component.
```

**Internal State**:
```ts
{
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  errors: {
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  };
  isSubmitting: boolean;
}
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Type in name field | `onChange` -> update `name` | Clear name error |
| Type in email field | `onChange` -> update `email` | Clear email error |
| Type in password field | `onChange` -> update `password` | Clear password error, live strength indicator |
| Type in confirm password | `onChange` -> update `confirmPassword` | Clear confirmPassword error |
| Blur any field | `onBlur` -> validate that field | Show inline error if invalid |
| Click "Create account" / Enter | `onSubmit` -> validate all -> call API | Submit or show errors |
| Click "Log in" link | `router.push("/login")` | Navigate to login page |

**Validation (Zod Schema)**:
```ts
const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or fewer").trim(),
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
      "Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
```

**API Calls**:
```ts
authClient.signUp.email({
  email,
  password,
  name,
  callbackURL: "/board",
}, {
  onSuccess: () => { /* redirect handled by callbackURL */ },
  onError: (ctx) => {
    if (ctx.error.message.includes("already")) {
      setErrors({ email: "Email already registered" });
    } else {
      setErrors({ form: "Something went wrong. Please try again." });
    }
  },
});
```

**Business Rules**: BR-01-001, BR-01-002, BR-01-003, BR-01-004, BR-01-005

**UI Elements**:
- Name `<Input>` with label and error
- Email `<Input>` with label and error
- Password `<Input>` (type="password") with label, error, and strength indicator
- Confirm Password `<Input>` (type="password") with label and error
- "Create account" `<Button>` with loading spinner
- Form-level error alert

**Password Strength Indicator**:
- Visual bar below password field
- States: weak (red), fair (yellow), strong (green)
- Criteria checked: length >= 8, has uppercase, has lowercase, has number

---

## Layout Components

### AppShell

| Field | Value |
|-------|-------|
| **File** | `src/components/layout/app-shell.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Root layout wrapper for all authenticated (dashboard) pages |
| **Used In** | `src/app/(dashboard)/layout.tsx` |

**Props Interface**:
```ts
interface AppShellProps {
  children: React.ReactNode;
}
```

**Internal State**:
- Reads from `uiStore`: `isSidebarCollapsed`, `isBottomDockOpen`
- Reads from `authStore`: `user` (for header user menu)

**Layout Structure**:
```
<div className="flex h-screen">
  <Sidebar />
  <div className="flex flex-1 flex-col">
    <Header />
    <main className="flex-1 overflow-auto">
      {children}
    </main>
    <BottomDock />
  </div>
</div>
```

**Responsive Behavior**:
- Sidebar width controlled by CSS + `isSidebarCollapsed` state
- Main content area fills remaining horizontal and vertical space
- BottomDock anchored to bottom, pushes main content up when expanded

**Business Rules**: BR-01-016

---

### Sidebar

| Field | Value |
|-------|-------|
| **File** | `src/components/layout/sidebar.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Left navigation panel with icon links and project name |

**Props Interface**:
```ts
// No external props. Reads from stores.
```

**Internal State**:
- Reads from `uiStore`: `isSidebarCollapsed`
- Reads from `authStore`: `user` (for context)
- Uses `usePathname()` from Next.js for active route highlighting

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click "Board" nav item | `router.push("/board")` | Navigate to Kanban board |
| Click "Settings" nav item | `router.push("/settings")` | Navigate to settings |
| Click collapse toggle | `uiStore.toggleSidebar()` | Toggle between expanded/collapsed |
| Click hamburger (mobile) | `uiStore.toggleSidebar()` | Open/close sidebar overlay |

**Navigation Items**:
```ts
const navItems = [
  { icon: KanbanSquare, label: "Board", href: "/board" },
  { icon: Settings, label: "Settings", href: "/settings" },
];
```

**Responsive Behavior**:
- Desktop (>= 1024px): 240px, shows icon + label
- Tablet (768-1023px): 64px, shows icon only, tooltip on hover
- Mobile (< 768px): hidden by default, slides in as overlay

**Footer Content**:
- Project name display (stub text in UOW-01: "My Project")
- Project switcher trigger (non-functional stub, implemented in UOW-02)

**Business Rules**: BR-01-016

---

### Header

| Field | Value |
|-------|-------|
| **File** | `src/components/layout/header.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Top bar with branding, project context, and user menu |

**Props Interface**:
```ts
// No external props. Reads from stores.
```

**Internal State**:
- Reads from `authStore`: `user` (name, email for UserMenu)
- Reads from `uiStore`: `isSidebarCollapsed` (for hamburger on mobile)

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click logo/app name | `router.push("/board")` | Navigate to board |
| Click hamburger (mobile) | `uiStore.toggleSidebar()` | Toggle sidebar overlay |
| Click user avatar/name | Open UserMenu dropdown | Show dropdown |

**Layout**:
```
[Left]                    [Center]                  [Right]
Hamburger (mobile only)   Project name (stub)       UserMenu
AutoCoder logo/text
```

**Business Rules**: BR-01-018

---

### UserMenu

| Field | Value |
|-------|-------|
| **File** | `src/components/layout/user-menu.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Dropdown menu showing user info and logout action |

**Props Interface**:
```ts
// No external props. Reads from authStore.
```

**Internal State**:
- Reads from `authStore`: `user.name`, `user.email`

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click trigger (avatar + name) | Open DropdownMenu | Show dropdown |
| Click "Log out" | `authStore.logout()` | Sign out and redirect to /login |

**UI Structure** (shadcn/ui DropdownMenu):
```
[Avatar (initials)]  [User name]  [ChevronDown]
  |
  v (dropdown)
  +---------------------------+
  | User Name (bold)          |
  | user@email.com (muted)    |
  |---------------------------|
  | [LogOut icon] Log out     |
  +---------------------------+
```

**Avatar**: Initials-based (first letter of name), colored background derived from user ID hash.

**Business Rules**: BR-01-011, BR-01-018

---

### BottomDock

| Field | Value |
|-------|-------|
| **File** | `src/components/layout/bottom-dock.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Collapsible bottom panel container for agent logs (empty shell in UOW-01) |

**Props Interface**:
```ts
// No external props. Reads from uiStore.
```

**Internal State**:
- Reads from `uiStore`: `isBottomDockOpen`

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click toggle bar / chevron | `uiStore.toggleBottomDock()` | Expand or collapse panel |

**Visual States**:

| State | Height | Content |
|-------|--------|---------|
| Collapsed | 36px | Toggle bar with ChevronUp icon |
| Expanded | 300px (default) | Placeholder: "No logs yet -- start a pipeline to see agent output." |

**Animation**: Framer Motion `animate` on height change (spring transition, 300ms)

**Business Rules**: BR-01-017

---

## Settings Page (Partial -- API Key Only in UOW-01)

### SettingsPage

| Field | Value |
|-------|-------|
| **Route** | `/settings` (route group: `(dashboard)`) |
| **File** | `src/app/(dashboard)/settings/page.tsx` |
| **Type** | Page (Client Component) |
| **Purpose** | User settings with tabbed layout; API Key tab active in UOW-01 |

**Props Interface**:
```ts
// Page component. No external props.
```

**Internal State**:
- `activeTab: "api-key" | "profile"` (default: "api-key")
- Reads from `authStore`: `user`

**Layout**:
```
Settings
[API Key] [Profile]
-----------
(Tab content)
```

**Tabs**:

| Tab | Content | Status in UOW-01 |
|-----|---------|-----------------|
| API Key | `<ApiKeyForm />` | Fully functional |
| Profile | Profile edit form (name only) | Basic stub (could priority, US-054) |

**Business Rules**: BR-01-013, BR-01-014, BR-01-015

---

### ApiKeyForm

| Field | Value |
|-------|-------|
| **File** | `src/components/settings/api-key-form.tsx` |
| **Type** | Client Component (`"use client"`) |
| **Purpose** | Form to enter, validate, save, and remove Anthropic API key |

**Props Interface**:
```ts
// No external props. Self-contained.
// Manages localStorage directly.
```

**Internal State**:
```ts
{
  keyInput: string;         // Raw input value
  maskedKey: string | null; // e.g., "sk-ant-...xxxx" (derived from stored key)
  hasKey: boolean;          // Whether a key is currently stored
  isValidating: boolean;    // During Anthropic API validation
  isSaving: boolean;        // During save operation
  error: string | null;     // Validation error
  success: string | null;   // Success message
  isEditing: boolean;       // Toggle between display and edit mode
}
```

**User Interactions**:

| Action | Handler | Result |
|--------|---------|--------|
| Click "Add API Key" (no key set) | Set `isEditing = true` | Show key input field |
| Click "Update" (key exists) | Set `isEditing = true`, clear input | Show key input field |
| Type in key input | `onChange` -> update `keyInput` | Clear error on change |
| Click "Validate" | Validate key format + test against Anthropic API | Show success/error |
| Click "Save" | Validate format -> encrypt -> store in localStorage | Show success toast |
| Click "Remove Key" | Confirmation dialog -> remove from localStorage | Show removal toast |
| Click "Cancel" | Set `isEditing = false` | Return to display mode |

**Validation Flow**:
```
[1] Format check: must start with "sk-ant-" (BR-01-013)
[2] Optional API validation:
    - POST to Anthropic API with minimal request
    - 200: key valid -> show green check
    - 401/403: key invalid -> show error
    - Network error: warn, allow save anyway
[3] Encrypt via Web Crypto API (AES-GCM)
[4] Store in localStorage as "ac_api_key"
```

**UI States**:

| State | Display |
|-------|---------|
| No key, not editing | "No API key configured" + "Add API Key" button |
| No key, editing | Key input + "Save" + "Cancel" buttons |
| Has key, not editing | Masked display "sk-ant-...xxxx" + "Update" + "Remove" buttons |
| Has key, editing | Key input (empty) + "Save" + "Validate" + "Cancel" buttons |
| Validating | Input disabled, spinner on "Validate" button |
| Error | Red error text below input |
| Success | Green success text below input |

**Business Rules**: BR-01-013, BR-01-014, BR-01-015

---

## Auth Layout

### AuthLayout

| Field | Value |
|-------|-------|
| **File** | `src/app/(auth)/layout.tsx` |
| **Type** | Server Component |
| **Purpose** | Layout wrapper for login/register pages; redirects if already authenticated |

**Behavior**:
```ts
// Server Component
export default async function AuthLayout({ children }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/board");
  return <div className="min-h-screen flex items-center justify-center bg-muted/40">{children}</div>;
}
```

---

### DashboardLayout

| Field | Value |
|-------|-------|
| **File** | `src/app/(dashboard)/layout.tsx` |
| **Type** | Server Component (wraps Client Component AppShell) |
| **Purpose** | Layout for all authenticated pages; auth guard + AppShell |

**Behavior**:
```ts
// Auth check happens in middleware.ts (server-side)
// This layout wraps children with AppShell
export default function DashboardLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
```

---

## Component Dependency Tree (UOW-01 Scope)

```
Auth Pages (no AppShell):
  (auth)/layout.tsx          [Server Component - session redirect]
    login/page.tsx
      LoginForm              [authStore]
    register/page.tsx
      RegisterForm           [authStore]

Dashboard Pages (with AppShell):
  (dashboard)/layout.tsx     [Server Component - auth guard]
    AppShell                 [uiStore, authStore]
      Sidebar                [uiStore, usePathname]
      Header                 [authStore, uiStore]
        UserMenu             [authStore]
      {children}             [route content]
        board/page.tsx       [stub: "Board coming in UOW-03"]
        settings/page.tsx
          ApiKeyForm         [localStorage]
      BottomDock             [uiStore]
```

---

## Zustand Store Usage by Component

| Component | authStore | uiStore | Notes |
|-----------|-----------|---------|-------|
| LoginForm | write (login) | - | Calls authClient.signIn |
| RegisterForm | write (register) | - | Calls authClient.signUp |
| AppShell | read (user) | read (sidebar, dock) | Layout orchestration |
| Sidebar | - | read/write (collapse) | Navigation |
| Header | read (user) | read/write (sidebar) | User menu, hamburger |
| UserMenu | read/write (logout) | - | Logout action |
| BottomDock | - | read/write (dock) | Toggle open/close |
| SettingsPage | read (user) | - | Display user info |
| ApiKeyForm | - | - | Uses localStorage directly |

---

## shadcn/ui Components Required (UOW-01)

| Component | Used By | Purpose |
|-----------|---------|---------|
| Button | LoginForm, RegisterForm, ApiKeyForm, UserMenu | Primary actions |
| Input | LoginForm, RegisterForm, ApiKeyForm | Text/password inputs |
| Label | All forms | Input labels |
| Card | LoginPage, RegisterPage, SettingsPage | Content containers |
| DropdownMenu | UserMenu | User dropdown |
| Tabs | SettingsPage | Tab navigation |
| Tooltip | Sidebar (collapsed) | Icon labels on hover |
| Sonner (toast) | ApiKeyForm, logout | Success/error notifications |
| Separator | UserMenu dropdown | Visual divider |
| Alert | LoginForm, RegisterForm | Form-level errors |
