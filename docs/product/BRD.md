# Business Requirements Document (BRD)

**Product:** BrainPulses · **Version:** 0.1 · **Status:** Draft for stakeholder validation

## 1. Executive summary
BrainPulses is intended to provide a consistent platform for administering quizzes and assessments, including learner records, reusable question banks, registrations, attempts, results and settings. The current repository is an admin UI prototype, not proof of a live production service.

## 2. Business problem
Assessment teams need reliable workflows for preparing activities, managing learners, assigning question content, tracking participation and reviewing results. Disconnected spreadsheets/tools can increase manual effort, duplicate records and operational errors. Validate the target segment and baseline with stakeholders.

## 3. Objectives
1. Provide one coherent admin workspace.
2. Reduce manual handling of learner and assessment data.
3. Make registrations, assignments, attempts and results easier to inspect.
4. Establish a consistent design system.
5. Build toward secure role-based access and auditable actions.
6. Support accessible, responsive workflows.

## 4. Stakeholders
| Stakeholder | Interest |
|---|---|
| Product owner | Scope, adoption and outcomes |
| Super administrator | Platform configuration and oversight |
| Administrator | Learner records and operations |
| Teacher/author | Question banks, activity setup and review |
| Student/learner | Clear instructions and reliable attempts |
| Engineering/QA | Correctness, security and maintainability |
| Operations/support | Monitoring, recovery and auditability |

Roles and exact permissions require approval.

## 5. Scope
**Product direction:** dashboard; students/users; quizzes/assessments; reusable question banks; registration/assignment tracking; attempts/results; General, Access, Notifications and System settings; authorized import/export; audit trail.

**Not in the initial baseline unless approved:** payments, proctoring, native mobile apps, marketplace/social features, AI grading/question generation, external LMS/SIS integrations, legacy migration.

## 6. Business requirements
- **BR-01:** Role-appropriate workspaces.
- **BR-02:** Authorized staff can manage learner and staff records.
- **BR-03:** Authorized staff can manage activities and reusable banks.
- **BR-04:** Staff can inspect registration, assignment, attempt and result states.
- **BR-05:** Settings provide truthful save/error feedback.
- **BR-06:** Sensitive admin actions are auditable.
- **BR-07:** Student data and answers are protected server-side.
- **BR-08:** Core workflows support keyboard and responsive use.
- **BR-09:** Pages follow one design system.
- **BR-10:** Bulk operations validate data and report row-level errors.

## 7. Success measures
Agree targets before launch. Candidate metrics: activity creation time, import error rate, registration accuracy, completion rate, report generation time, support tickets, usability completion rate, and critical accessibility/security defects. Do not invent baselines.

## 8. Risks
| Risk | Mitigation |
|---|---|
| Fixture data mistaken for live | Label demo data; replace before launch |
| UI-only permissions | Enforce in trusted API/database |
| Answer-key leakage | Minimize payloads; server-side scoring/release |
| Inconsistent UI | Enforce DESIGN.md and shared components |
| Undefined tenancy | Decide before schema/API |
| Undefined retention | Confirm privacy/export/deletion rules |

## 9. Decisions for business owner
Initial customer segment; multi-tenancy; final roles/permissions; timed exam requirements; certificates/discussions/proctoring/integrations; privacy/retention; measurable launch criteria.
