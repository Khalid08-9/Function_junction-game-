USE function_junction;

-- 1. Deactivate Joker (standard 52-card deck has no jokers)
UPDATE cards SET is_active = 0 WHERE card_name = 'Joker';

-- 2. Update King according to official rules (King ONLY moves Home to Base)
UPDATE cards 
SET card_effect = 'Move any playing piece from Home to Base',
    full_action = 'Move one of your playing pieces from Home to Base.',
    move_spaces = 0,
    power_level = 'Special'
WHERE card_name = 'King';

-- 3. Update Ace according to official rules (Home to Base or 1 or 11 forward)
UPDATE cards 
SET card_effect = 'Move piece from Home to Base, or advance 1 or 11',
    full_action = 'Move one of your playing pieces from Home to Base, or move a piece on the track 1 or 11 spaces forward.',
    move_spaces = 11,
    power_level = 'Special'
WHERE card_name = 'Ace';

-- 4. Update Jack
UPDATE cards 
SET card_effect = 'Swap with another player''s piece on track',
    full_action = 'Swap any of your pieces on the track with an opponent piece on the track (neither can be on Base, in Home, or in Safe zone).',
    power_level = 'Special'
WHERE card_name = 'Jack';

-- 5. Update 7 (Can split between two pieces)
UPDATE cards 
SET card_effect = 'Move 7 spaces forward (can split between 2 pieces)',
    full_action = 'Move one piece 7 spaces, or divide the 7 spaces between two of your pieces.',
    power_level = 'Special'
WHERE card_name = '7';

-- 6. Update 4 (Backward 4)
UPDATE cards 
SET card_effect = 'Move 4 spaces backward',
    full_action = 'Move one of your pieces 4 spaces backward.',
    power_level = 'Special'
WHERE card_name = '4';

-- 7. Insert missing standard cards (2, 3, 6, 8, 9, Queen)
INSERT INTO cards (card_name, difficulty, card_effect, power_level, qr_token, full_action, basic_action, move_spaces, is_active)
VALUES
  ('2', 'Low', 'Move 2 spaces forward', 'Standard', 'FJ-TWO-7K3R9M', 'Move one of your pieces 2 spaces forward.', 'Basic move: advance 1 space', 2, 1),
  ('3', 'Low', 'Move 3 spaces forward', 'Standard', 'FJ-THREE-4P8M2L', 'Move one of your pieces 3 spaces forward.', 'Basic move: advance 1 space', 3, 1),
  ('6', 'Medium', 'Move 6 spaces forward', 'Standard', 'FJ-SIX-9D2L6W', 'Move one of your pieces 6 spaces forward.', 'Basic move: advance 1 space', 6, 1),
  ('8', 'Medium', 'Move 8 spaces forward', 'Standard', 'FJ-EIGHT-5W1K8P', 'Move one of your pieces 8 spaces forward.', 'Basic move: advance 1 space', 8, 1),
  ('9', 'High', 'Move 9 spaces forward', 'Standard', 'FJ-NINE-3M7T4R', 'Move one of your pieces 9 spaces forward.', 'Basic move: advance 1 space', 9, 1),
  ('Queen', 'High', 'Move 12 spaces forward', 'Standard', 'FJ-QUEEN-6L2R9X', 'Move one of your pieces 12 spaces forward.', 'Basic move: advance 1 space', 12, 1)
ON DUPLICATE KEY UPDATE
  difficulty = VALUES(difficulty),
  card_effect = VALUES(card_effect),
  power_level = VALUES(power_level),
  full_action = VALUES(full_action),
  basic_action = VALUES(basic_action),
  move_spaces = VALUES(move_spaces),
  is_active = 1;

-- Add questions for the newly added cards:
-- 2 Questions
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '2' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Basic types',
  'What is the type of the value 2 in Python?',
  'Whole numbers like 2 have the type int.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', 'str', 0),
  (@q, 'B', 'int', 1),
  (@q, 'C', 'float', 0),
  (@q, 'D', 'bool', 0);

-- 3 Questions
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '3' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'String repetition',
  'What does "ha" * 3 evaluate to in Python?',
  'Multiplying a string by an integer repeats it that many times.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', 'hahaha', 1),
  (@q, 'B', 'ha3', 0),
  (@q, 'C', 'TypeError', 0),
  (@q, 'D', 'ha ha ha', 0);

-- 6 Questions
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '6' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Integer division',
  'What does 18 // 3 evaluate to in Python?',
  'Integer floor division 18 // 3 gives 6.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '6.0', 0),
  (@q, 'B', '6', 1),
  (@q, 'C', '0', 0),
  (@q, 'D', '3', 0);

-- 8 Questions
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '8' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Power operator',
  'What does 2 ** 3 evaluate to in Python?',
  '2 raised to the power 3 is 2 * 2 * 2 = 8.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '6', 0),
  (@q, 'B', '8', 1),
  (@q, 'C', '5', 0),
  (@q, 'D', '9', 0);

-- 9 Questions
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '9' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Range function',
  'What is len(list(range(1, 10))) in Python?',
  'range(1, 10) produces numbers 1 through 9, so its length is 9.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '10', 0),
  (@q, 'B', '9', 1),
  (@q, 'C', '8', 0),
  (@q, 'D', '1', 0);

-- Queen Questions
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'Queen' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'List slicing',
  'What is len("Hello, World!")?',
  'The string "Hello, World!" has 13 characters, but "Hello, World" without the exclamation has 12.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '12', 0),
  (@q, 'B', '13', 1),
  (@q, 'C', '11', 0),
  (@q, 'D', '10', 0);

