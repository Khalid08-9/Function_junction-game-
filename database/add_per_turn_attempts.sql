USE function_junction;

-- Preserve historical answers (NULL turn ID); new answers are unique per turn,
-- not per question, allowing a repeated rank/question to score on a later turn.
SET @has_column := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attempts' AND COLUMN_NAME = 'round_turn_id');
SET @sql := IF(@has_column = 0,
    'ALTER TABLE attempts ADD COLUMN round_turn_id INT UNSIGNED NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_unique := (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attempts' AND INDEX_NAME = 'uq_round_turn_attempt');
SET @sql := IF(@has_unique = 0,
    'ALTER TABLE attempts ADD CONSTRAINT uq_round_turn_attempt UNIQUE (round_turn_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Keep an index supporting the session/team foreign keys before dropping the old key.
SET @has_old := (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attempts' AND INDEX_NAME = 'uq_team_question');
SET @sql := IF(@has_old > 0, 'ALTER TABLE attempts DROP INDEX uq_team_question', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'attempts' AND CONSTRAINT_NAME = 'fk_attempt_round_turn');
SET @sql := IF(@has_fk = 0,
    'ALTER TABLE attempts ADD CONSTRAINT fk_attempt_round_turn FOREIGN KEY (round_turn_id) REFERENCES round_turns(round_turn_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
