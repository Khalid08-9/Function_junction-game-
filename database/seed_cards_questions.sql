-- Function Junction: starter cards and Python questions
-- Run ONCE, after you have a lecturer account (role = 'lecturer').
-- Run with:  mariadb -u YOUR_DB_USER -p function_junction < server/sql/seed_cards_questions.sql
-- Card effects are a DRAFT based on your storyboards. Edit them to match your real rules.

USE function_junction;

-- All or nothing: if anything fails (for example no lecturer exists),
-- nothing is saved and you can safely run the file again.
START TRANSACTION;

INSERT INTO cards (card_name, difficulty, card_effect, power_level, qr_token, full_action, basic_action) VALUES
  ('Jack', 'Low', 'Swap places with another marble', 'Strong', 'FJ-JACK-4X9K2M', 'Swap one of your marbles with another marble on the board', 'Basic move: 1 step'),
  ('King', 'Medium', 'Move 13 steps and plough through every marble in the path', 'Strong', 'FJ-KING-7Q3W8D', 'Move 13 steps and plough through every marble in the path', 'Basic move: 1 step'),
  ('Ace', 'High', 'Start a marble, or move 1 or 11', 'Strong', 'FJ-ACE-2M6R5T', 'Start a marble from home, or move 1 or 11 steps', 'Basic move: 1 step'),
  ('Joker', 'Advanced', 'Wild card with a special power', 'Strong', 'FJ-JOKER-9B4N7C', 'Use the Joker''s special power (agree the exact rule with your lecturer)', 'Basic move: 1 step');

-- ===== Jack =====
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'Jack'),
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
  (SELECT card_id FROM cards WHERE card_name = 'Jack'),
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
  (SELECT card_id FROM cards WHERE card_name = 'Jack'),
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

-- ===== King =====
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'King'),
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
  (SELECT card_id FROM cards WHERE card_name = 'King'),
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
  (SELECT card_id FROM cards WHERE card_name = 'King'),
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

-- ===== Ace =====
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'Ace'),
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
  (SELECT card_id FROM cards WHERE card_name = 'Ace'),
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
  (SELECT card_id FROM cards WHERE card_name = 'Ace'),
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

-- ===== Joker =====
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
  (SELECT card_id FROM cards WHERE card_name = 'Joker'),
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
  (SELECT card_id FROM cards WHERE card_name = 'Joker'),
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
  (SELECT card_id FROM cards WHERE card_name = 'Joker'),
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
