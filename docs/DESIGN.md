> **Current authoritative tokens:** `admin/src/styles/tokens.css` and `client/src/styles/tokens.css` are application-local and imported after each app stylesheet. This document retains existing component and layout guidance. Each app has its own `docs/design-system/README.md` for brand usage.

# DESIGN.md --- Quiz & Assessment Platform

> **Purpose:** This document is the source of truth for AI coding agents
> and human contributors working on the product UI, frontend
> architecture, interaction patterns, accessibility, and design-system
> implementation.
>
> **Status:** Product and interaction contract. Visual tokens follow the
> current admin theme in [`design/DESIGN.md`](design/DESIGN.md) and
> [`COLOR_PALETTE.md`](COLOR_PALETTE.md). Treat confirmed requirements as
> mandatory. Treat items marked **Decision required** as open
> architecture choices; do not silently invent a production decision.

------------------------------------------------------------------------

## 1. Product Intent

Build a professional, dependable quiz and assessment web application
with distinct workspaces for **Students**, **Teachers**, and
**Administrators**. The interface should feel calm, modern, precise, and
trustworthy---not ornamental or trend-driven.

### Product experience goals

1.  Make the next useful action obvious.
2.  Keep navigation and page structure consistent across roles.
3.  Support assessment workflows without accidental loss of work.
4.  Work reliably on desktop, tablet, and mobile.
5.  Make loading, empty, error, success, disabled, and permission-denied
    states explicit.
6.  Support light and dark themes without reducing readability.
7.  Prefer reusable components and documented patterns over one-off page
    styling.

### Non-goals for the initial UI foundation

-   Do not invent real quiz content, scores, user records, or analytics.
-   Do not connect to a backend until its contract and authorization
    rules are confirmed.
-   Do not introduce decorative animation, gradients, glassmorphism, or
    visual effects that reduce clarity.
-   Do not treat client-side role selection as authentication or
    authorization.

------------------------------------------------------------------------

## 2. Agent Operating Rules

AI agents must follow these rules before editing or generating code.

### 2.1 Inspect before changing

-   Inspect the existing repository, package scripts, dependencies,
    routing, and component conventions before proposing structural
    changes.
-   Reuse established patterns when they meet this document. Avoid
    replacing working architecture merely to match personal preference.
-   Identify the affected pages, shared components, styles, and tests
    before editing.
-   Keep changes scoped to the requested task. Do not perform unrelated
    refactors.

### 2.2 Preserve the source of truth

-   This file defines product intent and interaction conventions.
    Color, type, radius, and admin chrome follow
    [`design/DESIGN.md`](design/DESIGN.md) and
    [`COLOR_PALETTE.md`](COLOR_PALETTE.md). Existing validated
    architecture and explicit project decisions take precedence where
    this document marks a decision as open.
-   If code and this document disagree, do not silently make a broad
    change. Explain the conflict and propose the smallest safe
    resolution.
-   Update this document when a deliberate design-system or architecture
    decision changes.
-   Never claim a feature, test, accessibility check, or integration
    works unless it has been implemented and verified.

### 2.3 Implementation discipline

-   Prefer small, composable components with clear props and predictable
    behavior.
-   Avoid giant components, duplicated navigation definitions, scattered
    magic values, and global CSS overrides.
-   Use semantic HTML and accessible native controls where practical.
-   Use explicit types when the project uses TypeScript.
-   Do not add a dependency for a trivial feature without explaining why
    it is needed.
-   Never put secrets, service-role keys, private API keys, or
    privileged credentials in browser code.
-   Never trust a role, user ID, assessment ID, score, or permission
    supplied only by the client.
-   Do not remove validation, authorization checks, or error handling to
    make a UI appear functional.

### 2.4 Definition of done

A UI change is not complete until applicable items are checked:

-   [ ] Layout works at mobile, tablet, and desktop widths.
-   [ ] No accidental horizontal overflow, overlapping controls, or
    hidden essential actions.
-   [ ] Keyboard focus is visible and keyboard interaction works.
-   [ ] Loading, empty, error, disabled, and success states are
    considered.
-   [ ] Light and dark themes remain legible.
-   [ ] Navigation and active states are correct.
-   [ ] Reusable styles and tokens are used.
-   [ ] No fake production data is presented as real data.
-   [ ] Relevant lint, type-check, and tests pass---or the unverified
    items are clearly reported.

