# Database setup

## Fresh installation

```sh
mariadb -u YOUR_DB_USER -p < database/schema.sql
```

`schema.sql` contains all 12 tables, turn timing, the attempt uniqueness constraint,
14 card definitions (13 active and the inactive Joker), 30 Python questions and
120 answer options. Do not run the older seed files again after importing it.

The starter questions belong to a non-login library account. Register your own
lecturer account through the application; there is no default login password.
Matches, teams, players and marble positions are created during normal play.

## Existing installation

Do not re-import the fresh-install schema over an existing database. Apply the
migrations as needed (both are safe to re-run):

```sh
mariadb -u YOUR_DB_USER -p < database/add_turn_timer.sql
mariadb -u YOUR_DB_USER -p < database/add_per_turn_attempts.sql
```

`add_per_turn_attempts.sql` preserves historical answers and replaces the old
one-answer-per-team/question constraint with one answer per round turn. This
allows a repeated question to earn points again on a later turn while preventing
duplicate scoring within a turn. Apply it with a database administrator account
before restarting the updated server. Do not reapply the obsolete
`add_unique_team_question_attempt.sql` migration afterwards.

Restart the server after applying the migrations. Every active turn gets 60
seconds in total, including card selection, QR scanning, answering and moving.
The server advances expired turns even when no browser is connected. Normal
moves and manual handoffs start a new 60-second clock for the next player.

Card selection is saved in the existing game-state metadata, so the single-use
card fix needs no additional database migration. Selecting a card removes that
specific suit from the five-card hand immediately. Each turn allows one answer
and one marble action (or discard); reloading lets you continue the selected
card rather than selecting another one. A fresh five-card hand is dealt after
five rounds, following the existing dealing rules.

## Digital and physical card modes

The lecturer chooses the mode when creating a session. It is stored as
`card_mode` in `game_state.last_action` metadata and retained when the game
starts and turns advance. Older sessions default to digital mode. No additional
schema migration is needed for mode selection.

- **Digital:** five virtual cards; selecting one opens its question directly.
- **Physical:** real cards are dealt manually. Click **Scan card** inside the game
  website to open this device's camera. Scanning a rank-only label opens the
  question on that same screen. There is no mobile pairing or external QR link.
  Each successful scan uses one card for that turn; repeated ranks are allowed on
  later turns, including within the same deal. Real dealing is supervised by the
  lecturer because a rank-only QR cannot identify an individual physical card.

Run `npm run generate:physical-qr` to produce
`docs/physical-card-qr-codes.md`, an HTML print sheet and **13 SVG labels** from the
database's active ranks. Filenames are `ace.svg`, `2.svg` … `10.svg`, `jack.svg`,
`queen.svg`, `king.svg`. The QR payloads contain only card tokens, with no URL,
IP address or suit; print extra copies of each rank as needed. The generator
removes only the obsolete suit-specific SVG filenames from its own output folder.
Keep the `qr-codes/` folder alongside the Markdown when copying the files.

Camera permission requires a secure browser context: use **HTTPS** or open
`http://localhost:3000` on the computer running the server. A plain HTTP LAN IP
will be blocked by browsers. Allow camera permission and close other apps using
the webcam. The QR decoder is served locally from the installed `html5-qrcode`
package, without a CDN connection. Closing the scanner, changing turns, leaving
the page or finishing the game releases the camera.
