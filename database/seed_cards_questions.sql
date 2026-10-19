-- Function Junction: starter cards and Python questions
-- Run ONCE, after you have a lecturer account (role = 'lecturer').
-- Run with:  mariadb -u YOUR_DB_USER -p function_junction < database/seed_cards_questions.sql

USE function_junction;

START TRANSACTION;

-- Ensure move_spaces column exists
SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'function_junction'
      AND TABLE_NAME = 'cards'
      AND COLUMN_NAME = 'move_spaces'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE cards ADD COLUMN move_spaces INT NULL AFTER basic_action',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Insert or update cards to match Jackaroo game rules
INSERT INTO cards (card_name, difficulty, card_effect, power_level, qr_token, full_action, basic_action, move_spaces) VALUES
  ('Ace', 'High', 'Place a piece or move 1 or 11', 'Strong', 'FJ-ACE-2M6R5T', 'Place a piece on the board or move a piece one or 11 spaces.', 'Basic move: advance 1 space', 11),
  ('King', 'Medium', 'Place a piece or move 13, capturing on the way', 'Strong', 'FJ-KING-7Q3W8D', 'Place a piece on the board or move one of your pieces 13 spaces forward, capturing any piece on the way unless it is on its base.', 'Basic move: advance 1 space', 13),
  ('Jack', 'Low', 'Swap with another player''s piece', 'Strong', 'FJ-JACK-4X9K2M', 'Swap any of your pieces with another player''s piece, provided neither of the pieces is on the base or in the safety zone.', 'Basic move: advance 1 space', NULL),
  ('10', 'Medium', 'Move 10 forward or force discard', 'Strong', 'FJ-TEN-3K8P1Q', 'Move one of your pieces 10 spaces forward, or force the player on your left to discard one of their cards.', 'Basic move: advance 1 space', 10),
  ('7', 'High', 'Split between two of your pieces only', 'Strong', 'FJ-SEVEN-5R2N4X', 'You can split the card between two of your pieces only.', 'Basic move: advance 1 space', 7),
  ('5', 'Low', 'Move any piece 5 spaces', 'Strong', 'FJ-FIVE-8W6T3M', 'Move any piece five spaces, unless the piece is on its base.', 'Basic move: advance 1 space', 5),
  ('4', 'Low', 'Move 4 spaces backward', 'Strong', 'FJ-FOUR-1D9K7P', 'Move one of your pieces 4 spaces backward.', 'Basic move: advance 1 space', -4),
  ('Joker', 'Advanced', 'Wild card with a special power', 'Strong', 'FJ-JOKER-9B4N7C', 'Use the Joker''s special power.', 'Basic move: advance 1 space', NULL)
ON DUPLICATE KEY UPDATE
  card_effect = VALUES(card_effect),
  full_action = VALUES(full_action),
  basic_action = VALUES(basic_action),
  move_spaces = VALUES(move_spaces),
  difficulty = VALUES(difficulty);

-- ===== Jack Questions =====
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'Jack' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Function syntax',
  'Which keyword is used to define a function in Python?',
  'A function starts with the keyword def.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', 'function', 0),
  (@q, 'B', 'def', 1),
  (@q, 'C', 'func', 0),
  (@q, 'D', 'define', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'Jack' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Calling a function',
  'What does this code print?\n\ndef greet():\n    print("Hi")\n\ngreet()',
  'greet() calls the function, so the print inside it runs.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', 'greet', 0),
  (@q, 'B', 'Nothing', 0),
  (@q, 'C', 'Error', 0),
  (@q, 'D', 'Hi', 1);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'Jack' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Naming conventions',
  'Which is a valid function name in Python?',
  'Names can use letters, digits and underscores, but cannot start with a digit or contain a dash.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', 'total_price', 1),
  (@q, 'B', '2total', 0),
  (@q, 'C', 'my-func', 0),
  (@q, 'D', 'def', 0);

