-- A double Start left two in-progress rows, and submitting one did not stop the other.
-- Drop an in-progress attempt when that quiz or round is already submitted.
DELETE FROM "attempts" AS open_attempt
USING "attempts" AS finished
WHERE open_attempt.status = 'in_progress'
  AND finished.status IN ('submitted', 'auto_submitted')
  AND finished.organization_id = open_attempt.organization_id
  AND finished.activity_id = open_attempt.activity_id
  AND finished.participant_id = open_attempt.participant_id
  AND finished.round_id IS NOT DISTINCT FROM open_attempt.round_id
  AND finished.id <> open_attempt.id
  AND abs(extract(epoch FROM (finished.started_at - open_attempt.started_at))) < 5;

-- Keep the earliest in-progress attempt when more than one is still open.
DELETE FROM "attempts" AS open_attempt
USING "attempts" AS kept
WHERE open_attempt.status = 'in_progress'
  AND kept.status = 'in_progress'
  AND kept.organization_id = open_attempt.organization_id
  AND kept.activity_id = open_attempt.activity_id
  AND kept.participant_id = open_attempt.participant_id
  AND kept.id <> open_attempt.id
  AND (
    kept.started_at < open_attempt.started_at
    OR (kept.started_at = open_attempt.started_at AND kept.id < open_attempt.id)
  );

CREATE UNIQUE INDEX "attempts_one_open_per_participant_activity"
  ON "attempts" ("organization_id", "activity_id", "participant_id")
  WHERE "status" = 'in_progress';
