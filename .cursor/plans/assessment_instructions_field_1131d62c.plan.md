---
name: Assessment instructions field
overview: Show the same Instructions editor already used when creating a quiz on the assessment Basic Details step. Saving, loading, and the participant start screen already support activity instructions for both kinds.
todos:
  - id: show-instructions
    content: Render the shared Instructions editor on assessment Basic Details, after the cover image and before sponsor/contest, leaving Quiz End Message quiz-only.
    status: completed
isProject: false
---

# Assessment instructions on Basic Details

Assessments and quizzes share [admin/src/pages/activity-wizard.tsx](admin/src/pages/activity-wizard.tsx). Instructions are stored on the activity and already round-trip for both kinds:

- State, load, dirty fingerprint, and save already send `instructions` (sanitized HTML, or `null` when empty) in `persist`.
- Create and update schemas in [api/src/modules/activities/schema.ts](api/src/modules/activities/schema.ts) accept `instructions` with no quiz-only check.
- The participant start screen in [participant/src/pages/activity-detail.tsx](participant/src/pages/activity-detail.tsx) renders `item.instructions` for any activity. If it is empty, the existing default instruction list stays.

The field is hidden only in the form. Inside Basic Details, `isQuiz` wraps image, instructions, and quiz end message. The assessment branch renders only the cover image.

## Change

In the Basic Details block of [admin/src/pages/activity-wizard.tsx](admin/src/pages/activity-wizard.tsx) (around the `isQuiz` branch at lines 829–896):

- Keep the cover image kind-specific (`Quiz image` vs `Assessment image`).
- Move the existing `Instructions` `RichTextEditor` (`id="activity-instructions"`) so it renders for both kinds, after the image and before Sponsor / Contest — the same place it sits on a quiz.
- Leave **Quiz End Message** quiz-only.
- Set the editor `aria-label` from the existing `noun` (`Quiz instructions` / `Assessment instructions`). Keep the current helper text: shown before participants start, confirmation required, bold / italic / lists.

No API, schema, or participant changes. Create, edit, and view use this same step, so view stays read-only through the existing `disabled={readOnly}` prop.

## Check

With admin on `http://localhost:5173` if it is already running: open create assessment, confirm Instructions is on Basic Details, enter formatted text, continue far enough to save, then reopen edit and confirm the text is still there. Quiz Basic Details should still show Instructions and Quiz End Message.