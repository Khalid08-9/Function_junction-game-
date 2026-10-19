USE function_junction;

-- ---------------------------------------------------------------------------
-- Migration: Jackaroo piece tracking + win condition (4 balls in the home queue)
-- ---------------------------------------------------------------------------

-- 1. Store how far a card moves a piece (NULL = no fixed move, e.g. swap/wild).
--    Guarded so the file is safe to re-run.
SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'function_junction'
      AND TABLE_NAME = 'cards'
      AND COLUMN_NAME = 'move_spaces'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE cards ADD COLUMN move_spaces INT NULL AFTER basic_action',
    'SELECT "move_spaces column already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. One row per piece (marble). Every team has 4 pieces numbered 1..4.
--    position_type: 'home' = at base, 'track' = on the board track,
--    'queue' = in the home queue (the 4-ball line that wins the game).
CREATE TABLE IF NOT EXISTS game_pieces (
    piece_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id INT UNSIGNED NOT NULL,
    team_id INT UNSIGNED NOT NULL,
    piece_number TINYINT UNSIGNED NOT NULL COMMENT '1..4',
    position_type ENUM('home','track','queue') NOT NULL DEFAULT 'home',
    position_index INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'track space, or queue slot 1..4',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_piece UNIQUE (session_id, team_id, piece_number),
    CONSTRAINT fk_piece_session FOREIGN KEY (session_id) REFERENCES game_sessions(session_id),
    CONSTRAINT fk_piece_team FOREIGN KEY (team_id) REFERENCES teams(team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
