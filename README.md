# Function Junction — run locally and review the database

Function Junction is a Python-learning game with a digital board, automatic
marking, team scores, 60-second turns and a lecturer dashboard. A lecturer can
choose digital cards or real cards scanned with the camera **inside the game
website**. Questions and their four options are editable in the lecturer UI;
they are read from the database at runtime, not hard-coded into the quiz.

## 1. Requirements

- Node.js **22 LTS or newer**, including npm.
- MariaDB **10.11 or newer**, running locally (or an equivalent compatible MySQL setup).
- A modern browser. A webcam is needed only for physical-card mode.
- Optional: **DBeaver Community** (works with MariaDB), HeidiSQL or phpMyAdmin
  to inspect tables. A database viewer is not required to run the game.

Use a copy of the whole project, not only the HTML/Markdown files. Do not copy
another computer's `node_modules` directory: install dependencies locally.

## 2. Install the application

Open a terminal in the project root (the folder containing `package.json`):

```sh
npm ci
```

Linux/macOS: `cp .env.example .env`

Windows PowerShell: `Copy-Item .env.example .env`

If `.env` already exists, edit it instead of overwriting it. The example contains
placeholders only; it does not include anyone's private credentials.

Edit the new `.env` with the database credentials created below. Choose your own
`SESSION_SECRET` and `LECTURER_INVITE_CODE`. Do not use or share the author's
machine-specific `.env`. A database login is **different from** a game website
login: `DB_USER`/`DB_PASSWORD` are MariaDB credentials, not a student's email/password.

### Windows setup (PowerShell)

1. Install Node.js **22 LTS or newer** and MariaDB **10.11 or newer** using their
   Windows installers. In the MariaDB installer, install it as a Windows service,
   enable TCP networking (normally port **3306**), and choose a root password.
   Keep that password private; it is used to create the app's database user.
2. Open **Services** (`Win + R`, then `services.msc`). Find your MariaDB service
   (its name depends on the installer), start it, and set its startup type to
   **Automatic** if you want it to start with Windows.
3. Open PowerShell in the project folder and run:

   ```powershell
   node --version
   npm.cmd --version
   npm.cmd ci
   Copy-Item .env.example .env
   notepad .env
   ```

   Copy the example only if you do not already have `.env`. Using `npm.cmd`
   avoids PowerShell's possible `npm.ps1` execution-policy error without
   changing your system security settings.
4. In `.env`, use `DB_HOST=127.0.0.1`, `DB_PORT=3306`,
   `DB_NAME=function_junction`, and `DB_USER=junction_app`. Choose `DB_PASSWORD`
   and use the **same password** in the `CREATE USER` command in section 3.
   Replace `SESSION_SECRET` and `LECTURER_INVITE_CODE` with your own private
   values. Leave `DB_SOCKET` commented out; a Linux socket path will not work
   on Windows. Generate a session secret with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. From the project folder, open the SQL client:

   ```powershell
   mariadb -u root -p
   ```

   If `mariadb` is not recognised, use the installed executable's full path
   (adjust the version/path to match your installation):

   ```powershell
   & "C:\Program Files\MariaDB 11.4\bin\mariadb.exe" -u root -p
   ```

   The `&` is required to run a quoted executable path in PowerShell. Enter the
   root password when prompted, then run the SQL commands in section 3 below.
   Run `SOURCE` **inside the MariaDB prompt**, not in PowerShell. If the relative
   file paths cannot be found, use forward-slash absolute paths such as
   `SOURCE C:/projects/function-junction/database/schema.sql;` (use a project
   path without spaces, or import with a database GUI).
6. After importing the database and creating its user, exit the SQL client and run:

   ```powershell
   npm.cmd start
   ```

   Open **http://localhost:3000**, then follow section 4 to create your lecturer
   account. Stop the server with `Ctrl + C` before restarting after `.env` edits.

Each laptop needs its own running MariaDB server and database setup. Copying the
project does **not** copy database records or MariaDB users. To move existing
questions, accounts and game history, use the private backup/restore instructions
in section 7 instead of importing the fresh starter database.

## 3. Fresh database: import exactly two files

The `database/` folder intentionally contains only:

| File | Purpose |
| --- | --- |
| `schema.sql` | Current definitions of all 12 tables, keys and constraints; no application records |
| `seed.sql` | Shareable starter library: 14 card definitions (13 active), 30 questions, 120 options and one non-login library attribution account |

Start MariaDB using the service manager or database application on your laptop.
On Fedora: `sudo systemctl enable --now mariadb`. On Debian/Ubuntu:
`sudo systemctl enable --now mariadb`. On Windows, start the installed MariaDB
service in Services. On macOS with Homebrew: `brew services start mariadb`.

