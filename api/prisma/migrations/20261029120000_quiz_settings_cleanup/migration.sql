-- Drop leaderboard flags and replace the score visibility boolean with a release mode.
UPDATE "activities"
SET "settings" = jsonb_set(
  "settings"
    #- '{quiz,dailyLeaderboardVisible}'
    #- '{quiz,overallLeaderboardVisible}'
    #- '{quiz,dailyGroupLeaderboardVisible}'
    #- '{quiz,overallGroupLeaderboardVisible}'
    #- '{quiz,countsForGroupLeaderboard}'
    #- '{quiz,leaderboardReleasedAt}'
    #- '{quiz,scoreVisibleToStudent}',
  '{quiz,scoreRelease}',
  to_jsonb(
    CASE
      WHEN "settings" #>> '{quiz,scoreVisibleToStudent}' = 'true' THEN 'after_publish'
      ELSE 'after_submit'
    END
  ),
  true
)
WHERE "settings" ? 'quiz';

ALTER TYPE "BankOrigin" ADD VALUE IF NOT EXISTS 'quiz_local';