-- ===== King Questions =====
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'King' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Return statements',
  'What does this function return?\n\ndef double(x):\n    return x * 2\n\nprint(double(4))',
  'double(4) returns 4 * 2, which is 8.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '6', 0),
  (@q, 'B', '44', 0),
  (@q, 'C', '8', 1),
  (@q, 'D', 'Error', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'King' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Multiple outputs',
  'What does this code print?\n\ndef min_max(a, b):\n    return min(a, b), max(a, b)\n\nprint(min_max(3, 7))',
  'Returning two values gives a tuple: (3, 7).'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '3', 0),
  (@q, 'B', '(3, 7)', 1),
  (@q, 'C', '7', 0),
  (@q, 'D', 'Error', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'King' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Variable scope',
  'What does this code print?\n\nx = 5\n\ndef change():\n    x = 10\n\nchange()\nprint(x)',
  'The x inside change() is a local variable. The global x stays 5.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '10', 0),
  (@q, 'B', 'None', 0),
  (@q, 'C', 'Error', 0),
  (@q, 'D', '5', 1);

-- ===== Ace Questions =====
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'Ace' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Default parameters',
  'What does this code print?\n\ndef power(base, exp=2):\n    return base ** exp\n\nprint(power(3))',
  'exp is not given, so it uses the default 2. 3 ** 2 is 9.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '9', 1),
  (@q, 'B', '6', 0),
  (@q, 'C', '3', 0),
  (@q, 'D', 'Error', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'Ace' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Keyword arguments',
  'What does this code print?\n\ndef info(name, age):\n    return name + " is " + str(age)\n\nprint(info(age=20, name="Sam"))',
  'Keyword arguments can be given in any order.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '20 is Sam', 0),
  (@q, 'B', 'Sam is 20', 1),
  (@q, 'C', 'Error', 0),
  (@q, 'D', 'None', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'Ace' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Positional and keyword arguments',
  'What does this code print?\n\ndef f(a, b=2, c=3):\n    return a + b + c\n\nprint(f(1, c=10))',
  'a=1, b uses its default 2, c=10. The sum is 13.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '6', 0),
  (@q, 'B', '15', 0),
  (@q, 'C', 'Error', 0),
  (@q, 'D', '13', 1);

-- ===== 10 Questions =====
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '10' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'List comprehension',
  'What does this code print?\n\nnums = [x * 2 for x in range(3)]\nprint(nums)',
  'range(3) yields 0, 1, 2. Multiplying by 2 produces [0, 2, 4].'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '[2, 4, 6]', 0),
  (@q, 'B', '[0, 2, 4]', 1),
  (@q, 'C', '[0, 1, 2]', 0),
  (@q, 'D', '[0, 2]', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '10' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'String methods',
  'What does this code return?\n\n"apple,banana,cherry".split(",")[1]',
  'split(",") creates a list of 3 strings; index 1 is "banana".'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', 'apple', 0),
  (@q, 'B', 'banana', 1),
  (@q, 'C', 'cherry', 0),
  (@q, 'D', 'Error', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '10' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Dictionary get',
  'What does this code print?\n\nd = {"a": 1}\nprint(d.get("b", 0))',
  'dict.get(key, default) returns default 0 when key "b" is not present.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', 'KeyError', 0),
  (@q, 'B', 'None', 0),
  (@q, 'C', '0', 1),
  (@q, 'D', '1', 0);

-- ===== 7 Questions =====
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '7' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Generators',
  'What keyword is used to make a function a generator?',
  'The yield keyword pauses execution and turns a function into a generator.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', 'return', 0),
  (@q, 'B', 'generator', 0),
  (@q, 'C', 'yield', 1),
  (@q, 'D', 'next', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '7' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Lambda expressions',
  'What is the output of this code?\n\nf = lambda x, y: x ** y\nprint(f(2, 3))',
  '2 ** 3 evaluates to 8.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '6', 0),
  (@q, 'B', '8', 1),
  (@q, 'C', '9', 0),
  (@q, 'D', '5', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '7' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Map and filter',
  'What does list(filter(lambda x: x % 2 == 0, [1, 2, 3, 4])) return?',
  'filter retains only even numbers, yielding [2, 4].'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '[1, 3]', 0),
  (@q, 'B', '[2, 4]', 1),
  (@q, 'C', '[True, False, True, False]', 0),
  (@q, 'D', '[1, 2, 3, 4]', 0);

-- ===== 5 Questions =====
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '5' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'For loops',
  'How many times does this loop run?\n\nfor i in range(5):\n    print(i)',
  'range(5) counts 0, 1, 2, 3, 4 which is exactly 5 iterations.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '4', 0),
  (@q, 'B', '5', 1),
  (@q, 'C', '6', 0),
  (@q, 'D', 'Infinite', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '5' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'List length',
  'What function returns the number of items in a list?',
  'len() returns the length of collections in Python.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', 'size()', 0),
  (@q, 'B', 'count()', 0),
  (@q, 'C', 'len()', 1),
  (@q, 'D', 'length()', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '5' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Basic operators',
  'What does 17 // 5 evaluate to in Python?',
  '// is integer (floor) division, 17 // 5 is 3.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '3.4', 0),
  (@q, 'B', '3', 1),
  (@q, 'C', '2', 0),
  (@q, 'D', '4', 0);

-- ===== 4 Questions =====
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '4' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Conditionals',
  'What is the output of this code?\n\nx = 10\nif x > 5:\n    print("Big")\nelse:\n    print("Small")',
  'Since 10 > 5 is True, "Big" is printed.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', 'Small', 0),
  (@q, 'B', 'Big', 1),
  (@q, 'C', 'Error', 0),
  (@q, 'D', 'None', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '4' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Negative indexing',
  'What does lst[-1] retrieve from a non-empty list lst?',
  'Negative index -1 accesses the last element of the list.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', 'The first item', 0),
  (@q, 'B', 'The last item', 1),
  (@q, 'C', 'None', 0),
  (@q, 'D', 'IndexError', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = '4' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  'Boolean operators',
  'What does (True and not False) evaluate to?',
  'not False is True, and True and True is True.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', 'False', 0),
  (@q, 'B', 'True', 1),
  (@q, 'C', 'None', 0),
  (@q, 'D', 'Error', 0);

-- ===== Joker Questions =====
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'Joker' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  '*args',
  'What does this code print?\n\ndef total(*args):\n    return sum(args)\n\nprint(total(1, 2, 3))',
  '*args collects all positional arguments, so sum(1, 2, 3) is 6.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '(1, 2, 3)', 0),
  (@q, 'B', '3', 0),
  (@q, 'C', 'Error', 0),
  (@q, 'D', '6', 1);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'Joker' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  '**kwargs',
  'What does this code print?\n\ndef show(**kwargs):\n    return len(kwargs)\n\nprint(show(a=1, b=2))',
  '**kwargs collects the keyword arguments, and there are 2 of them.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', '1', 0),
  (@q, 'B', '3', 0),
  (@q, 'C', '2', 1),
  (@q, 'D', 'Error', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'Joker' LIMIT 1),
  (SELECT user_id FROM users WHERE role = 'lecturer' ORDER BY user_id LIMIT 1),
  '*args type',
  'Inside a function defined with *args, what type is args?',
  '*args is stored as a tuple.'
);
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
  (@q, 'A', 'list', 0),
  (@q, 'B', 'tuple', 1),
  (@q, 'C', 'dict', 0),
  (@q, 'D', 'set', 0);

COMMIT;
