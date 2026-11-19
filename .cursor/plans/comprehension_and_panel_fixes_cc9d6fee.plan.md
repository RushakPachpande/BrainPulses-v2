---
name: Comprehension and Panel Fixes
overview: "Implement three changes to the attempt page: move passage text to a left column, hide mark-for-review when Allow Previous is off, and fix overview panel visibility."
todos:
  - id: passage-layout
    content: Create two-column layout with passage on left in attempt-question-block.tsx and portal.css
    status: completed
  - id: mark-review-fix
    content: Fix all-on-page mode to hide mark-for-review when forwardOnly is true (line 915)
    status: completed
  - id: overview-visibility
    content: Add conditional rendering to hide segs div when forwardOnly is true or showQuestionPanel is false
    status: completed
isProject: false
---

# Comprehension Passage Layout and Panel Fixes

## Current State

- **Passage text**: Rendered inline above the question text inside `.qcard` using `<div className="rich-instructions">`
- **Mark for review**: Hidden in one-at-a-time mode when `forwardOnly` (line 933), but NOT hidden in all-on-page mode (line 915 uses only `!perq`)
- **Overview panel (`.segs`)**: Always visible but non-clickable when `forwardOnly || !showQuestionPanel`; should be completely hidden when Allow Previous is OFF

---

## 1. Move Passage to Left Column

### Layout Concept
When a question has `passageText`, create a two-column layout:
- **Left**: Passage panel (sticky, scrollable) with distinct background
- **Right**: Question card (existing `.qcard`)

When no passage, render the single-column `.qcard` as today.

### Files to Change

**[`participant/src/components/attempt-question-block.tsx`](participant/src/components/attempt-question-block.tsx)**
- Wrap the existing `<article className="qcard">` in a new container div
- Conditionally render a left passage panel when `q.passageText` exists
- Remove the inline `<div className="rich-instructions">` from inside `.qcard` (line 90)

```tsx
// New structure when passageText exists:
<div className="qrow">
  <aside className="qpassage">
    <div className="rich-instructions">{q.passageText}</div>
  </aside>
  <article className="qcard">
    {/* question header, text, options, etc. */}
  </article>
</div>

// When no passageText:
<article className="qcard">...</article>
```

**[`participant/src/styles/portal.css`](participant/src/styles/portal.css)**
- Add new classes for the two-column layout:

```css
.qrow {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  width: min(1240px, 100%);  /* wider to fit both columns */
  margin: 6px auto 0;
  padding: 0 20px 40px;
}
@media (min-width: 1024px) {
  .qrow {
    grid-template-columns: minmax(300px, 400px) 1fr;
  }
}
.qpassage {
  background: var(--tint);
  border-radius: 20px;
  padding: 24px;
  position: sticky;
  top: 100px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}
.qpassage .rich-instructions {
  font: 500 16px/1.6 Manrope;
  color: var(--ink);
}
.qpassage .rich-instructions p { margin-bottom: 12px; }
```

- Adjust `.qwrap` to handle both layouts (single card stays at 942px, two-column uses wider container)

---

## 2. Hide Mark for Review When Allow Previous is OFF

**[`participant/src/pages/attempt.tsx`](participant/src/pages/attempt.tsx)**

Line 915 (all-on-page mode):
```tsx
// Before:
showMarkForReview={!perq}

// After:
showMarkForReview={!perq && !forwardOnly}
```

This aligns all-on-page with one-at-a-time (line 933 already has `!perq && !forwardOnly`).

---

## 3. Fix Overview Panel Visibility

### Bug Fix
The user reports the panel isn't visible even when Allow Previous is ON. This needs investigation during implementation - I'll check if `showQuestionPanel` is being set correctly and if there's CSS hiding it.

### Feature: Hide When Allow Previous is OFF
**[`participant/src/pages/attempt.tsx`](participant/src/pages/attempt.tsx)**

Wrap the segments div in a conditional:
```tsx
// Before (line 845):
<div className={`segs ${perq ? 'perq' : ''}`}>

// After:
{showQuestionPanel && !forwardOnly && (
  <div className={`segs ${perq ? 'perq' : ''}`}>
    ...
  </div>
)}
```

This completely hides the overview panel when:
- `showQuestionPanel` is false (admin setting)
- `forwardOnly` is true (Allow Previous is OFF or per-question mode)

---

## Responsive Behavior

| Viewport | Passage Layout | Overview Panel |
|----------|----------------|----------------|
| Mobile (<1024px) | Passage stacked above question | Full width, below header |
| Desktop (>=1024px) | Passage left, question right | In header bar |

---

## Testing Checklist
- Quiz with passage: verify two-column layout on desktop, stacked on mobile
- Quiz without passage: verify single-column layout unchanged
- Allow Previous ON: overview panel visible and clickable
- Allow Previous OFF: overview panel hidden, mark-for-review hidden
- Per-question mode: overview panel hidden, mark-for-review hidden