------------------------------------------------------------------------

## 3. Information Architecture

The product uses role-aware workspaces. Navigation items must be driven
by a single structured configuration rather than duplicated
independently across pages.

### 3.1 Student workspace

**Learn** - Dashboard - My Quizzes - Assessments - Practice - Question
Bank (only if students are allowed to browse it)

**Progress** - Results & Analytics - Certificates

**Community** *(optional; decision required)* - Discussions -
Leaderboard

**Account** - Profile - Settings - Help & Support

### 3.2 Teacher workspace

**Teach** - Dashboard - Create Quiz - My Assessments - Question Bank -
Review Attempts

**Analytics** - Performance - Reports

**Manage** - Students - Categories - Settings - Help & Support

### 3.3 Administrator workspace

**Administration** - Dashboard - Users - Organizations - Categories -
Question Bank

**Oversight** - Reports & Analytics - Content Moderation - Audit Logs

**System** - Roles & Permissions - Platform Settings - Help & Support

### 3.4 Navigation rules

-   Show only navigation destinations the signed-in user is authorized
    to access.
-   Active navigation must match the current route, including nested
    routes where applicable.
-   Use labels and icons consistently. Do not rely on icon-only meaning
    in expanded navigation.
-   Collapsed desktop navigation must expose accessible labels through
    tooltips and `aria-label`.
-   Group labels are visual separators, not interactive controls.
-   Avoid duplicate destinations in multiple groups unless the product
    has a documented reason.
-   If a role has many items, allow the navigation region to scroll
    independently from the fixed brand and account areas.
-   A mobile navigation drawer must close after navigation, Escape, or
    backdrop activation.
-   Browser back/forward navigation must keep the active route and
    selected navigation state in sync.

**Implementation note:** Role selection in a local design prototype is
only a preview feature. Production roles must come from the
authenticated identity and server-validated authorization context.

------------------------------------------------------------------------

## 4. Application Shell

### 4.1 Desktop layout

-   Expanded sidebar target width: **256 px**.
-   Collapsed sidebar target width: **76 px**.
-   Top bar and sidebar header minimum height: **64 px**.
-   Main content maximum width: approximately **1600 px**.
-   Main page padding: approximately **28 px**, reducing at narrower
    breakpoints.
-   Sidebar remains fixed while its navigation list scrolls
    independently.
-   Top bar remains sticky within the application shell.
-   Main content must shrink correctly; use `min-width: 0` on grid and
    flex children where needed.

These values are initial design tokens, not reasons to break a layout.
Use responsive constraints rather than hardcoded page widths.

### 4.2 Responsive behavior

-   **Desktop:** expanded sidebar by default; user can collapse it.
-   **Tablet:** retain the shell if space permits; reduce content
    columns before shrinking controls below usable sizes.
-   **Mobile:** sidebar becomes an overlay drawer with a backdrop; main
    content uses full width.
-   The drawer must not cause the underlying page to scroll while open.
-   Escape closes the drawer and returns focus to the control that
    opened it.
-   Do not hide essential actions behind hover-only interactions.

### 4.3 Header responsibilities

The shared top bar may contain: - Sidebar toggle - Global search, when
supported - Notifications - User menu - Theme toggle -
Organization/workspace selector, if multi-tenancy is implemented

Do not overload the header with page-specific filters. Put page-level
actions and breadcrumbs in the page header.

### 4.4 Page header

Every standard page should establish a predictable hierarchy: 1.
Optional breadcrumb or workspace label 2. Page title 3. Short
description, when useful 4. Primary page action 5. Secondary actions and
filters

On narrow screens, actions may wrap or stack. They must not overlap the
title or disappear off-screen.

------------------------------------------------------------------------

## 5. Visual Design System

### 5.1 Design principles

-   **Clarity over decoration:** strong hierarchy, restrained surfaces,
    and useful whitespace.
-   **Consistency over novelty:** shared components should look and
    behave alike.
-   **Functional color:** color communicates selection, status,
    emphasis, and feedback.
-   **Stable geometry:** alignments, spacing, card edges, and control
    heights should be predictable.
-   **Content-first layouts:** the interface must still work when labels
    are longer, text is translated, or data is missing.
