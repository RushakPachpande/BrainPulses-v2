---
name: OTP paste support
overview: Add paste handling on the student login OTP digit inputs so a copied 6-digit code fills all boxes and auto-submits when complete.
todos:
  - id: otp-paste
    content: Add OTP paste + multi-digit fill helper in login.tsx
    status: completed
isProject: false
---

# OTP paste support

## Problem

In [`client/src/pages/login.tsx`](client/src/pages/login.tsx), `updateOtpDigit` keeps only the last digit (`slice(-1)`), and inputs use `maxLength={1}`. Paste therefore lands a single character in the focused box.

## Fix (one file)

In [`client/src/pages/login.tsx`](client/src/pages/login.tsx):

1. Add `applyOtpDigits(raw: string, startIndex = 0)` that strips non-digits, writes up to 6 chars into `otpDigits` from `startIndex`, focuses the next empty (or last filled) box, and calls `submitOtp` when all six are filled.
2. Add `onOtpPaste(index, e)` that `preventDefault`s, reads `e.clipboardData.getData('text')`, and calls `applyOtpDigits`.
3. Wire `onPaste={(e) => onOtpPaste(index, e)}` on each OTP input.
4. Tighten `updateOtpDigit`: if `value` contains multiple digits (some browsers fire change with the full paste), route through `applyOtpDigits` instead of taking only the last char.

No CSS or API changes.
