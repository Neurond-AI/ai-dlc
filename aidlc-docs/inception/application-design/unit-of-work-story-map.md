# Unit of Work -- Story Map -- AutoCoder

## Full Story Mapping

### UOW-01: Foundation & Auth (6 stories)

| Story | Title | Priority | Feature |
|-------|-------|----------|---------|
| US-001 | User Registration | Must | Authentication & Onboarding (FR-01, FR-02) |
| US-002 | User Login | Must | Authentication & Onboarding (FR-01, FR-02) |
| US-003 | User Logout | Must | Authentication & Onboarding (FR-01, FR-02) |
| US-004 | Session Persistence | Must | Authentication & Onboarding (FR-01, FR-02) |
| US-005 | API Key Setup | Must | Authentication & Onboarding (FR-01, FR-02) |
| US-006 | API Key Validation on Pipeline Start | Must | Authentication & Onboarding (FR-01, FR-02) |

---

### UOW-02: Project Management (5 stories)

| Story | Title | Priority | Feature |
|-------|-------|----------|---------|
| US-007 | Create Project | Must | Project Management (FR-03) |
| US-008 | Switch Between Projects | Must | Project Management (FR-03) |
| US-009 | Rename Project | Should | Project Management (FR-03) |
| US-010 | Delete Project | Should | Project Management (FR-03) |
| US-011 | Default Project on First Login | Must | Project Management (FR-03) |

---

### UOW-03: Tasks & Kanban Board (13 stories)

| Story | Title | Priority | Feature |
|-------|-------|----------|---------|
| US-012 | Open Task Creation Modal | Must | Task Creation (FR-04) |
| US-013 | Fill Task Creation Form | Must | Task Creation (FR-04) |
| US-014 | Form Validation | Must | Task Creation (FR-04) |
| US-015 | Create Task and Start Pipeline | Must | Task Creation (FR-04) |
| US-016 | Create Task Without Starting Pipeline | Must | Task Creation (FR-04) |
| US-017 | View Kanban Board | Must | Kanban Board (FR-05) |
| US-018 | Drag Task Between Columns | Must | Kanban Board (FR-05) |
| US-019 | Auto-Move on Pipeline Progress | Must | Kanban Board (FR-05) |
| US-020 | Task Card Details Display | Must | Kanban Board (FR-05) |
| US-021 | Click Card to Open Task Detail | Must | Kanban Board (FR-05) |
| US-022 | Empty State | Should | Kanban Board (FR-05) |
| US-023 | Filter and Search Tasks | Should | Kanban Board (FR-05) |
| US-024 | Loading Skeleton | Should | Kanban Board (FR-05) |

---

### UOW-04: AI Pipeline Engine (8 stories)

| Story | Title | Priority | Feature |
|-------|-------|----------|---------|
| US-025 | Start Pipeline Manually | Must | AI Pipeline (FR-06) |
| US-026 | Planner Agent Generates Subtasks | Must | AI Pipeline (FR-06) |
| US-027 | Coder Agent Generates File Changes | Must | AI Pipeline (FR-06) |
| US-028 | Reviewer Agent Validates Output | Must | AI Pipeline (FR-06) |
| US-029 | Auto-Fix on Review Failure | Must | AI Pipeline (FR-06) |
| US-030 | Pipeline Completes Successfully | Must | AI Pipeline (FR-06) |
| US-031 | Pipeline Fails After Max Retries | Must | AI Pipeline (FR-06) |
| US-032 | Cancel Running Pipeline | Should | AI Pipeline (FR-06) |

---

### UOW-05: Pipeline UI & Agent Logs (9 stories)

| Story | Title | Priority | Feature |
|-------|-------|----------|---------|
| US-033 | View Pipeline Stages | Must | Pipeline Visualization (FR-07) |
| US-034 | Current Stage Pulses | Must | Pipeline Visualization (FR-07) |
| US-035 | Phase Timing Display | Should | Pipeline Visualization (FR-07) |
| US-036 | Completed Stages Show Checkmark | Must | Pipeline Visualization (FR-07) |
| US-037 | Open and Collapse Log Panel | Must | Agent Log Panel (FR-08) |
| US-038 | Switch Agent Tabs | Must | Agent Log Panel (FR-08) |
| US-039 | Streaming Text with Typing Effect | Must | Agent Log Panel (FR-08) |
| US-040 | Auto-Scroll Behavior | Should | Agent Log Panel (FR-08) |
| US-041 | Timestamps and Color Coding | Should | Agent Log Panel (FR-08) |

---

### UOW-06: Diff Review & Polish (13 stories)

