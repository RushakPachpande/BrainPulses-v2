# Release Checklist

## Product
- [ ] Requirements and acceptance criteria approved.
- [ ] Limitations documented; fixture data not represented as production.

## Engineering
- [ ] Type-check, lint, formatting and production build pass.
- [ ] Relevant automated tests pass.
- [ ] No unexpected console errors/warnings.

## UI/accessibility
- [ ] Light/dark and responsive layouts reviewed.
- [ ] Tables, forms, dialogs, dropdowns and sidebar reviewed.
- [ ] Keyboard/focus, labels and contrast reviewed.
- [ ] Loading, empty, error and success states reviewed.

## Security/data
- [ ] Trusted service enforces authorization.
- [ ] Tenant tests pass if applicable.
- [ ] Secret scan clean.
- [ ] Migrations reviewed and tested.
- [ ] Backup/restore plan verified for production changes.
- [ ] Upload/export limits and privacy/retention reviewed.

## Operations
- [ ] Environment config documented.
- [ ] Monitoring and error reporting configured.
- [ ] Rollback/forward-fix plan available.
- [ ] Support/incident contacts identified.
- [ ] Release approval recorded.
