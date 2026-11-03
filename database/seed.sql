-- Shareable starter data only: no real student accounts or game history.
-- Import once after schema.sql into a fresh database. Register your own lecturer account.
USE function_junction;

START TRANSACTION;


INSERT INTO users (full_name, email, password_hash, role)
VALUES ('Starter Question Library', 'starter-library@function-junction.invalid', '!', 'lecturer');
SET @seed_lecturer = LAST_INSERT_ID();

-- All card definitions, including the inactive Joker, with current Jackaroo rules.
INSERT INTO cards (card_name, difficulty, card_effect, power_level, qr_token, full_action, basic_action, move_spaces, is_active) VALUES
('Ace', 'High', 'Move piece from Home to Base, or advance 1 or 11', 'Special', 'FJ-ACE-2M6R5T', 'Move one of your playing pieces from Home to Base, or move a piece on the track 1 or 11 spaces forward.', 'Basic move: advance 1 space', 11, 1),
('King', 'Medium', 'Move any playing piece from Home to Base', 'Special', 'FJ-KING-7Q3W8D', 'Move one of your playing pieces from Home to Base.', 'Basic move: advance 1 space', 0, 1),
('Jack', 'Low', 'Swap with another player''s piece on track', 'Special', 'FJ-JACK-4X9K2M', 'Swap any of your pieces on the track with an opponent piece on the track (neither can be on Base, in Home, or in Safe zone).', 'Basic move: advance 1 space', NULL, 1),
('10', 'Medium', 'Move 10 forward or force discard', 'Strong', 'FJ-TEN-3K8P1Q', 'Move one of your pieces 10 spaces forward, or force the player on your left to discard one of their cards.', 'Basic move: advance 1 space', 10, 1),
('7', 'High', 'Move 7 spaces forward (can split between 2 pieces)', 'Special', 'FJ-SEVEN-5R2N4X', 'Move one piece 7 spaces, or divide the 7 spaces between two of your pieces.', 'Basic move: advance 1 space', 7, 1),
('5', 'Low', 'Move any piece 5 spaces', 'Strong', 'FJ-FIVE-8W6T3M', 'Move any piece five spaces, unless the piece is on its base.', 'Basic move: advance 1 space', 5, 1),
('4', 'Low', 'Move 4 spaces backward', 'Special', 'FJ-FOUR-1D9K7P', 'Move one of your pieces 4 spaces backward.', 'Basic move: advance 1 space', -4, 1),
('Joker', 'Advanced', 'Wild card with a special power', 'Strong', 'FJ-JOKER-9B4N7C', 'Use the Joker''s special power.', 'Basic move: advance 1 space', NULL, 0),
('2', 'Low', 'Move 2 spaces forward', 'Standard', 'FJ-TWO-7K3R9M', 'Move one of your pieces 2 spaces forward.', 'Basic move: advance 1 space', 2, 1),
('3', 'Low', 'Move 3 spaces forward', 'Standard', 'FJ-THREE-4P8M2L', 'Move one of your pieces 3 spaces forward.', 'Basic move: advance 1 space', 3, 1),
('6', 'Medium', 'Move 6 spaces forward', 'Standard', 'FJ-SIX-9D2L6W', 'Move one of your pieces 6 spaces forward.', 'Basic move: advance 1 space', 6, 1),
('8', 'Medium', 'Move 8 spaces forward', 'Standard', 'FJ-EIGHT-5W1K8P', 'Move one of your pieces 8 spaces forward.', 'Basic move: advance 1 space', 8, 1),
('9', 'High', 'Move 9 spaces forward', 'Standard', 'FJ-NINE-3M7T4R', 'Move one of your pieces 9 spaces forward.', 'Basic move: advance 1 space', 9, 1),
('Queen', 'High', 'Move 12 spaces forward', 'Standard', 'FJ-QUEEN-6L2R9X', 'Move one of your pieces 12 spaces forward.', 'Basic move: advance 1 space', 12, 1);

