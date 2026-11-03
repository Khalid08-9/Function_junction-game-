
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
|F9|Scan a physical card|Student|Uses the game website camera to read a rank-only QR token; no typed code or mobile pairing is required|
|F10|Question and timer|Student|Shows the question and four options with a 30-second countdown|
|F11|Mark and score|System|Checks the answer on the server, saves the attempt and adds points|
|F12|Result screen|Student|Shows correct or wrong, the explanation, the card move and the team score|
|F13|Live scores|All|Team scores and the turn order update every 3 seconds|
|F14|Card QR print guide|Lecturer|Provides 13 rank-only QR labels in the documentation, ready to print|
|F15|Lecturer dashboard|Lecturer|Number of students, answers, accuracy, leading team, hardest question, top performer and recent activity|
|F16|Sounds|Student|Sound effects with an on and off button|

---

# 6. Implementation

## 6.1 Architecture and API integration

Function Junction uses a browser client, a Node.js/Express server and a MariaDB database. Browser JavaScript sends JSON requests to Express routes. Controllers validate the request, services run parameterised SQL queries, and the response updates the Pug web interface without a full page reload.

**Figure 6.1 – System architecture**  
> Insert a diagram showing: Browser → Express routes/controllers/services → MariaDB.

### Source-code screenshots for API integration

| Screenshot | File and exact lines | What to explain in the report |
|---|---|---|
| API client helper | `client/public/js/common.js`, lines **3–21** | The Fetch API sends JSON, uses same-origin session credentials and returns `{ ok, status, data }`. |
| Server setup | `server/src/server.js`, lines **8–51** | Express configuration, JSON parsing, static files, sessions and route registration. |
| Game API routes | `server/src/routes/gameRoutes.js`, lines **1–39** | REST endpoints and route protection using `requireLogin` and `requireRole`. |
| Card API flow | `server/src/controllers/cardController.js`, lines **5–43** | The server validates the current player before digital card selection or physical QR scanning. |

**Suggested caption:** “REST API integration between the browser client, Express routes and protected game controllers.”

Use this API table:

| Method | Endpoint | Purpose | User / protection |
|---|---|---|---|
| `POST` | `/api/sessions` | Creates a session and saves the selected card mode | Lecturer |
| `POST` | `/api/sessions/:sessionId/join` | Joins a team in a waiting session | Student |
| `POST` | `/api/game/sessions/:sessionId/cards/select` | Selects a digital card | Current student player |
| `POST` | `/api/game/sessions/:sessionId/cards/scan` | Accepts a rank-only QR token scanned by the website camera | Current student player, physical mode |
| `POST` | `/api/game/answers` | Marks and saves a desktop answer | Current student player |
| `GET` | `/api/game/sessions/:sessionId/turn` | Reads the current player, order and remaining time | Session member or owner lecturer |
| `POST` | `/api/game/sessions/:sessionId/pieces/move` | Moves, enters, swaps or discards a marble | Current student player |
| `GET` | `/api/game/sessions/:sessionId/summary` | Reads lecturer analytics | Owner lecturer |

## 6.2 Database management and CRUD operations

The project uses `mysql2/promise`, a connection pool and SQL placeholders (`?`). SQL placeholders prevent user input being joined directly into SQL statements.

**Code screenshot:** `server/src/config/database.js`, lines **1–23**.  
**Caption:** “MariaDB connection-pool configuration using mysql2/promise.”

### Create (C)

A lecturer creates a game session. The server inserts the session, creates Team 1 and Team 2, stores the digital/physical card mode and commits the transaction.

**Code screenshot:** `server/src/controllers/sessionController.js`, lines **41–80**.  
**Caption:** “Create operation: session, teams and card mode are saved in one transaction.”

Answer submission creates an `attempts` record. A correct answer additionally creates a `score_event` record and updates the score of the team.

**Code screenshot:** `server/src/controllers/gameController.js`, lines **183–209**.  
**Caption:** “Create operations for answer attempts and score-event history, plus score update.”

### Read (R)

The dashboard reads team scores, answers, accuracy, hardest questions, recent activity and top performers.

