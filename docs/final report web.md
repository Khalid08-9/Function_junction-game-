
1. Introduction / Plan

1.1 Background 

Python functions are one of the first topics that beginner programming students find difficult. Students often read about `def`, `return`, default parameters and `*args`, but they do not get enough practice. Traditional exercises can also feel repetitive and do not always encourage teamwork or active learning.

Function Junction is an educational phygital game. “Phygital” means that a physical activity and a digital application work together. The digital part is a web application that displays the Jackaroo-style board, moves the marbles, asks Python function questions, checks answers, keeps team scores and controls the 60-second turns. The physical part can be a real deck of playing cards. Players may also choose digital cards, so the game can be played in either physical-card mode or digital-card mode.

1.2 Concept 

Two teams of two students play the game. The lecturer chooses one card mode when creating a session:

- **Digital-card mode:** the player selects one of the five cards shown in the web application. The Python question opens directly on the same screen.

- **Physical-card mode:** students are dealt real cards. Each rank has a printable, rank-only QR label: Ace, 2–10, Jack, Queen and King. The player clicks **Scan card** in the game website, allows the camera, and holds the QR label in front of the camera. The question then appears on the same screen. The QR codes do not contain an IP address, a website link, a session number, a turn number or a suit.

The same rank label can be used for any suit and can be scanned again on a later turn. The lecturer supervises the real card deal because a rank-only QR code cannot identify an individual physical card.

- A correct answer unlocks the full power of the card and gives points to the team.

- An incorrect answer or a time-out gives only the basic move. No points are lost.

- A player can answer only once in a turn. The server records the answer, card result and move securely. If the same question is shown again on a later turn, it can be answered and scored again for that later turn.

In physical-card mode, the real card choice and the digital result depend on each other: the player scans the real card to open the question, and the web application decides the movement power, score and turn result. In digital-card mode, the same learning and game rules work without printed cards or QR scanning.

1.3 Problem statement 

Students need a more active way to practise Python functions in class. Lecturers also need a simple way to see how well students understand the topic during a lesson. The planned system therefore combines teamwork, card-based game decisions, automatic Python-question marking, digital marble movement, live scores and lecturer reporting in one web application.

2. Objectives 

3. Help students learn and practise Python functions while they play a game with their teammates. 
    

4. Combine a real board and real cards with a web application, so that each part depends on the other. 
    

5. Let a lecturer create and run game sessions, and follow the progress of the class. 
    

6. Mark answers and calculate scores automatically on the server, so the result is fair and cannot be changed by the player. 
    

7. Save every attempt, score and game state in a database, so the lecturer can review them later. 
    

8. Provide a web interface that works on both phones and computers. 
    

9. Scope 

3.1 In scope 

- User accounts for two roles: student and lecturer. Lecturers sign up with a secret invite code. 
    

- Game sessions with a unique 6-character session code. Each session has two teams, Team 1 and Team 2, and each team has two players. 
    

- Students join a session and choose Team 1 or Team 2. 
    

- A random player order for each round. A round ends when every player has played. 
    

- Four strong cards, each with a QR code and a different difficulty level (see section 5). 
    

- QR scanning with the phone or computer camera, or typing the card code. 
    

- Python multiple-choice questions with a 30-second timer. 
    

- Automatic marking and scoring by difficulty, and live team scores. 
    

- A page for lecturers that creates the QR codes to print for the cards. 
    

- Sounds for correct, wrong, turn change and time warnings. 
    

- A lecturer dashboard with class results. 
    

3.2 Out of scope 

- Tracking the marble positions digitally. Players move the marbles by hand on the physical board. 
    

- Automatic checking of the Jackaroo move rules. 
    

- A native mobile app. The web app runs in the browser. 
    

- True real-time sockets. The pages ask the server for updates every 3 seconds. 
    

- A web page for lecturers to write new questions. Questions are loaded into the database with SQL. 
    

3.3 Assumptions and limits 

- A game has four players: two teams of two players, and partners sit opposite each other. 
    

- Players and lecturer use the same network or internet connection as the server. 
    

- Browsers only allow the camera on https pages or on localhost. Players can type the card code if the camera is not available. 
    

