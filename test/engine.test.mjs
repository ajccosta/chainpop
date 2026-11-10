import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newGame, play, settle, advance, neighbors, counts, canPlay, removePlayer,
  clockLeft, retime, randomStarts, readSettings, autoSize, colorFor,
} from "../src/engine.js";

const seats = n => Array.from({ length: n }, (_, i) => ({ name: "P" + i, color: colorFor(i) }));

// A game with turn fixed at 0 and the given blobs already placed ({cell: [owner, dots]}).
function setup(n, settings, blobs = {}) {
  const g = newGame(seats(n), settings);
  g.turn = 0;
  for (const [cell, [o, dots]] of Object.entries(blobs)) {
    g.cells[cell] = { o, n: dots };
    g.players[o].moved = true;
  }
  return g;
}

const adjacent = (size, a, b) => neighbors(size, a).includes(b);

test("autoSize: table for 2-8 players, formula fallback outside it", () => {
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8].map(autoSize), [6, 6, 7, 7, 8, 8, 8]);
  assert.equal(autoSize(1), 5);
  assert.equal(autoSize(10), 9);
  assert.equal(autoSize(100), 15);
});

test("newGame: empty board, auto size, nobody has moved", () => {
  const g = newGame(seats(2), {});
  assert.equal(g.size, autoSize(2));
  assert.equal(g.cells.length, g.size * g.size);
  assert.ok(g.cells.every(c => c.o === -1 && c.n === 0));
  assert.deepEqual(g.players.map(p => [p.name, p.moved, p.out]), [["P0", false, false], ["P1", false, false]]);
  assert.equal(g.popAt, 4);
  assert.equal(g.winner, -1);
  assert.equal(g.seq, 0);
  assert.equal(g.clock, null);
  assert.ok(g.turn === 0 || g.turn === 1);
});

test("newGame: explicit size and invalid settings fall back to defaults", () => {
  assert.equal(newGame(seats(2), { size: 9 }).size, 9);
  const st = readSettings({ size: 99, popAt: 9, clock: 7, inc: 4, randomStart: 2 });
  assert.deepEqual(st, { size: 0, popAt: 4, clock: 0, inc: 0, randomStart: 0 });
});

test("newGame: the first player is random", () => {
  const seen = new Set();
  for (let k = 0; k < 300; k++) seen.add(newGame(seats(3), {}).turn);
  assert.deepEqual([...seen].sort(), [0, 1, 2]);
});

test("first move drops a blob one short of popping, then only own blobs are playable", () => {
  const g = setup(2, { size: 5 });
  const r = play(g, 12);
  assert.deepEqual(r.state.cells[12], { o: 0, n: 3 });
  assert.equal(r.state.turn, 1);
  assert.equal(r.state.seq, 1);
  assert.equal(r.state.last, 12);
  // P1 has not moved yet: any empty square, but not P0's blob.
  assert.equal(canPlay(r.state, 12), false);
  assert.equal(canPlay(r.state, 0), true);
  const r2 = play(r.state, 0);
  assert.equal(canPlay(r2.state, 12), true);         // P0's turn: own blob
  assert.equal(canPlay(r2.state, 1), false);         // P0 has moved: no empty squares
  assert.equal(play(r2.state, 1), null);
  assert.equal(g.cells[12].o, -1, "play() does not mutate its input");
});

test("chain reaction: bursts spread, capture and chain until a player is wiped out", () => {
  // 4×4. P0 owns corner 0 (3 dots), P1 owns 1 (3 dots) and 15 (1 dot).
  const g = setup(2, { size: 4 }, { 0: [0, 3], 1: [1, 3], 15: [1, 1] });
  const r = play(g, 0);
  // Wave 0: cell 0 reaches 4. Wave 1: 0 bursts into 1 and 4; cell 1 is captured at 4.
  // Wave 2: 1 bursts into 0, 2 and 5.
  assert.equal(r.waves.length, 3);
  assert.deepEqual(r.waves[1].burst, [0]);
  assert.deepEqual(r.waves[2].burst, [1]);
  const c = r.state.cells;
  assert.deepEqual([c[0], c[1], c[2], c[4], c[5]], [{ o: 0, n: 1 }, { o: -1, n: 0 }, { o: 0, n: 1 }, { o: 0, n: 1 }, { o: 0, n: 1 }]);
  assert.deepEqual(c[15], { o: 1, n: 1 });
  assert.deepEqual(counts(r.state), [4, 1]);
  assert.equal(r.state.winner, -1);
  assert.equal(r.state.turn, 1);
});

