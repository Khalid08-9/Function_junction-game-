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
new timer migration once (it is also safe to re-run):

```sh
mariadb -u YOUR_DB_USER -p < database/add_turn_timer.sql
```

Restart the server after applying the migration. Every active turn gets 60
seconds in total, including card selection, QR scanning, answering and moving.
The server advances expired turns even when no browser is connected. Normal
moves and manual handoffs start a new 60-second clock for the next player.

Card selection is saved in the existing game-state metadata, so the single-use
card fix needs no additional database migration. Selecting a card removes that
specific suit from the five-card hand immediately. Each turn allows one answer
and one marble action (or discard); reloading lets you continue the selected
card rather than selecting another one. A fresh five-card hand is dealt after
five rounds, following the existing dealing rules.