**Code screenshot:** `server/src/services/dashboardService.js`, lines **17–75**.  
**Caption:** “Read operations used to generate lecturer dashboard statistics.”

### Update (U)

The system updates marble positions, team scores, selected-card state, game state and player turns. Before updating, it checks the active player, selected card, answer result and legal movement.

**Code screenshot:** `server/src/controllers/pieceController.js`, lines **108–145**.  
**Caption:** “Update operation: validate the move, update digital marbles, check the winner and advance the turn.”

**Code screenshot:** `server/src/services/cardService.js`, lines **205–223**.  
**Caption:** “Update operation: save selected-card metadata safely in game state.”

### Delete (D)

There is deliberately no public delete feature for attempts, scores or completed games. These records are assessment evidence for lecturers and deleting them would make dashboard statistics inaccurate. Instead, the system uses controlled updates: a used card is removed/recorded, a marble position changes, and a session status changes from `waiting` to `active` to `finished`. A future lecturer-only administration feature could use soft deletion and an audit log.

## 6.3 Transactions, validation and data integrity

Answer submission starts a database transaction, locks the membership/game row, verifies the active player, checks the selected option, saves the answer and score, then commits. If a problem occurs, the transaction rolls back. This prevents partial saves and duplicate scoring.

**Code screenshot:** `server/src/controllers/gameController.js`, lines **66–128** and **238–250**.  
**Caption:** “Transaction, row locking, turn ownership validation and rollback during answer submission.”

Each answer is associated with `round_turn_id`. The one-answer-per-turn constraint allows the same question to be repeated and scored in a later turn, but prevents two submissions in one turn.

**Database screenshot:** `database/schema.sql`, lines **131–164**. See `scripts/upgrade-database.js` for upgrading an existing database without deleting its data.
**Caption:** “Attempts linked to round turns: repeated questions are allowed later, but duplicate submissions in the same turn are blocked.”

## 6.4 Digital cards and physical QR-card feature

The lecturer chooses the card mode when creating a session. Digital mode shows a five-card hand and opens questions directly. Physical mode uses real cards with 13 rank-only printable QR labels. The player presses **Scan card** inside the game website, allows this device’s camera and scans a label. The question appears on the same screen. The QR token contains no URL, IP address, suit, session or turn number.

| Screenshot | File and exact lines | What to explain |
|---|---|---|
| Card-mode creation | `server/src/controllers/sessionController.js`, lines **41–79** | The lecturer chooses `digital` or `physical`; invalid values are rejected. |
| Browser camera scanner | `client/public/js/card-scanner.js`, lines **1–61** | Local camera scanning, QR-token validation and permission/error messages. |
| Camera game flow | `client/public/js/game.js`, lines **220–285** | Opening/stopping the scanner and submitting the scanned token to the server. |
| Physical-card validation | `server/src/services/cardService.js`, lines **227–283** | Rank-only token lookup, current-turn check and a saved question for the turn. |
| Printable labels | `docs/physical-card-qr-codes.md`, lines **1–46** | Shows the 13 rank-only labels, their tokens and printing/game instructions. |

> Insert UI screenshots in this order:  
> 1. Lecturer selects **Physical cards** when creating a session.  
> 2. Physical-mode game screen with **Scan card** button.  
> 3. Website camera panel scanning a printed rank QR label.  
> 4. Question displayed on the same game screen.  
> 5. Correct/wrong result and digital marble movement.  
> 6. `docs/physical-card-qr-codes.html` print sheet with the 13 labels.

## 6.5 Turn timer, turn order and game rules

The server stores when each turn starts. A background timer checks active sessions and advances an expired turn after 60 seconds. Server-side timing cannot be bypassed by refreshing the browser.

**Code screenshot:** `server/src/services/turnTimerService.js`, lines **1–43**.  
**Caption:** “Background service that detects and advances expired 60-second turns.”

**Code screenshot:** `server/src/services/turnService.js`, lines **92–169**.  
**Caption:** “Turn advancement, new-round creation and reset of the next player’s clock.”