-   **No AI-slop:** avoid gratuitous gradients, excessive rounded cards,
    floating decorative shapes, random icon styles, fake charts, and
    meaningless dashboard metrics.

### 5.2 Theme tokens

Use the semantic tokens in `admin/src/index.css`. Components should not
hardcode theme colors. The canonical pairs are in
[`COLOR_PALETTE.md`](COLOR_PALETTE.md). Summary:

#### Light theme

| Token | Value | Use |
|---|---|---|
| `--background` | `#FAFAFF` | Application canvas |
| `--card` | `#FFFFFF` | Cards and menus |
| `--sidebar` | `#F5F3FF` | Sidebar |
| `--muted` | `#F1F5F9` | Quiet fills and search fields |
| `--foreground` | `#0F172A` | Main text |
| `--muted-foreground` | `#485563` | Secondary text |
| `--border` | `#E4E7F0` | Dividers and outlines |
| `--primary` | `#45058F` | Primary actions |
| `--accent` | `#EDE9FE` | Selected navigation and module tabs |
| `--ring` | `#7E22CE` | Keyboard focus |
| `--success` | `#047857` | Success |
| `--destructive` | `#DC2626` | Destructive actions and errors |
| `--warning` | `#B45309` | Warnings |

#### Dark theme

Dark is the default until the user stores `brainpulses-theme=light`.

| Token | Value | Use |
|---|---|---|
| `--background` | `#081020` | Application canvas |
| `--card` | `#111827` | Cards and menus |
| `--sidebar` | `#0B1425` | Sidebar |
| `--muted` | `#1F2937` | Quiet fills |
| `--foreground` | `#F8FAFC` | Main text |
| `--muted-foreground` | `#CBD5E1` | Secondary text |
| `--border` | `#334155` | Dividers and outlines |
| `--primary` | `#7E22CE` | Primary actions |
| `--accent` | `#2D1B4E` | Selected navigation |
| `--ring` | `#C084FC` | Keyboard focus |
| `--success` | `#34D399` | Success |
| `--destructive` | `#F87171` | Destructive actions and errors |
| `--warning` | `#FBBF24` | Warnings |

Verify text, control, focus, and status contrast before shipping. Do not
assume that a color combination passes accessibility simply because it
looks good.

### 5.3 Spacing and shape

