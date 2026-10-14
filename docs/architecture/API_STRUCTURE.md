# API Structure and Service Contracts

**Status: Draft. No production API contract is established.**

## Current state
`admin/src/services/index.ts` maps fixture data to UI records; it is not a deployed API.

## Proposed principles
Use HTTPS outside local development; decide versioning/auth conventions after backend selection; enforce server-side auth/tenant scope; validate path/query/body/files; return only authorized fields; use consistent errors and pagination; make retry-sensitive mutations idempotent; document limits; maintain typed service contracts; never expose privileged DB keys in browser code.

## Example conventions (not approved)
```json
{
  "data": [],
  "page": { "limit": 25, "nextCursor": null, "hasMore": false }
}
```
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "requestId": "server-generated-id",
    "fields": { "name": "This field is required." }
  }
}
```
Confirm response format before implementation.

## Endpoint inventory to validate
| Area | Proposed operations | Notes |
|---|---|---|
| Session | sign-in/session/refresh/sign-out | Provider-dependent |
| Dashboard | summary/activity | Define metric meaning |
| Students | list/detail/create/update/deactivate | Pagination and scope |
| Users | list/invite/role change/deactivate | Audit privilege changes |
| Activities | list/detail/create/update/publish/archive | Validate state transitions |
| Banks | list/detail/create/update/import | Versioning and references |
| Registrations | list/assign/unassign/export | Scope and audit |
| Attempts | start/save/submit/resume | Idempotency/timing |
| Results | list/detail/publish/regrade | Release policy |
| Settings | read/update settings groups | Separate sensitive operations |
| Audit | list/detail | Strict permissions |
| Files | initiate/finalize upload/download | Limits and signed URLs |

Implement only approved MVP endpoints.

## HTTP and list conventions
Use GET for safe reads, POST for creation/operations, PUT for replacement, PATCH for partial updates. Document 200/201/204 and error statuses (400/401/403/404/409/422/429/500). Allowlist sort/filter fields, use stable ordering and cursor pagination for large lists, limit search input and sync URL state where useful.

## Assessment contract
Server validates eligibility and owns start/deadline/submission timestamps. Answer saves return acknowledgment/revision. Submission is idempotent. Concurrent edits have explicit behavior. Answers/results are released only when allowed. State transitions and rate limits are server-enforced.

## Import/export
Define format/encoding/size/schema version; validate server-side; return row-level errors; prevent CSV formula injection; enforce scope and audit exports.

## Required artifacts
OpenAPI/provider contract, auth sequence, endpoint-permission matrix, error catalogue, pagination rules, idempotency/concurrency, rate/upload/export limits, version/deprecation policy and contract tests.