**Code screenshot:** `server/src/controllers/turnController.js`, lines **77–98** and **133–188**.  
**Caption:** “Turn-state API and protected manual turn handoff.”

> Insert a game UI screenshot showing current player, round, turn number and the `01:00` countdown. Add a second screenshot after a timeout if possible.

## 6.6 Authentication and security

Security features implemented are password hashing with bcrypt, `httpOnly` session cookies, student/lecturer role checks, session ownership checks, turn ownership checks, parameterised SQL, server-side answer marking and rejection of arbitrary QR content.

**Code screenshot:** `server/src/controllers/authController.js`, lines **70–141** and **146–230**.  
**Caption:** “Secure registration and login using bcrypt hashing and regenerated sessions.”

**Code screenshot:** `server/src/routes/gameRoutes.js`, lines **11–39**.  
**Caption:** “Protected student and lecturer API routes.”

**Code screenshot:** `server/src/controllers/gameController.js`, lines **158–185**.  
**Caption:** “Server-side option validation and correct-answer calculation.”

## 6.7 Testing

Automated tests cover virtual-card removal, one answer per turn, repeated-rank scoring on a later turn, 60-second timeouts, concurrent requests, camera cancellation, invalid QR content and rank-only QR generation.

**Screenshot:** terminal output after running `npm test`.  
**Caption:** “Automated test results for Function Junction.”

Add this manual testing table:

| Test | Expected result | Evidence screenshot |
|---|---|---|
| Digital card selected | Card disappears from the five-card hand; question opens | Before/after card hand |
| Physical QR scan | Website camera opens; question appears on same screen | Scanner and question |
| Wrong answer | No points; one-space basic move only | Result screen |
| Correct answer | Points and full card power | Result and board |
| Timer expires | Server passes to next player | Two turn banners |
| Repeated rank later | Same rank can be scanned and score again on another turn | Two results |

---

# 7. User Guidance

## 7.1 Lecturer

1. Sign in as a lecturer.
2. Create a session and choose **Digital cards** or **Physical cards**.
3. Share the six-character session code with students.
4. Start the game when students have joined teams.
5. In physical mode, print `docs/physical-card-qr-codes.html`, attach rank labels to real cards, shuffle and deal five cards per player.
6. Monitor scores, answers, accuracy and difficult questions on the dashboard.
7. Finish the session when the game ends.

> Insert UI screenshots: lecturer create-session screen, waiting room, QR print sheet and dashboard.

## 7.2 Student

1. Sign in, enter the session code and choose a team.
2. Wait for the lecturer to start the game.
3. When it is your turn, use one card.
4. In digital mode, select a displayed card.
5. In physical mode, click **Scan card**, allow camera permission and hold the rank QR label in front of the camera.
6. Answer before the 60-second turn expires.
7. Select a highlighted marble to move, or discard where appropriate.

> Insert UI screenshots: student join form, team choice, game board/current turn, digital cards, scanner, question, result and marble movement.

## 7.3 Camera troubleshooting

- Camera access requires `https://` or `http://localhost:3000`; ordinary HTTP network addresses are blocked by browsers.
- Allow camera permission when the browser asks.
- Close other applications using the webcam.
- Print clear black-and-white labels with a white border.
- Use **Start / retry camera** if scanning does not begin.

---

# 8. Conclusions and Future Work

Function Junction provides an active way to practise Python functions through team play. The completed system includes accounts, session codes, team joining, digital marble movement, automatic marking, scoring, server-enforced 60-second turns, lecturer analytics, digital cards and physical cards with website-camera QR scanning.

The main limitation is that rank-only physical QR labels do not prove which player owns a specific real card. The lecturer supervises the real card deal. Browser camera access also requires HTTPS or localhost.

Future work could add:

- Lecturer pages to create, edit and deactivate questions.
- WebSockets for instant updates instead of three-second polling.
- Permanent HTTPS deployment for classroom devices.
- Lecturer-only archived-session deletion/anonymisation with an audit log.
- More Python topics, accessibility settings and language options.
- A complete game-replay page using turns, attempts, score events and marble positions.
