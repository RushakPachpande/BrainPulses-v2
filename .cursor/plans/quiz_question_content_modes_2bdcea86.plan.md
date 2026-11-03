---
name: Quiz question content modes
overview: Reshape the quiz Add/Edit question dialog so question and options each have a Text, Image, or Text + Image mode, while staying in the existing dialog. Assessment authoring, including comprehension, stays as it is. Import and the sample workbook accept image-only stems and options for quizzes.
todos:
  - id: quiz-dialog-modes
    content: Add quiz-only question and option content modes in BankQuestionDialog; keep dialog chrome and 2–6 options
    status: completed
  - id: persist-modes
    content: Infer modes on edit and save only the fields the active mode uses
    status: completed
  - id: import-sample
    content: Allow quiz image-only stems/options on import and show them in the sample + instructions
    status: completed
  - id: attempt-empty-stem
    content: Hide blank question text on the student attempt when only an image is present
    status: completed
isProject: false
---

# Quiz question content modes

## What changes

The HTML mock uses a drawer and a comprehension type. Quiz stays in the existing [`BankQuestionDialog`](admin/src/pages/bank-question-form.tsx). Comprehension stays assessment-only (`typesForKind('quiz')` already omits it).

For **quiz only**, replace the always-on question textarea plus optional image with two mode groups, using the current dialog, tokens, and buttons (not the mock’s drawer or palette):

- **Question type:** Single choice / Multiple choice (existing `single_mcq` / `multiple_mcq`).
- **Question content:** Text, Image, or Text + Image. Text mode shows the question field only. Image mode shows the image field only. Text + Image shows both.
- **Option content:** same three modes, applied to every option. Text shows body only. Image shows the image field only. Text + Image shows both.

Keep the current **2–6 option** limit, points field, and correct-answer rules. Do not add the mock’s explanation field, “Save & add another”, or an 8-option cap.

Assessment dialog behavior is unchanged.

## How modes map to stored data

Modes are form state, not new question types. Storage stays `question` + `answerKey.questionImageUrl` and option `body` + `imageUrl`.

When opening an existing quiz question, infer modes from what is already saved (text only, image only, or both). Default for a new question: Text + Text.

Image-only question needs an empty stem to be valid. Today [`questionBaseSchema`](api/src/modules/banks/schema.ts) requires `question` min length 1, and import rejects a blank `question` cell.

- Allow an empty question string when `questionImageUrl` is set (choice questions).
- On the student attempt, hide the stem heading when the question text is blank so an image-only item does not show an empty title ([`attempt-question-block.tsx`](client/src/components/attempt-question-block.tsx)).
- Option image-only already works: an option counts as filled when it has text or an image URL.

## Import and sample

Quiz columns stay `optionA`–`optionF` and `stemImageUrl` / `option*_imageUrl`. No extra columns.

- Import: a quiz row may omit question text when `stemImageUrl` is set. An option may be image-only (URL, blank text) or text-only (blank URL).
- Sample workbook for quiz: keep the text MCQ/MSQ rows and add one image-stem row and one image-option row so the sheet shows all three combinations.
- Instructions sheet: one line that quiz questions and options may be text, an image URL, or both, and that question text may be blank only when `stemImageUrl` is set.

## Files

- [`admin/src/pages/bank-question-form.tsx`](admin/src/pages/bank-question-form.tsx) — quiz mode controls and conditional fields.
- [`admin/src/pages/bank-question-draft.ts`](admin/src/pages/bank-question-draft.ts) — mode on the draft, infer on load, strip unused text/image on save so a mode switch does not keep hidden content.
- [`api/src/modules/banks/schema.ts`](api/src/modules/banks/schema.ts) and [`api/src/modules/banks/import-export.ts`](api/src/modules/banks/import-export.ts) — empty stem when an image is present; sample + instructions.
- [`client/src/components/attempt-question-block.tsx`](client/src/components/attempt-question-block.tsx) — omit empty stem text.