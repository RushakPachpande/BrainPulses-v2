---
name: Login field validation
overview: Add country-aware phone validation (via libphonenumber-js) and Unique ID format checks on the student login form, disabling Continue/Sign in until valid and showing the same red outline used for OTP errors.
todos:
  - id: install-libphonenumber
    content: Add libphonenumber-js to client
    status: completed
  - id: login-validation-lib
    content: Add login-validation.ts (Unique ID + phone by country)
    status: completed
  - id: login-ui-wire
    content: Wire validation, disabled buttons, red outlines in login.tsx + CSS
    status: completed
isProject: false
---

# Login phone + Unique ID validation

## Approach

- **Phone:** Use [`libphonenumber-js`](https://www.npmjs.com/package/libphonenumber-js) (install in `client/`) so length and leading-digit rules follow each country’s official numbering plan (India: 10 digits, mobile starts with 6–9; US, UAE, etc. handled by the library). Validate against the selected dial code’s ISO from [`client/src/lib/country-codes.ts`](client/src/lib/country-codes.ts).
- **Unique ID:** Flexible client rule (matches admin-created codes up to 40 chars): trimmed, **2–40** characters, only letters, digits, hyphen, underscore (covers `BP-24101` and custom codes). Empty or other characters = invalid.
- **UX:** Primary button disabled while invalid. Red outline (reuse OTP invalid styling) on the Unique ID field and mobile number field when the value is non-empty and invalid, or after blur / failed submit attempt. Clear red state as the user edits toward a valid value.

## Changes

### 1. Dependency

- `npm install libphonenumber-js` in [`client/`](client/).

### 2. Validators

Add [`client/src/lib/login-validation.ts`](client/src/lib/login-validation.ts):

- `isValidUniqueId(code: string): boolean` — regex `/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/` after trim (min length 2).
- `resolveRegionFromDial(countryCode: string): string | undefined` — match dial to `COUNTRY_DIAL_CODES[].iso` (prefer longest dial match, e.g. `+971` before `+9`).
- `isValidNationalMobile(countryCode: string, mobileNumber: string): boolean` — build E.164 via dial + digits, then `isValidPhoneNumber(e164, region)` / `parsePhoneNumberFromString`; reject empty, non-digits (allow spaces that we strip), and unknown dial codes.

### 3. Login UI ([`client/src/pages/login.tsx`](client/src/pages/login.tsx))

- Derive `codeValid` / `phoneValid` from the helpers.
- Unique ID tab: `Sign in` disabled unless `codeValid`; apply `input-invalid` (or shared class with OTP) when shown-as-invalid.
- Phone tab: `Continue` disabled unless country + mobile valid; red outline on mobile input (and country combobox if dial is not in the known list).
- Track `touched` / `attemptedSubmit` so empty fields do not show red until blur or Continue/Sign in click; keep showing red while non-empty and invalid.
- Cap mobile input length loosely (e.g. strip non-digits on change) without blocking paste of formatted numbers.

### 4. CSS ([`client/src/styles.css`](client/src/styles.css))

- Shared rule for `.login-card input.input-invalid` (and country-code field when invalid) matching existing OTP invalid border + soft red ring (`var(--error)`).

### 5. Verify

- `npm run typecheck` in `client/`.
- Manual: India `9876510000` enables Continue; `5876510000` or 9 digits stays disabled + red after blur; Unique ID `BP-24101` ok; `BP` alone invalid.