test("chain reaction that takes the last enemy blob wins the game", () => {
  const g = setup(2, { size: 4 }, { 0: [0, 3], 1: [1, 3] });
  const r = play(g, 0);
  assert.equal(r.state.players[1].out, true);
  assert.equal(r.state.winner, 0);
  assert.equal(r.state.turn, 0, "turn does not advance once the game is won");
});

for (let popAt = 2; popAt <= 8; popAt++) {
  test(`pops at ${popAt}: dots thrown per neighbour and dots kept`, () => {
    // 5×5, centre cell 12 ready to pop; P1 parked far away in a corner.
    const g = setup(2, { size: 5, popAt }, { 12: [0, popAt - 1], 0: [1, 1] });
    assert.equal(g.popAt, popAt);
    const r = play(g, 12);
    const per = popAt >= 8 ? 2 : 1;
    const kept = popAt - Math.min(popAt, 4 * per);
    assert.equal(r.waves.length, 2, "a single burst, no chain");
    assert.deepEqual(r.state.cells[12], kept ? { o: 0, n: kept } : { o: -1, n: 0 });
    for (const k of [7, 11, 13, 17]) assert.deepEqual(r.state.cells[k], { o: 0, n: per });
    assert.deepEqual(r.state.cells[0], { o: 1, n: 1 });
  });

  test(`pops at ${popAt}: first blob starts one dot short`, () => {
    const g = setup(2, { popAt });
    assert.equal(play(g, 0).state.cells[0].n, popAt - 1);
  });
}

test("pops at 8: extra dots stay behind when a blob overflows", () => {
  // 9 dots on the centre: spends 8 (2 per neighbour), keeps 1.
  const g = setup(2, { size: 5, popAt: 8 }, { 12: [0, 8], 0: [1, 1] }); // play() adds one more -> 9
  const r = play(g, 12);
  assert.deepEqual(r.state.cells[12], { o: 0, n: 1 });
});

test("random starts are never adjacent", () => {
  for (let size = 4; size <= 15; size++) {
    for (let players = 2; players <= Math.min(10, Math.ceil(size * size / 2)); players++) {
      for (let k = 0; k < 5; k++) {
        const s = randomStarts(size, players);
        if (!s) continue;
        assert.equal(s.length, players);
        assert.equal(new Set(s).size, players);
        for (const a of s) {
          assert.ok(a >= 0 && a < size * size);
          for (const b of s) assert.ok(!adjacent(size, a, b), `${a} and ${b} adjacent on ${size}×${size}`);
        }
      }
    }
  }
});

test("random starts: newGame places one blob per player, one dot short, all marked as moved", () => {
  for (let k = 0; k < 50; k++) {
    const g = newGame(seats(4), { randomStart: 1, popAt: 5 });
    const owned = g.cells.map((c, i) => [c, i]).filter(([c]) => c.o >= 0);
    assert.equal(owned.length, 4);
    assert.deepEqual(owned.map(([c]) => c.o).sort(), [0, 1, 2, 3]);
    assert.ok(owned.every(([c]) => c.n === 4));
    assert.ok(g.players.every(p => p.moved));
    for (const [, a] of owned) for (const [, b] of owned) assert.ok(!adjacent(g.size, a, b));
  }
});