In the project root, open the MariaDB client as an administrator:

```sh
mariadb -u root -p
```

If Linux root uses socket authentication, use `sudo mariadb` instead. If the
client is installed as `mysql`, use `mysql` in place of `mariadb`. In the SQL
prompt, run (forward slashes also work on Windows):

```sql
SOURCE database/schema.sql;
SOURCE database/seed.sql;

CREATE USER IF NOT EXISTS 'junction_app'@'localhost'
  IDENTIFIED BY 'choose-a-local-database-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON function_junction.*
  TO 'junction_app'@'localhost';
EXIT;
```

Replace the example password, and put the same password in `.env` as
`DB_PASSWORD`. If that database user already exists, set its password explicitly
with `ALTER USER 'junction_app'@'localhost' IDENTIFIED BY 'your-password';`.
If using a database GUI, open and execute **schema.sql first**, then **seed.sql**.
`SOURCE` is a MariaDB/mysql terminal command, not SQL to paste into DBeaver;
use DBeaver's Execute SQL Script feature for those files instead.

> Import these files only into a **fresh database**. Do not import them over a
> database containing existing work. Do not run `seed.sql` twice. Do not import
> the seed after restoring a full backup. No old `add_*.sql` files are needed.

## 4. Start and sign in

```sh
npm start
```

Open **http://localhost:3000** on this laptop. A successful terminal startup
shows “Database connected successfully”. Health check: `/health`.

1. Open `/register-lecturer` and create a **new lecturer account**, using the
   invite code you put in your local `.env`.
2. Sign in at `/login`. Open **Manage card questions** to review the bank.
3. Student accounts are created at `/register`. A normal game has four students
   in two teams. Use separate browser profiles or private windows for distinct
   logins when demonstrating on one laptop.
4. Create a session, choose digital/physical cards, share its six-character code,
   let students join teams and start the game.
5. Open the lecturer dashboard to review attempts, team scores and analytics.

The seeded “Starter Question Library” user is attribution only and **cannot
sign in**. There is no shared default lecturer password. A backup stores password
hashes, not recoverable plaintext passwords; create a new local lecturer if you
do not know the original account password.

During development, `npm run dev` restarts Node when server files change.

## 5. Lecturer question editor (dynamic quizzes)

Go to **Lecturer home → Manage card questions**, or `/lecturer/questions`.

- Select a card, enter a topic and question, provide **exactly four options**
  A–D, mark **one** correct answer and optionally add an explanation.
- Click **Save question**. It immediately joins the bank used by both card modes.
- Filter by card, click **Edit**, change text/options/correct answer and save.
- An edit creates a new revision and archives the old one. Historical attempts,
  option text and correctness are never overwritten. Already-open turns finish
  their saved question; future selections use the updated active bank.
- **Archive** removes a question from future selections without deleting history.
  Enable “Show archived” to view earlier versions or activate one again.
- **Delete** permanently removes a question and its four options after confirmation.
  Questions with recorded answers or an open turn cannot be deleted; archive them instead.
- The bank is shared by authenticated lecturers, including the starter library.
  Students cannot open its management page/API or read correctness flags there.

These questions are stored in MariaDB so changes survive a server restart.
`seed.sql` is only initial content; **do not edit SQL files to change the live quiz**.

## 6. See the actual table data on the lecturer's laptop

### Using DBeaver / HeidiSQL / phpMyAdmin

Create a **MariaDB** connection with the same local host, port, database username
and password used in `.env` (normally `127.0.0.1`, `3306`, `junction_app`, and
`function_junction`). Test the connection, then expand the database → Tables.
Right-click `users`, `questions`, `question_options`, `attempts`, etc., and choose
View Data / Read Data. The user's original machine is not contacted.

### Using the SQL terminal

```sh
mariadb -h 127.0.0.1 -P 3306 -u junction_app -p function_junction
```

```sql
SHOW TABLES;
DESCRIBE users;
SELECT user_id, full_name, email, role, created_at FROM users;
SELECT card_id, card_name, difficulty, is_active FROM cards;
SELECT question_id, card_id, topic, question_text, is_active FROM questions;
SELECT question_id, option_label, option_text, is_correct
  FROM question_options ORDER BY question_id, option_label;
SELECT * FROM game_sessions;
SELECT * FROM attempts ORDER BY attempt_id DESC LIMIT 20;
SELECT * FROM score_event ORDER BY score_event_id DESC LIMIT 20;
SELECT * FROM game_pieces LIMIT 20;
```

The normal seed contains no real students or game history. Registering users
and playing creates those rows. To inspect the **author's actual current data**,
restore the separately supplied full backup instead of importing the starter seed.

## 7. Full backup of the current data

On the original configured installation:

```sh
npm run db:backup
```

