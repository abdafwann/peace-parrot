-- Existing active timed mutes remain active until an administrator unmutes.
UPDATE mutes
SET expires_at = NULL
WHERE expires_at IS NOT NULL
  AND datetime(
    CASE
      WHEN instr(expires_at, ' +') > 0 THEN
        substr(expires_at, 1, 19) || substr(expires_at, instr(expires_at, ' +') + 1, 3) || ':' || substr(expires_at, instr(expires_at, ' +') + 4, 2)
      WHEN instr(expires_at, ' -') > 0 THEN
        substr(expires_at, 1, 19) || substr(expires_at, instr(expires_at, ' -') + 1, 3) || ':' || substr(expires_at, instr(expires_at, ' -') + 4, 2)
      ELSE expires_at
    END
  ) > datetime('now');
