-- Time zone, date format, time format, and language were stored and never read.

DELETE FROM "settings"
WHERE "group" = 'general'
  AND "key" IN ('timezone', 'locale', 'dateFormat', 'timeFormat');