Use a consistent 4 px base spacing scale:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px`

Shape rules: buttons 8 px radius; inputs and selects 9 px radius; cards
12 px radius; status pills fully rounded. Borders are 1 px using the
border token. Shadows stay on the `--shadow-sm`, `--shadow-md`, and
`--shadow-lg` tokens. Focus rings are clearly visible in both themes.
Single-line buttons, inputs, and selects are 44 px tall.

Do not use a different radius or shadow for every component. Define
shared tokens.

### 5.4 Typography

-   Headings use Plus Jakarta Sans. Body, tables, and labels use Source
    Sans 3. Fallback is Segoe UI, then sans-serif.
-   Page titles are 24–30 px and weight 700. Section titles are 18–22 px.
    Body is 16 px. UI copy (`.text-sm`) is 15 px. Labels, breadcrumbs,
    and badges (`.text-xs`) are 13 px. Table heads are 13 px uppercase.
-   Do not communicate status by color alone.
-   Use sentence case for labels and actions.
-   Keep headings concise. Table heads are the only uppercase text.

### 5.5 Gradients and illustration

-   Default to flat surfaces.
-   Do not add decorative gradients, glass panels, or rainbow metric
    tiles.
-   Never apply a gradient to cards, the sidebar, tables, or form
    controls.
-   Do not use decorative imagery as a substitute for meaningful
    information.
-   Icons must come from one consistent icon family and share a
    consistent stroke/weight style.

------------------------------------------------------------------------

## 6. Component Standards

The admin app already has these patterns. Reuse them. Names below are
the shipped components, not a second set to invent.

### Core shell

-   `AdminLayout` in `admin/src/layouts/admin-layout.tsx`
-   shadcn `Sidebar` (256 px, 76 px rail, drawer below 768 px)
-   `ModuleNav` for Assessments, Quizzes, and Settings
-   Sticky top bar: sidebar toggle, global search, theme, notifications, identity
-   `ThemeToggle`
-   Page title, description, and `PageHeaderActions`

### Data and feedback

-   shadcn `Card` (12 px, flat; KPI tiles stay on the card color)
-   `KpiGrid` for summary metrics
-   shadcn `Table` inside a card for lists; `DataTable` only where a page already uses it
-   `Toolbar` for search and filters
-   `SortHeader` for sortable columns
-   `StatusPill` and its account, flow, assignment, and attempt wrappers
-   `Skeleton` while loading
-   Sonner for toasts
-   shadcn `Dialog` for confirmation

### Assessment UI (future implementation)

-   `QuizCard`
-   `QuestionRenderer`
-   `QuestionNavigator`
-   `AssessmentTimer`
-   `AttemptProgress`
-   `AnswerInput`
-   `ReviewSummary`

### Component rules

-   Each component should have one clear responsibility and a documented
    prop contract.
-   Keep business rules out of purely presentational components.
-   Prefer composition over long lists of boolean props.
-   Do not duplicate the same markup across roles; vary configuration
    and data instead.
-   Buttons must have explicit types in forms (`button`, `submit`, or
    `reset`).
-   Destructive or irreversible actions require clear wording and
    confirmation where appropriate.
-   Tables must have semantic headers, useful empty states, responsive
    overflow behavior, and accessible row actions.
-   Skeletons should resemble the final layout and must not shift the
    page dramatically when content loads.
-   Use a stable minimum height for loading regions when layout shift
    would disrupt the user.
-   Skeletons are temporary loading indicators, not permanent
    placeholders for unfinished production pages.

------------------------------------------------------------------------

## 7. Interaction and UX Rules

### 7.1 States are part of the design

Every data-backed component or page must account for: - Initial
loading - Background refresh, when relevant - Loaded data - Empty
results - Recoverable error - Permission denied - Disabled or
unavailable action - Success feedback - Offline or interrupted request,
where relevant

Do not render an empty white panel when a request fails. Explain what
happened and offer a safe next action when possible.

### 7.2 Forms

-   Associate every field with a visible or programmatic label.
-   Place validation feedback close to the relevant field.
-   Preserve user input after recoverable errors.
-   Clearly distinguish required and optional fields.
-   Prevent accidental double submission while a request is pending.
-   Do not rely on placeholder text as the only label.
-   For long forms, group related fields and show progress only when it
    helps the user understand the task.

### 7.3 Quiz and assessment flows

-   Show the assessment title, progress, remaining time (if timed), and
    submission state in a stable, predictable location.
-   Distinguish unanswered, answered, flagged, and current questions
    using more than color alone.
-   Preserve answers during navigation between questions.
-   Warn before leaving an in-progress attempt if doing so could lose
    work.
-   Confirm final submission and clearly communicate whether it
    succeeded.
-   Do not expose correct answers, scoring logic, hidden questions, or
    answer keys before the policy allows it.
-   Do not treat a client-side timer as authoritative. Timed attempts
    require server-side validation.
-   Design for keyboard navigation and screen readers.
-   Avoid distracting motion or UI changes during timed assessments.

### 7.4 Tables and lists

-   Keep columns aligned and labels concise.
-   Provide sorting and filtering only when their behavior is clear.
-   On small screens, use intentional horizontal scrolling or switch to
    a card/list presentation; never let the whole page overflow
    accidentally.
-   Keep row actions visible and keyboard-accessible.
-   Show pagination state and result counts when applicable.

### 7.5 Motion

-   Use short, restrained transitions for navigation and theme changes.
-   Avoid animation that delays access to content or repeats
    indefinitely without purpose.
-   Respect `prefers-reduced-motion`.
-   Skeleton shimmer is optional; a static skeleton is acceptable.

------------------------------------------------------------------------

## 8. Accessibility Requirements

Target **WCAG 2.2 AA** as the product accessibility baseline.

-   Use semantic landmarks: header, nav, main, and appropriately
    structured headings.
-   Every interactive element must be keyboard reachable and have a
    visible focus state.
-   Provide accessible names for icon-only controls.
-   Maintain adequate contrast for text, controls, borders, and focus
    indicators.
-   Do not convey selection, error, or status through color alone.
-   Use correct labels and error associations for form fields.
-   Announce important asynchronous changes appropriately without making
    screen readers excessively verbose.
-   Support browser zoom and reflow; content should remain usable at
    narrow viewport widths.
-   Manage focus when dialogs and mobile navigation drawers open and
    close.
-   Ensure targets are comfortably usable on touch screens; use
    approximately 44 × 44 px where practical.
-   Test with keyboard-only navigation and at least one
    screen-reader/browser combination before release.

------------------------------------------------------------------------

## 9. Theme Behavior

-   Support light and dark themes across the entire shell and all
    reusable components.
-   Use semantic design tokens, not scattered literal color values.
-   Theme changes must not reset the current route, form values,
    selected filters, or in-progress UI state.
-   Ensure charts, status badges, borders, skeletons, menus, dialogs,
    and focus rings adapt to the active theme.
-   Dark is the initial theme. A stored `brainpulses-theme` value of
    `light` selects the light theme. Do not flash the opposite theme on
    load.
-   If theme preference persistence is implemented, store only the
    preference; never store sensitive information in browser storage.
-   Avoid transitions that briefly flash the wrong theme on page load.

------------------------------------------------------------------------

## 10. Frontend Architecture Guidance

**Architecture is a proposal until the repository is inspected.** Do not
replace the current stack solely to match this section.

### 10.1 Suggested logical structure

``` text
src/
  app/
    App.tsx
    routes.tsx
    providers/
      ThemeProvider.tsx
      AuthProvider.tsx
  components/
    layout/
      AppShell.tsx
      Sidebar.tsx
      Topbar.tsx
      PageHeader.tsx
    ui/
      Button.tsx
      Card.tsx
      Skeleton.tsx
      EmptyState.tsx
      StatusBadge.tsx
  features/
    dashboard/
    quizzes/
    assessments/
    question-bank/
    results/
    certificates/
    users/
    reports/
    settings/
  config/
    navigation.ts
  hooks/
  lib/
  styles/
    tokens.css
    globals.css
  types/