-- Starter Python question library. Lecturers manage the live bank through the website.
INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = 'Jack'), @seed_lecturer,
 'Function syntax', 'Which keyword is used to define a function in Python?', 'A function starts with the keyword def.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', 'function', 0), (@q, 'B', 'def', 1), (@q, 'C', 'func', 0), (@q, 'D', 'define', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = 'Jack'), @seed_lecturer,
 'Calling a function', 'What does this code print?\n\ndef greet():\n    print("Hi")\n\ngreet()', 'greet() calls the function, so the print inside it runs.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', 'greet', 0), (@q, 'B', 'Nothing', 0), (@q, 'C', 'Error', 0), (@q, 'D', 'Hi', 1);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = 'Jack'), @seed_lecturer,
 'Naming conventions', 'Which is a valid function name in Python?', 'Names can use letters, digits and underscores, but cannot start with a digit or contain a dash.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', 'total_price', 1), (@q, 'B', '2total', 0), (@q, 'C', 'my-func', 0), (@q, 'D', 'def', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = 'King'), @seed_lecturer,
 'Return statements', 'What does this function return?\n\ndef double(x):\n    return x * 2\n\nprint(double(4))', 'double(4) returns 4 * 2, which is 8.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '6', 0), (@q, 'B', '44', 0), (@q, 'C', '8', 1), (@q, 'D', 'Error', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = 'King'), @seed_lecturer,
 'Multiple outputs', 'What does this code print?\n\ndef min_max(a, b):\n    return min(a, b), max(a, b)\n\nprint(min_max(3, 7))', 'Returning two values gives a tuple: (3, 7).');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '3', 0), (@q, 'B', '(3, 7)', 1), (@q, 'C', '7', 0), (@q, 'D', 'Error', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = 'King'), @seed_lecturer,
 'Variable scope', 'What does this code print?\n\nx = 5\n\ndef change():\n    x = 10\n\nchange()\nprint(x)', 'The x inside change() is a local variable. The global x stays 5.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '10', 0), (@q, 'B', 'None', 0), (@q, 'C', 'Error', 0), (@q, 'D', '5', 1);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = 'Ace'), @seed_lecturer,
 'Default parameters', 'What does this code print?\n\ndef power(base, exp=2):\n    return base ** exp\n\nprint(power(3))', 'exp is not given, so it uses the default 2. 3 ** 2 is 9.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '9', 1), (@q, 'B', '6', 0), (@q, 'C', '3', 0), (@q, 'D', 'Error', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = 'Ace'), @seed_lecturer,
 'Keyword arguments', 'What does this code print?\n\ndef info(name, age):\n    return name + " is " + str(age)\n\nprint(info(age=20, name="Sam"))', 'Keyword arguments can be given in any order.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '20 is Sam', 0), (@q, 'B', 'Sam is 20', 1), (@q, 'C', 'Error', 0), (@q, 'D', 'None', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = 'Ace'), @seed_lecturer,
 'Positional and keyword arguments', 'What does this code print?\n\ndef f(a, b=2, c=3):\n    return a + b + c\n\nprint(f(1, c=10))', 'a=1, b uses its default 2, c=10. The sum is 13.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '6', 0), (@q, 'B', '15', 0), (@q, 'C', 'Error', 0), (@q, 'D', '13', 1);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '10'), @seed_lecturer,
 'List comprehension', 'What does this code print?\n\nnums = [x * 2 for x in range(3)]\nprint(nums)', 'range(3) yields 0, 1, 2. Multiplying by 2 produces [0, 2, 4].');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '[2, 4, 6]', 0), (@q, 'B', '[0, 2, 4]', 1), (@q, 'C', '[0, 1, 2]', 0), (@q, 'D', '[0, 2]', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '10'), @seed_lecturer,
 'String methods', 'What does this code return?\n\n"apple,banana,cherry".split(",")[1]', 'split(",") creates a list of 3 strings; index 1 is "banana".');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', 'apple', 0), (@q, 'B', 'banana', 1), (@q, 'C', 'cherry', 0), (@q, 'D', 'Error', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '10'), @seed_lecturer,
 'Dictionary get', 'What does this code print?\n\nd = {"a": 1}\nprint(d.get("b", 0))', 'dict.get(key, default) returns default 0 when key "b" is not present.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', 'KeyError', 0), (@q, 'B', 'None', 0), (@q, 'C', '0', 1), (@q, 'D', '1', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '7'), @seed_lecturer,
 'Generators', 'What keyword is used to make a function a generator?', 'The yield keyword pauses execution and turns a function into a generator.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', 'return', 0), (@q, 'B', 'generator', 0), (@q, 'C', 'yield', 1), (@q, 'D', 'next', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '7'), @seed_lecturer,
 'Lambda expressions', 'What is the output of this code?\n\nf = lambda x, y: x ** y\nprint(f(2, 3))', '2 ** 3 evaluates to 8.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '6', 0), (@q, 'B', '8', 1), (@q, 'C', '9', 0), (@q, 'D', '5', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '7'), @seed_lecturer,
 'Map and filter', 'What does list(filter(lambda x: x % 2 == 0, [1, 2, 3, 4])) return?', 'filter retains only even numbers, yielding [2, 4].');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '[1, 3]', 0), (@q, 'B', '[2, 4]', 1), (@q, 'C', '[True, False, True, False]', 0), (@q, 'D', '[1, 2, 3, 4]', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '5'), @seed_lecturer,
 'For loops', 'How many times does this loop run?\n\nfor i in range(5):\n    print(i)', 'range(5) counts 0, 1, 2, 3, 4 which is exactly 5 iterations.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '4', 0), (@q, 'B', '5', 1), (@q, 'C', '6', 0), (@q, 'D', 'Infinite', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '5'), @seed_lecturer,
 'List length', 'What function returns the number of items in a list?', 'len() returns the length of collections in Python.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', 'size()', 0), (@q, 'B', 'count()', 0), (@q, 'C', 'len()', 1), (@q, 'D', 'length()', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '5'), @seed_lecturer,
 'Basic operators', 'What does 17 // 5 evaluate to in Python?', '// is integer (floor) division, 17 // 5 is 3.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '3.4', 0), (@q, 'B', '3', 1), (@q, 'C', '2', 0), (@q, 'D', '4', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '4'), @seed_lecturer,
 'Conditionals', 'What is the output of this code?\n\nx = 10\nif x > 5:\n    print("Big")\nelse:\n    print("Small")', 'Since 10 > 5 is True, "Big" is printed.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', 'Small', 0), (@q, 'B', 'Big', 1), (@q, 'C', 'Error', 0), (@q, 'D', 'None', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '4'), @seed_lecturer,
 'Negative indexing', 'What does lst[-1] retrieve from a non-empty list lst?', 'Negative index -1 accesses the last element of the list.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', 'The first item', 0), (@q, 'B', 'The last item', 1), (@q, 'C', 'None', 0), (@q, 'D', 'IndexError', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '4'), @seed_lecturer,
 'Boolean operators', 'What does (True and not False) evaluate to?', 'not False is True, and True and True is True.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', 'False', 0), (@q, 'B', 'True', 1), (@q, 'C', 'None', 0), (@q, 'D', 'Error', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = 'Joker'), @seed_lecturer,
 '*args', 'What does this code print?\n\ndef total(*args):\n    return sum(args)\n\nprint(total(1, 2, 3))', '*args collects all positional arguments, so sum(1, 2, 3) is 6.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '(1, 2, 3)', 0), (@q, 'B', '3', 0), (@q, 'C', 'Error', 0), (@q, 'D', '6', 1);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = 'Joker'), @seed_lecturer,
 '**kwargs', 'What does this code print?\n\ndef show(**kwargs):\n    return len(kwargs)\n\nprint(show(a=1, b=2))', '**kwargs collects the keyword arguments, and there are 2 of them.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '1', 0), (@q, 'B', '3', 0), (@q, 'C', '2', 1), (@q, 'D', 'Error', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = 'Joker'), @seed_lecturer,
 '*args type', 'Inside a function defined with *args, what type is args?', '*args is stored as a tuple.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', 'list', 0), (@q, 'B', 'tuple', 1), (@q, 'C', 'dict', 0), (@q, 'D', 'set', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '2'), @seed_lecturer,
 'Basic types', 'What is the type of the value 2 in Python?', 'Whole numbers like 2 have the type int.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', 'str', 0), (@q, 'B', 'int', 1), (@q, 'C', 'float', 0), (@q, 'D', 'bool', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '3'), @seed_lecturer,
 'String repetition', 'What does "ha" * 3 evaluate to in Python?', 'Multiplying a string by an integer repeats it that many times.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', 'hahaha', 1), (@q, 'B', 'ha3', 0), (@q, 'C', 'TypeError', 0), (@q, 'D', 'ha ha ha', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '6'), @seed_lecturer,
 'Integer division', 'What does 18 // 3 evaluate to in Python?', 'Integer floor division 18 // 3 gives 6.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '6.0', 0), (@q, 'B', '6', 1), (@q, 'C', '0', 0), (@q, 'D', '3', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '8'), @seed_lecturer,
 'Power operator', 'What does 2 ** 3 evaluate to in Python?', '2 raised to the power 3 is 2 * 2 * 2 = 8.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '6', 0), (@q, 'B', '8', 1), (@q, 'C', '5', 0), (@q, 'D', '9', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = '9'), @seed_lecturer,
 'Range function', 'What is len(list(range(1, 10))) in Python?', 'range(1, 10) produces numbers 1 through 9, so its length is 9.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '10', 0), (@q, 'B', '9', 1), (@q, 'C', '8', 0), (@q, 'D', '1', 0);

INSERT INTO questions (card_id, created_by, topic, question_text, explanation) VALUES (
 (SELECT card_id FROM cards WHERE card_name = 'Queen'), @seed_lecturer,
 'List slicing', 'What is len("Hello, World!")?', 'The string "Hello, World!" has 13 characters, but "Hello, World" without the exclamation has 12.');
SET @q = LAST_INSERT_ID();
INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES
 (@q, 'A', '12', 0), (@q, 'B', '13', 1), (@q, 'C', '11', 0), (@q, 'D', '10', 0);

COMMIT;
