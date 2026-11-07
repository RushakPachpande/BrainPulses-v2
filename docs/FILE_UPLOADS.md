# File uploads

## Layout

Configured via `UPLOAD_DIR` (default `./uploads`). Existing placement trees under organization folders are preserved. Temporary job artifacts:

```text
uploads/
├── … existing org / pending / placed trees …
└── temporary/
    └── jobs/          # export outputs and import staging (gitignored)
```

Ensure `api/uploads` (and `temporary/jobs`) exist on deploy; `setup.sh` creates `api/uploads`. Never delete `api/uploads` during updates.

## Security controls (API)

- Initiate + stream finalize for binary assets (`/api/files/...`) with MIME/extension allowlists and size caps (`UPLOAD_IMAGE_SIZE_CAPPING`, `QA_UPLOAD_IMAGE_SIZE_CAPPING`).
- Spreadsheet imports use multer memory limits then stage under `temporary/jobs` for queue workers.
- Path traversal is avoided by UUID-based storage names and controlled relative paths in `files/paths.ts`.
- Downloads use short-lived Redis tokens (`FILE_DOWNLOAD_TTL_SECONDS`) or authenticated job download routes.

## Frontends

Admin uploads go through the API only (`apiPostFormData` / file initiate flows). Participant and client do not upload privileged catalog files.

## External storage

Object storage / NFS migration is **out of scope** until explicitly approved. Local disk remains the production SoT for binaries on the single API host.
