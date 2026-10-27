---
name: First phase quiz flow
overview: Replace the Northstar demo seed with two real organizations and one startable quiz, then walk admin creation through a student attempt and fix whatever breaks, including layout at phone, tablet, and desktop widths.
todos:
  - id: reseed
    content: Replace the seed with NextGenInnov8, GreyCaps, three staff memberships, the kept students, one 20-question bank, and one active quiz.
    status: completed
  - id: retarget
    content: Point student sign-in and API tests at the new organization and the single quiz.
    status: completed
  - id: e2e
    content: Walk admin create-to-student submit and fix functional or responsive breaks.
    status: completed
isProject: false
---

# First-phase quiz flow

The student app signs in with a fixed organization slug (`demo`) in [`client/src/contexts/auth.tsx`](client/src/contexts/auth.tsx). A quiz cannot be saved or started unless it has a sponsor, a contest from that sponsor, dates, a question bank, and assigned students. The current seed in [`api/prisma/seed.ts`](api/prisma/seed.ts) does not match that: it builds Northstar Prep plus a second throwaway org, several quizzes, an assessment, and old attempt history.

## Seed

Reseed so only these organizations exist. Remove `demo` / `other` and their rows.

- **NextGenInnov8** (`nextgeninnov8`) holds the students, the bank, and the quiz.
- **GreyCaps** (`greycaps`) is the second organization for the admin picker. Same three staff memberships. No students, bank, or quiz.

Staff, all on both organizations, password `Password123!`:

- `superadmin@brainpulses.com` — super admin
- `admin@brainpulses.com` — admin with full quiz and assessment access
- `viewer@brainpulses.com` — view only

Keep the current student roster (codes `BP-24101` onward, names, phones, courses, cities). Point their emails off `northstar.demo`. They all belong to NextGenInnov8 and are assigned to the one quiz. No attempts, so each student can start.

One reusable quiz bank with 20 single-choice questions. One sponsor and one contest, because a quiz cannot exist without them. One **active** quiz whose window includes now, overall duration set, linked to that bank. No draft, completed, or archived quiz, and no assessment.

Update [`client/src/contexts/auth.tsx`](client/src/contexts/auth.tsx) and the dev login defaults so Unique ID `BP-24101` signs into NextGenInnov8.

API tests that look up `ASM-26001`, `QZ-26002`, `BP-99001`, or slug `demo` will be pointed at this quiz, or they will create an assessment inside the test when the case is specifically about rounds.

## End-to-end check

After the seed is loaded, walk the real path and fix breaks as they show up:

1. Super admin signs in, chooses NextGenInnov8, and sees the one quiz and the 20-question bank.
2. Create a second quiz in the wizard (sponsor, contest, dates, bank, behaviour) and publish it, then remove that extra quiz from the data so the seed stays at one active quiz. The check is that creation works; the seed itself is not left with two quizzes.
3. Sign in on the student app as `BP-24101`, open the quiz, answer questions, and submit.
4. Confirm the admin result for that attempt.

Repeat the admin list, wizard, student library, and attempt screen at about 375px, 768px, 1024px, and 1280px. Fix layout that overflows, stacks actions onto a second line, or hides the primary action.