4. Specifications 

4.1 Physical components 

|           |                                                                                      |
| --------- | ------------------------------------------------------------------------------------ |
| Component | Description                                                                          |
| Board     | A real Jackaroo-style board with four marble bases and finish lanes                  |
| Marbles   | 16 marbles, 4 for each player                                                        |
| Cards     | A normal deck of cards. The strong cards (Jack, King, Ace, Joker) carry a QR sticker |

4.2 Digital components 

|   |   |
|---|---|
|Area|Technology|
|Server|Node.js, Express.js|
|Database|MariaDB, accessed with mysql2/promise|
|Login and security|express-session, bcrypt password hashing, role checks|
|Pages|Pug templates, plain CSS, plain browser JavaScript (no framework)|
|QR codes|qrcode (makes the codes), jsQR (reads the codes in the browser)|
|Development|Fedora Linux, VS Code, Postman|

4.3 Database 

The database has eleven tables: users, cards, questions, question_options, game_sessions, teams, team_members, attempts, score_event, game_state and round_turns. 

4.4 Quality requirements 

- Security: passwords are hashed, the login cookie is httpOnly, every request is checked for login and role, all database queries use placeholders, and the correct answer is never sent to the browser before the student answers. 
    

- Reliability: joining a team, saving an answer with its score, and changing the turn each run as one database transaction, so a failure leaves no half-saved data. 
    

- Usability: the pages are designed for phones first and also fit computers. 
    

- Performance: every screen updates by itself within 3 seconds. 
    

5. Functions 

The four strong cards ask questions about Python functions: 

|   |   |   |   |
|---|---|---|---|
|Card|Difficulty|Topic|Points|
|Jack|Low|Basic function syntax, def, naming and simple calls|5|
|King|Medium|return, multiple outputs, local and global scope|10|
|Ace|High|Default values, positional and keyword arguments|15|
|Joker|Advanced|*args and **kwargs|20|

5.1 How a game is played 

1. The lecturer creates a session. The system makes a session code and the two teams. 
    

2. Students log in, enter the code and choose their team. The waiting room shows who has joined. 
    

3. The lecturer starts the game. The system picks a random player order for the first round. 
    

4. The player whose turn it is plays a card on the real board. For a strong card, any player of that team scans its QR code. 
    

5. The player answers the Python question before the timer ends. 
    

6. The server checks the answer. A correct answer gives the full card power and the points. A wrong answer or a time-out gives the basic move and no points are lost. 
    

7. The player ends the turn. When everyone has played, a new round starts with a new random order. 
    

8. The lecturer finishes the game when the marbles are home. The screens show the winning team. 
    

5.2 System functions 

|   |   |   |   |
|---|---|---|---|
|No.|Function|User|Description|
|F1|Register, log in, log out|Student, lecturer|Account access with hashed passwords and a session cookie|
|F2|Lecturer sign-up|Lecturer|Needs the secret invite code|
|F3|Create a session|Lecturer|Makes a unique 6-character code and Team 1 and Team 2|
|F4|Join a session|Student|Enter the code and choose a team; a full team is refused|
|F5|Waiting room|All|Shows teams and players, and updates by itself|
|F6|Start and finish a session|Lecturer|Changes the session status and saves the start and end time|
|F7|Random turn order|System|Shuffles all players each round and tracks the current turn|
|F8|End turn|Current player, lecturer|Moves to the next player or starts a new round|
|F9|Scan a card|Student|Reads the QR code with the camera, or accepts a typed code|
|F10|Question and timer|Student|Shows the question and four options with a 30-second countdown|
|F11|Mark and score|System|Checks the answer on the server, saves the attempt and adds points|
|F12|Result screen|Student|Shows correct or wrong, the explanation, the card move and the team score|
|F13|Live scores|All|Team scores and the turn order update every 3 seconds|
|F14|Card QR page|Lecturer|Makes the QR codes of all cards, ready to print|
|F15|Lecturer dashboard|Lecturer|Number of students, answers, accuracy, leading team, hardest question, top performer and recent activity|
|F16|Sounds|Student|Sound effects with an on and off button|