| Story | Title | Priority | Feature |
|-------|-------|----------|---------|
| US-042 | View Diff Panel | Must | Diff Review (FR-09) |
| US-043 | Navigate File Tree | Must | Diff Review (FR-09) |
| US-044 | Side-by-Side Diff Display | Must | Diff Review (FR-09) |
| US-045 | Approve Changes | Must | Diff Review (FR-09) |
| US-046 | Request Changes | Must | Diff Review (FR-09) |
| US-047 | Retry Entire Pipeline | Should | Diff Review (FR-09) |
| US-048 | API Failure Notification | Must | Error Handling (FR-10) |
| US-049 | User Approves Retry | Must | Error Handling (FR-10) |
| US-050 | Retry with Exponential Backoff | Must | Error Handling (FR-10) |
| US-051 | Task Marked as Failed | Must | Error Handling (FR-10) |
| US-052 | View Settings Page | Must | Settings & Profile (FR-01, FR-02) |
| US-053 | Update API Key | Must | Settings & Profile (FR-01, FR-02) |
| US-054 | Update Profile | Could | Settings & Profile (FR-01, FR-02) |

---

## Coverage Verification

**Total stories defined**: 54 (US-001 through US-054)
**Total stories assigned**: 6 + 5 + 13 + 8 + 9 + 13 = **54**

All stories accounted for. No gaps. No duplicates.

| Range | Unit | Count | Verified |
|-------|------|-------|----------|
| US-001 -- US-006 | UOW-01 | 6 | Yes |
| US-007 -- US-011 | UOW-02 | 5 | Yes |
| US-012 -- US-024 | UOW-03 | 13 | Yes |
| US-025 -- US-032 | UOW-04 | 8 | Yes |
| US-033 -- US-041 | UOW-05 | 9 | Yes |
| US-042 -- US-054 | UOW-06 | 13 | Yes |

---

## Per-Unit Story Counts

| Unit | ID | Stories | Count |
|------|----|---------|-------|
| Foundation & Auth | UOW-01 | US-001 -- US-006 | 6 |
| Project Management | UOW-02 | US-007 -- US-011 | 5 |
| Tasks & Kanban Board | UOW-03 | US-012 -- US-024 | 13 |
| AI Pipeline Engine | UOW-04 | US-025 -- US-032 | 8 |
| Pipeline UI & Agent Logs | UOW-05 | US-033 -- US-041 | 9 |
| Diff Review & Polish | UOW-06 | US-042 -- US-054 | 13 |
| **Total** | | | **54** |

---

## Priority Distribution Per Unit

| Unit | Must | Should | Could | Total |
|------|------|--------|-------|-------|
| UOW-01: Foundation & Auth | 6 | 0 | 0 | 6 |
| UOW-02: Project Management | 3 | 2 | 0 | 5 |
| UOW-03: Tasks & Kanban Board | 10 | 3 | 0 | 13 |
| UOW-04: AI Pipeline Engine | 7 | 1 | 0 | 8 |
| UOW-05: Pipeline UI & Logs | 5 | 4 | 0 | 9 |
| UOW-06: Diff Review & Polish | 12 | 1 | 0 | 13 |
| **Total** | **43** | **11** | **0** | **54** |

**Note**: The stories file lists 43 Must / 10 Should / 1 Could = 54. However, re-counting from the individual stories:
- UOW-06 US-054 (Update Profile) is the sole **Could** story.
- Reconciled total: 43 Must + 10 Should + 1 Could = 54. The per-unit table above shows UOW-06 with 12 Must + 1 Should (US-047) + 0 Could... but US-054 is Could.

Corrected UOW-06 breakdown:

| Unit | Must | Should | Could | Total |
|------|------|--------|-------|-------|
| UOW-06: Diff Review & Polish | 11 | 1 | 1 | 13 |

Corrected overall:

| Priority | Count | Percentage |
|----------|-------|------------|
| Must | 43 | 79.6% |
| Should | 10 | 18.5% |
| Could | 1 | 1.9% |
| **Total** | **54** | **100%** |

---

## Priority Distribution Summary

```
Must (43)   ████████████████████████████████████████ 79.6%
Should (10) █████████ 18.5%
Could (1)   █ 1.9%
```

MVP coverage (Must stories) spans all 6 units, confirming every unit delivers critical functionality. No unit is exclusively "nice-to-have". The single Could story (US-054: Update Profile) is in UOW-06 and can be deferred without affecting any dependency chain.

---

## Feature-to-Unit Traceability

| Feature | FR | Stories | Unit(s) |
|---------|----|---------|---------|
| Authentication & Onboarding | FR-01, FR-02 | US-001 -- US-006 | UOW-01 |
| Project Management | FR-03 | US-007 -- US-011 | UOW-02 |
| Task Creation | FR-04 | US-012 -- US-016 | UOW-03 |
| Kanban Board | FR-05 | US-017 -- US-024 | UOW-03 |
| AI Pipeline | FR-06 | US-025 -- US-032 | UOW-04 |
| Pipeline Visualization | FR-07 | US-033 -- US-036 | UOW-05 |
| Agent Log Panel | FR-08 | US-037 -- US-041 | UOW-05 |
| Diff Review | FR-09 | US-042 -- US-047 | UOW-06 |
| Error Handling | FR-10 | US-048 -- US-051 | UOW-06 |
| Settings & Profile | FR-01, FR-02 | US-052 -- US-054 | UOW-06 |

All 10 features mapped. Each feature is contained within a single unit (no feature spans multiple units), keeping scope boundaries clean.
