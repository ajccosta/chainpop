# Bot simulation: board size vs. players vs. game length

Simulated games using the real engine (`src/engine.js`) to see how board size and number of players affect game length and early eliminations. No real games were logged, so this is **bot data, not human data**. Treat it as a starting point for tuning `autoSize`, and replace it with real data once the host logs finished games.

Settings in all runs: pops at 4, no clock, no random starts, no per-move bonus.

## Method

Two bots drove every seat, calling `newGame()`, `canPlay()` and `play()` from the engine:

- **Random bot:** picks a uniformly random legal move. 720 games (20 per setting), boards 5×5 to 15×15, 2 to 8 players, capped at 4,000 moves.
- **Greedy bot:** tries every legal move with `play()` and picks the one that maximizes (own cells + dots) minus the opponents' average (cells + dots), with a small random tiebreak. For an opening move it also prefers squares far from existing blobs. 348 games (12 per setting), boards 5×5 to 10×10, 2/3/4/6/8 players, capped at 1,500 moves. 5×5 with 8 players was skipped (too few squares).

"Moves" are total moves by all players. Real time is roughly moves × thinking time plus animation time.

## Results: random bot

Mean moves per game (rows: board size, columns: players). Games that hit the 4,000-move cap are counted at 4,000, so the large-board cells are **underestimates** (218 of 720 games did not finish, mostly 11×11 and larger).

| Board | 2 | 3 | 4 | 5 | 6 | 8 |
|---|---|---|---|---|---|---|
| 5×5 | 104 | 121 | 133 | 146 | 168 | 131 |
| 7×7 | 279 | 440 | 473 | 397 | 466 | 483 |
| 9×9 | 773 | 1487 | 1245 | 1413 | 1285 | 1636 |
| 11×11 | 2362 | 2374 | 2718 | 2470 | 2663 | 2676 |
| 13×13 | 3136 | 3036 | 3603 | 3418 | 3614 | 3494 |
| 15×15 | 3474 | 3990 | 3807 | 3829 | 3879 | 3743 |

Correlations with game length:

| Pair | Pearson | Spearman |
|---|---|---|
| moves ~ board size | 0.86 | 0.88 |
| moves ~ number of squares | 0.85 | 0.88 |
| moves ~ players | 0.06 | 0.07 |
| size ~ players (design is crossed) | 0.00 | 0.00 |

- Board size strongly drives game length; player count barely affects total moves.
- Moves *per player* fall as players are added: about 844 (2 players), 636 (3), 499 (4), 389 (5), 335 (6), 253 (8).
- Chain-reaction waves per move grow with board size (5×5: 0.94, 7×7: 1.42, 9×9: 1.98, 11×11: 2.50, 13×13: 2.94, 15×15: 3.35), so animation time per move grows as well.
- Note: in the app, `autoSize` ties board size to player count, so more players means a bigger board and longer games indirectly.

## Results: greedy bot

Median moves per game (rows: board size, columns: players):

| Board | 2 | 3 | 4 | 6 | 8 |
|---|---|---|---|---|---|
| 5×5 | 84 | 112 | 111 | 93 | – |
| 6×6 | 129 | 156 | 183 | 285 | 143 |
| 7×7 | 179 | 316 | 260 | 380 | 434 |
| 8×8 | 284 | 493 | 609 | 640 | 628 |
| 9×9 | 391 | 884 | 763 | 1014 | 1315 |
| 10×10 | 541 | 1500 | 1459 | 1472 | 1500 |

Median round of the first elimination (move number ÷ players), for 3+ players. With 2 players the first elimination ends the game, so it is left out.

| Board | 3 | 4 | 6 | 8 |
|---|---|---|---|---|
| 5×5 | 16.3 | 11.5 | 6.1 | – |
| 6×6 | 39.3 | 18.8 | 9.8 | 4.1 |
| 7×7 | 63.2 | 33.2 | 13.7 | 8.2 |
| 8×8 | 114.0 | 38.8 | 18.3 | 14.4 |
| 9×9 | 143.3 | 53.1 | 27.0 | 16.3 |
| 10×10 | 224.3 | 65.9 | 36.3 | 20.2 |

Games where some player was knocked out after making 3 moves or fewer ("early elimination"):

| Board | 2 | 3 | 4 | 6 | 8 |
|---|---|---|---|---|---|
| 5×5 | 0% | 0% | 0% | 8% | – |
| 6×6 | 0% | 0% | 0% | 0% | 33% |
| 7×7 to 10×10 | 0% | 0% | 0% | 0% | 0% |

Games that hit the 1,500-move cap without a winner:

| Board | 2 | 3 | 4 | 6 | 8 |
|---|---|---|---|---|---|
| 5×5 to 7×7 | 0% | 0% | 0% | 0% | 0% |
| 8×8 | 0% | 8% | 0% | 0% | 0% |
| 9×9 | 0% | 25% | 33% | 25% | 42% |
| 10×10 | 33% | 58% | 50% | 50% | 67% |

First-player win rate varied from 8% to 62% across settings, but with 12 games per setting that is noise. No conclusion about first-player advantage.

## Takeaways

- Early eliminations only appeared on small boards with many players: 8 players on 6×6 (1 in 3 games) and 6 players on 5×5 (about 1 in 12). From 7×7 up there were none.
- Both bots stall on large boards (9×9 and up, increasingly at 10×10+). Boards that large look like a bad default unless human play turns out to be different.
- Suggested board sizes, based on the above:

| Players | Minimum | Suggested |
|---|---|---|
| 2 | 5×5 | 6×6 |
| 3 | 5×5 | 6×6 or 7×7 |
| 4 | 5×5 | 7×7 |
| 6 | 6×6 | 7×7 or 8×8 |
| 8 | 7×7 | 8×8 |

The old `autoSize` (`ceil(sqrt(5n))`, clamped to 5 to 15) gave 5×5 for 2 to 5 players, 6×6 for 6 and 7×7 for 8. That is close to the "Minimum" column, but tight for 6 or more players. `autoSize` now uses a lookup table (2 to 3 players: 6×6, 4 to 5: 7×7, 6 to 8: 8×8, with 5 and 7 players interpolated) and falls back to `ceil(sqrt(8n))` outside 2 to 8 players, which is unvalidated.

## Limitations

- Bots are not humans. Humans likely finish faster, and may react differently to player count.
- Greedy is a 1-ply heuristic with no lookahead, and the random bot has no strategy at all.
- 12 games per setting for the greedy bot is small. The medians are stable enough for rough guidance, but percentages are coarse (steps of about 8%).
- Only default rules were tested. The clock, pop threshold (2 to 8) and random starts all change game length.
- Large-board results are censored by the move caps.

## Next step

Log a summary of each finished game on the host (players, board size, pop threshold, clock, moves, duration, elimination order and reasons, winner and first player), so tuning can use real games. See the issue "Log a summary of each finished game so real games can inform tuning".