This reads the configured database in a consistent snapshot and writes:

- `backups/function-junction-<timestamp>.sql`: **full table definitions and rows**,
  including users, card/question/options, game sessions, turns, positions,
  attempts and score events;
- a matching `.sql.json` manifest containing row counts for verification.

Do not change the database structure while an export is running.

Backups are private local files, excluded from Git, created with restrictive
permissions where supported. They contain names, emails and password hashes.
**Do not publish them, attach them to a public report or expose them through the
web server.** The backup does not contain `.env`, database-user passwords,
MariaDB server accounts or browser login sessions.

For an authorised lecturer review, send the SQL backup privately alongside the
project. A Git clone does **not** include the ignored `backups/` directory, so
the lecturer must receive the actual `.sql` file separately.

### Restore a full backup safely into a separate review database

On the lecturer's laptop, open MariaDB as administrator. Create a **new empty**
database and select it before importing the backup:

```sql
CREATE DATABASE function_junction_review
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE function_junction_review;
SOURCE /absolute/path/to/function-junction-TIMESTAMP.sql;
GRANT SELECT, INSERT, UPDATE, DELETE ON function_junction_review.*
  TO 'junction_app'@'localhost';
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM questions;
```

Use a private folder path without spaces when using `SOURCE`, or import via a
database GUI. The backup deliberately contains no `USE` or `DROP TABLE`
statements, so it cannot silently select or replace another existing database.
Do **not** load `schema.sql` or `seed.sql` into this full-backup database.
Compare table counts against the supplied `.sql.json` manifest **before starting
the game server**. Restored active sessions may advance their timers/turns after
Node starts; that is normal and can change game-history counts. Set
`DB_NAME=function_junction_review` in the lecturer's `.env`, then restart the app.
If the database user has not yet been created, create it as in section 3 first.

### Existing databases created with an older version

Back up first. Run `npm run db:upgrade` with an administrator who has ALTER/CREATE
permission. Optional local `DB_ADMIN_USER` and `DB_ADMIN_PASSWORD` environment
variables let the upgrade use administrator credentials without changing the
normal app user. Keep those values private and remove them afterwards. The
upgrade adds missing tables/columns/turn constraints without deleting records;
it does not import starter data. It is safe to re-run. This replaces the former
individual migration SQL files. Restart the server after the upgrade.

## 8. Physical-card labels and camera

The existing print sheet is `docs/physical-card-qr-codes.html`; the Markdown guide
and 13 SVG files are beside it. The codes identify ranks only, not suits or an
IP address. Print multiple copies of a rank for the matching real cards.
`npm run generate:physical-qr` regenerates the labels from the local card tokens.

Click **Scan card** in the game website to use this device's camera. Questions
appear on this same screen. Camera access requires HTTPS or **localhost**;
ordinary HTTP LAN addresses are blocked by browsers. Allow camera permission.
No separate phone pairing is needed. Digital-card mode needs no camera.

## 9. Tests and troubleshooting

```sh
npm test
```

Tests that write database fixtures are opt-in and must use a **disposable** test
MariaDB instance, never the lecturer's live/review data. See
`server/test/turnTimer.integration.test.js` for its `TEST_DB_SOCKET` setup. Import
both `schema.sql` and `seed.sql` there before integration testing.

| Problem | Check |
| --- | --- |
| `ECONNREFUSED` / cannot connect | Start MariaDB; check host/port. Node uses TCP by default, not another laptop's Linux socket. |
| `ER_ACCESS_DENIED_ERROR` | Check the local database user/password and grants; do not use website login credentials. |
| `ER_BAD_DB_ERROR` | Import the database, then set the matching `DB_NAME`. |
| Missing tables / empty quiz | Fresh install needs **schema.sql then seed.sql**; restore needs the full SQL backup only. |
| Unknown `round_turn_id` / timer column | Back up and run the administrator upgrade for an older database. |
| Lecturer registration disabled | Set a private `LECTURER_INVITE_CODE` in `.env` and restart Node. |
| `SOURCE` cannot find a file | Run the SQL client from the project root or use the file's full path; a GUI can import it instead. |
| Windows: `mariadb` is not recognised | Use the full path to `mariadb.exe` shown in the Windows setup, or add its `bin` folder to PATH and reopen PowerShell. |
| Windows: `npm.ps1` cannot be loaded | Use `npm.cmd ci` / `npm.cmd start` instead; no execution-policy change is needed. |
| Port 3000 in use | Stop the other server or change `PORT` and open the matching localhost address. |
| Camera unavailable | Use localhost/HTTPS, allow permission and close other webcam apps; try digital mode. |

Do not commit `.env` or private backups. The application uses an in-memory login
session store for local demonstrations; restarting the server logs browsers out.
