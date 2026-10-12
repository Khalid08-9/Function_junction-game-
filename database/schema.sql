CREATE DATABASE IF NOT EXISTS function_junction
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE function_junction;

-- 1. Students and lecturers
CREATE TABLE users (
    user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'lecturer') NOT NULL DEFAULT 'student',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Jackaroo card definitions
CREATE TABLE cards (
    card_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    card_name VARCHAR(30) NOT NULL,
    difficulty VARCHAR(30),
    card_effect VARCHAR(255) NOT NULL,
    power_level VARCHAR(30),
    qr_token VARCHAR(100) UNIQUE,
    full_action TEXT NOT NULL,
    basic_action TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3. Python questions
CREATE TABLE questions (
    question_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    card_id INT UNSIGNED NOT NULL,
    created_by INT UNSIGNED NOT NULL,
    topic VARCHAR(100) NOT NULL,
    question_text TEXT NOT NULL,
    explanation TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_question_card
        FOREIGN KEY (card_id)
        REFERENCES cards(card_id),

    CONSTRAINT fk_question_creator
        FOREIGN KEY (created_by)
        REFERENCES users(user_id)
);

-- 4. Answer choices
CREATE TABLE question_options (
    option_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    question_id INT UNSIGNED NOT NULL,
    option_label CHAR(1) NOT NULL,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT uq_question_option_label
        UNIQUE (question_id, option_label),

    -- Supports checking that a selected option belongs to its question.
    CONSTRAINT uq_question_option
        UNIQUE (question_id, option_id),

    CONSTRAINT fk_option_question
        FOREIGN KEY (question_id)
        REFERENCES questions(question_id)
);

-- 5. Individual matches
CREATE TABLE game_sessions (
    session_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lecturer_id INT UNSIGNED NOT NULL,
    session_code VARCHAR(12) NOT NULL UNIQUE,
    status ENUM('waiting', 'active', 'finished')
        NOT NULL DEFAULT 'waiting',
    started_at DATETIME,
    ended_at DATETIME,

    CONSTRAINT fk_session_lecturer
        FOREIGN KEY (lecturer_id)
        REFERENCES users(user_id)
);

-- 6. Teams within a match
CREATE TABLE teams (
    team_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id INT UNSIGNED NOT NULL,
    team_name VARCHAR(100) NOT NULL,
    team_colour VARCHAR(30) NOT NULL,
    current_score INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_session_team_name
        UNIQUE (session_id, team_name),

    CONSTRAINT uq_session_team
        UNIQUE (session_id, team_id),

    CONSTRAINT fk_team_session
        FOREIGN KEY (session_id)
        REFERENCES game_sessions(session_id)
);

-- 7. Players assigned to teams
CREATE TABLE team_members (
    team_member_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    team_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    seat_number TINYINT UNSIGNED NOT NULL,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_team_member
        UNIQUE (team_id, user_id),

    CONSTRAINT uq_team_seat
        UNIQUE (team_id, seat_number),

    CONSTRAINT fk_member_team
        FOREIGN KEY (team_id)
        REFERENCES teams(team_id),

    CONSTRAINT fk_member_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
);

-- 8. Submitted answers
CREATE TABLE attempts (
    attempt_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id INT UNSIGNED NOT NULL,
    team_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    question_id INT UNSIGNED NOT NULL,
    selected_option_id INT UNSIGNED NOT NULL,
    is_correct BOOLEAN NOT NULL,
    response_seconds INT UNSIGNED NOT NULL,
    answered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_session_team_attempt
        UNIQUE (session_id, team_id, attempt_id),

    -- Ensures the team belongs to this session.
    CONSTRAINT fk_attempt_session_team
        FOREIGN KEY (session_id, team_id)
        REFERENCES teams(session_id, team_id),

    -- Ensures the answering player belongs to this team.
    CONSTRAINT fk_attempt_team_member
        FOREIGN KEY (team_id, user_id)
        REFERENCES team_members(team_id, user_id),

    -- Ensures the selected option belongs to this question.
    CONSTRAINT fk_attempt_question_option
        FOREIGN KEY (question_id, selected_option_id)
        REFERENCES question_options(question_id, option_id)
);

-- 9. Score change history
CREATE TABLE score_event (
    score_event_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id INT UNSIGNED NOT NULL,
    team_id INT UNSIGNED NOT NULL,
    attempt_id INT UNSIGNED,
    points_change INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_score_session_team
        FOREIGN KEY (session_id, team_id)
        REFERENCES teams(session_id, team_id),

    -- An optional linked attempt must belong to the same session/team.
    CONSTRAINT fk_score_attempt
        FOREIGN KEY (session_id, team_id, attempt_id)
        REFERENCES attempts(session_id, team_id, attempt_id)
);

-- 10. Current match state
CREATE TABLE game_state (
    state_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id INT UNSIGNED NOT NULL UNIQUE,
    current_team_id INT UNSIGNED,
    turn_number INT UNSIGNED NOT NULL DEFAULT 1,
    last_action TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_state_session
        FOREIGN KEY (session_id)
        REFERENCES game_sessions(session_id),

    CONSTRAINT fk_state_current_team
        FOREIGN KEY (session_id, current_team_id)
        REFERENCES teams(session_id, team_id)
);