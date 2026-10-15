

USE function_junction;

CREATE TABLE IF NOT EXISTS round_turns (
    round_turn_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_id    INT UNSIGNED NOT NULL,
    round_number  INT UNSIGNED NOT NULL,
    turn_order    TINYINT UNSIGNED NOT NULL,  -- 1 = plays first in this round
    user_id       INT UNSIGNED NOT NULL,
    team_id       INT UNSIGNED NOT NULL,
    played_at     DATETIME NULL,              -- NULL = has not played yet
    PRIMARY KEY (round_turn_id),
    UNIQUE KEY uq_round_order (session_id, round_number, turn_order),
    UNIQUE KEY uq_round_player (session_id, round_number, user_id),
    CONSTRAINT fk_turn_session FOREIGN KEY (session_id) REFERENCES game_sessions (session_id),
    CONSTRAINT fk_turn_user    FOREIGN KEY (user_id)    REFERENCES users (user_id),
    CONSTRAINT fk_turn_team    FOREIGN KEY (team_id)    REFERENCES teams (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