test("random starts: impossible layouts fall back to choosing squares", () => {
  // A 4×4 board fits at most 8 non-adjacent cells.
  assert.equal(randomStarts(4, 9), null);
  const g = newGame(seats(9), { size: 4, randomStart: 1 });
  assert.ok(g.cells.every(c => c.o === -1));
  assert.ok(g.players.every(p => !p.moved));
});

test("removePlayer clears the seat, passes the turn, and can decide the game", () => {
  const g = setup(3, { size: 5 }, { 0: [0, 2], 6: [1, 3], 7: [1, 1], 24: [2, 2] });
  g.turn = 1;
  const s = removePlayer(g, 1);
  assert.equal(s.players[1].out, true);
  assert.ok(s.cells.every(c => c.o !== 1));
  assert.deepEqual(s.cells[6], { o: -1, n: 0 });
  assert.equal(s.turn, 2);
  assert.equal(s.seq, g.seq + 1);
  assert.equal(s.last, -1);
  assert.equal(s.winner, -1);
  assert.equal(g.players[1].out, false, "input is not mutated");

  assert.equal(removePlayer(s, 1), s, "removing an out player is a no-op");
  const end = removePlayer(s, 2);
  assert.equal(end.winner, 0);
  assert.equal(removePlayer(end, 0), end, "no changes after the game is over");
});

test("removePlayer of someone not on turn keeps the turn", () => {
  const g = setup(3, { size: 5 }, { 0: [0, 2], 6: [1, 3], 24: [2, 2] });
  const s = removePlayer(g, 2);
  assert.equal(s.turn, 0);
});

test("settle and advance: an unmoved player with no empty square is knocked out", () => {
  const g = setup(3, { size: 4 });
  g.cells.forEach((c, i) => { c.o = i % 2; c.n = 1; });
  g.players[0].moved = g.players[1].moved = true;
  g.turn = 1;
  advance(g);
  assert.equal(g.players[2].out, true);
  assert.equal(g.turn, 0);
  assert.equal(settle(g), false);
});

test("clock: the player on turn is charged from turnAt; others are not", () => {
  const g = setup(2, { size: 5, clock: 60, inc: 2 });
  assert.deepEqual(g.clock, { left: [60000, 60000], inc: 2000, turnAt: 0 });
  g.clock.turnAt = 1000;
  assert.equal(clockLeft(g, 0, 11000), 50000);
  assert.equal(clockLeft(g, 1, 11000), 60000);
  assert.equal(clockLeft(g, 0, 500), 60000, "a turn starting in the future has not cost anything yet");
  assert.equal(clockLeft(g, 0, 1e9), 0, "never negative");
  assert.equal(clockLeft(setup(2, {}), 0, 5000), null, "no clock");
});

test("clock: retime charges the mover, adds the increment, and restarts at startAt", () => {
  const g = setup(2, { size: 5, clock: 60, inc: 2 });
  g.clock.turnAt = 1000;
  const r = play(g, 12);
  const next = retime(g, r.state, 0, 11000, 11500);
  assert.equal(next.clock.left[0], 50000 + 2000);
  assert.equal(next.clock.left[1], 60000);
  assert.equal(next.clock.turnAt, 11500);
  assert.equal(clockLeft(next, 1, 11400), 60000, "P1's clock waits for the animation");
  assert.equal(clockLeft(next, 1, 12500), 59000);
});

test("clock: a knock-out (no mover) only restarts the clock when the turn changes", () => {
  const g = setup(3, { size: 5, clock: 30 }, { 0: [0, 1], 6: [1, 1], 24: [2, 1] });
  g.clock.turnAt = 1000;
  const sameTurn = retime(g, removePlayer(g, 2), null, 5000, 5000);
  assert.equal(sameTurn.clock.turnAt, 1000);
  assert.deepEqual(sameTurn.clock.left, [30000, 30000, 30000]);
  const moved = retime(g, removePlayer(g, 0), null, 5000, 5000);
  assert.equal(moved.turn, 1);
  assert.equal(moved.clock.turnAt, 5000);
});
