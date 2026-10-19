USE function_junction;

-- ---------------------------------------------------------------------------
-- Migration: one answer per team per question in a session
-- ---------------------------------------------------------------------------
-- Prevent both teammates from scoring for the same question, which would
-- otherwise move two Jackaroo pieces on a single turn and end the game
-- sooner than intended.
--
-- Run with:  mariadb -u YOUR_DB_USER -p function_junction < database/add_unique_team_question_attempt.sql
-- ---------------------------------------------------------------------------

SET @uk_exists := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'function_junction'
      AND TABLE_NAME = 'attempts'
      AND INDEX_NAME = 'uq_team_question'
);
SET @sql := IF(@uk_exists = 0,
    'ALTER TABLE attempts ADD CONSTRAINT uq_team_question UNIQUE (session_id, team_id, question_id)',
    'SELECT "uq_team_question already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
