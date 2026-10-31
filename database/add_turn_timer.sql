USE function_junction;

-- Existing installations only; fresh installations use schema.sql.
SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'function_junction'
      AND TABLE_NAME = 'game_state' AND COLUMN_NAME = 'turn_started_at'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE game_state ADD COLUMN turn_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER turn_number',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