```

This is an example, not a mandatory directory tree. Follow existing
project conventions if the repository already has a sound structure.

### 10.2 Boundaries

-   **Routing:** maps URLs to pages and handles protected route entry.
-   **Layout:** owns sidebar, top bar, content container, and responsive
    shell.
-   **Navigation configuration:** defines labels, route IDs, icons,
    grouping, and required permissions in one place.
-   **Features:** own page-specific UI and workflows.
-   **UI components:** presentational and reusable; should not silently
    fetch unrelated data.
-   **API/data layer:** centralizes requests, validation, error mapping,
    and cache behavior.
-   **Authentication/authorization:** handles identity and
    permission-aware UX; server remains authoritative.
-   **Design tokens:** centralizes colors, spacing, type, radius,
    shadows, and motion.

### 10.3 State management

-   Keep local UI state local when possible.
-   Use URL state for shareable navigation state such as search terms,
    filters, sort order, and pagination when appropriate.
-   Use the project's established server-state library if one exists.
-   Avoid duplicating the same source of truth across local state,
    global state, and URL state.
-   Do not introduce a global state library until real complexity
    justifies it.

### 10.4 Data contracts

-   Use typed interfaces or schemas for API responses and user input.
-   Handle missing, null, stale, and unexpected data safely.
-   Validate data at system boundaries.
-   Do not couple components to raw database schema if a service/domain
    layer can provide a stable UI model.
-   Never use dummy placeholder values as fallbacks that could be
    mistaken for real user data.

------------------------------------------------------------------------

## 11. Security and Role-Based Access

UI visibility is not a security boundary.

-   The backend must enforce authentication, tenant boundaries,
    ownership, and role permissions for every protected operation.
-   The frontend may hide or disable unavailable actions to improve UX,
    but the server must reject unauthorized requests independently.
-   Do not store secrets in `VITE_*` variables or any other
    client-exposed environment variable.
-   Do not expose answer keys or unreleased assessment content in client
    payloads.
-   Do not trust scores, duration, attempt status, role claims, or
    ownership sent by the browser.
-   Protect against cross-tenant data access at the API/database layer.
-   Log security-relevant events on the server according to the
    product's privacy and retention requirements.
-   Avoid logging passwords, tokens, private assessment answers, or
    other sensitive data.
-   Use least-privilege access and separate public/client credentials
    from privileged server credentials.

**Decision required:** confirm authentication provider, backend/API
contract, database, tenant model, and authorization strategy before
implementing production access control.

------------------------------------------------------------------------

## 12. Performance and Reliability

-   Avoid unnecessary re-renders and oversized page bundles; measure
    before optimizing.
-   Lazy-load routes or heavy feature modules when it materially
    improves initial load.
-   Keep skeleton dimensions close to final content to minimize
    cumulative layout shift.
-   Avoid blocking the main thread with large synchronous
    transformations.
-   Use pagination or virtualization for genuinely large lists rather
    than rendering thousands of rows at once.
-   Debounce search only when appropriate and communicate loading states
    clearly.
-   Cancel or ignore stale requests when the user changes routes or
    filters.
-   Provide recoverable error UI for network failures.
-   Avoid broad dependency additions and duplicate libraries for the
    same task.
-   Use stable keys for rendered lists and stable component contracts.

------------------------------------------------------------------------

## 13. Content and Placeholder Policy

During UI-only development: - Use clearly synthetic placeholder data or
neutral skeletons. - Use short, realistic-length placeholder labels to
test wrapping. - Do not fill dashboards with invented metrics that
appear to be genuine. - Use skeletons for loading states and empty
states for successfully loaded datasets that contain no records. -
Replace lorem ipsum before user-facing release. - Do not use placeholder
buttons that look functional but silently do nothing. If an interaction
is not implemented, show a clear disabled state or mark it as
prototype-only.

------------------------------------------------------------------------

## 14. Testing and Review

### Minimum frontend checks

-   Type check and lint, if configured
-   Build succeeds
-   Route rendering and navigation states
-   Role-specific navigation visibility
-   Sidebar collapse/expand on desktop
-   Mobile drawer open/close and focus behavior
-   Light/dark theme across core components
-   Empty, loading, and error states
-   Keyboard-only operation
-   Form validation and double-submit prevention
-   Responsive checks at approximately 360 px, 768 px, 1024 px, and 1440
    px
-   No unintended horizontal overflow
-   Browser console free of new errors and warnings

### Test strategy

-   Unit-test utility functions and important component logic.
-   Component-test stateful interactions and accessibility semantics.
-   Integration-test route transitions and role-aware navigation.
-   End-to-end-test critical assessment journeys once backend contracts
    are available.
-   Never claim tests passed if they were not run. Report exact commands
    and outcomes.

------------------------------------------------------------------------

## 15. Decisions to Confirm

Do not silently settle these points. Record the decision in this
document or the relevant architecture record when confirmed.

  -----------------------------------------------------------------------
  Decision                Current status          Why it matters
  ----------------------- ----------------------- -----------------------
  React + TypeScript or   Confirm from repository Types and component
  JavaScript                                      contracts

  Router                  Inspect existing setup  Route layout and
                                                  protected navigation

  CSS approach            Inspect existing setup  Token and component
                                                  styling strategy

  UI/icon library         Inspect existing setup  Consistent component
                                                  and icon language

  Authentication provider Not specified           Identity and session
                                                  handling

  Backend/API             Not specified           Data contracts and
                                                  authorization

  Database and migrations Not specified           Persistence and data
                                                  integrity

  Tenant/organization     Not specified           Data isolation and
  model                                           admin workflows

  Assessment autosave     Not specified           Preventing loss of
  strategy                                        attempts

  Timer and submission    Server must be          Assessment integrity
  authority               authoritative           

  Community features      Optional                Navigation scope and
                                                  moderation

  Theme persistence       Not specified           Preference behavior

  Analytics and audit     Not specified           Privacy and operational
  retention                                       policy
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 16. Rules for Updating This Document

When a deliberate decision changes:

1.  Update the relevant section and the decision table.
2.  Explain the rationale and any trade-offs.
3.  Check for conflicting rules elsewhere in this file.
4.  Update component contracts and tests affected by the decision.
5.  Keep examples aligned with the actual repository.
6.  Do not add speculative architecture as though it were already
    implemented.

For major decisions, add a short Architecture Decision Record (ADR)
under `docs/adr/` if the repository uses or adopts ADRs.

------------------------------------------------------------------------

## 17. Final Principle

**The interface should feel predictable, resilient, and trustworthy.** A
user must understand where they are, what they can do, what the system
is doing, and how to recover when something goes wrong. Every design and
implementation decision should reinforce that principle.
