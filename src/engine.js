// Pure game rules: no DOM, no shared state. Imported by the app and by test/engine.test.mjs.
export const PALETTE = ["#e8473f", "#2f7de1", "#24a865", "#f2b417", "#8e5bd8", "#f07c2a", "#17a6a6", "#e0559a", "#7a8a1f", "#5b6bd8"];
export const colorFor = i => i < PALETTE.length ? PALETTE[i] : `hsl(${Math.round((i * 137.508) % 360)} 68% 52%)`;
export const autoSize = n => Math.min(15, Math.max(5, Math.ceil(Math.sqrt(n * 5))));
export const clone = o => JSON.parse(JSON.stringify(o));

// Every game option lives here: the lobby draws a control per entry, the summary line reads `summary`,
// and newGame() reads the values. A new option is one more entry (plus whatever rule uses it).
export const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
export const SETTINGS = [
  { key: "size", label: "Board", def: 0,
    options: n => [[0, `Auto (${autoSize(n)}×${autoSize(n)})`], ...range(4, 15).map(k => [k, `${k}×${k}`])],
    summary: (v, n) => `${v || autoSize(n)}×${v || autoSize(n)}` },
  { key: "popAt", label: "Pops at", def: 4,
    options: () => range(2, 8).map(k => [k, `${k} dots`]),
    summary: v => `pops at ${v}` },
  { key: "clock", label: "Clock", def: 0,
    options: () => [[0, "Off"], [30, "30 s"], [60, "1 min"], [120, "2 min"], [180, "3 min"], [300, "5 min"], [600, "10 min"]],
    summary: v => v ? `${v < 60 ? v + " s" : v / 60 + " min"} each` : "" },
  { key: "inc", label: "Per move", def: 0, hidden: st => !st.clock,
    options: () => [[0, "+0 s"], [1, "+1 s"], [2, "+2 s"], [3, "+3 s"], [5, "+5 s"], [10, "+10 s"]],
    summary: (v, n, st) => st.clock && v ? `+${v} s per move` : "" },
  { key: "randomStart", label: "Random starts", def: 0,
    options: () => [[0, "Off"], [1, "On"]],
    summary: v => v ? "random starts" : "" },
];
export function readSettings(st = {}) {
  const out = {};
  for (const d of SETTINGS) {
    const v = Number(st[d.key]);
    out[d.key] = d.options(2).some(([k]) => k === v) || (d.key === "size" && v >= 4 && v <= 15) ? v : d.def;
  }
  return out;
}
export function describeSettings(st, n) {
  return SETTINGS.filter(d => !d.hidden || !d.hidden(st)).map(d => d.summary(st[d.key], n, st)).filter(Boolean).join(" · ");
}

export function randomInt(max) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max;
}
export function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
export function randomStarts(size, players) {
  const cells = Array.from({ length: size * size }, (_, i) => i);
  for (let tries = 0; tries < 300; tries++) {
    const chosen = [];
    const blocked = new Set();
    for (const i of shuffle(cells.slice())) {
      if (blocked.has(i)) continue;
      chosen.push(i);
      blocked.add(i);
      const r = Math.floor(i / size), c = i % size;
      if (r > 0) blocked.add(i - size);
      if (r < size - 1) blocked.add(i + size);
      if (c > 0) blocked.add(i - 1);
      if (c < size - 1) blocked.add(i + 1);
      if (chosen.length === players) return chosen;
    }
  }
  return null;
}

export function newGame(players, settings) {
  const st = readSettings(settings), size = st.size || autoSize(players.length);
  const game = {
    size, popAt: st.popAt, seq: 0, turn: randomInt(players.length), winner: -1, last: -1,
    cells: Array.from({ length: size * size }, () => ({ o: -1, n: 0 })),
    players: players.map(p => ({ name: p.name, color: p.color, moved: false, out: false })),
    clock: st.clock ? { left: players.map(() => st.clock * 1000), inc: st.inc * 1000, turnAt: 0 } : null,
  };
  if (st.randomStart) {
    const starts = randomStarts(size, players.length);
    if (starts) starts.forEach((cell, seat) => {
      game.cells[cell] = { o: seat, n: game.popAt - 1 };
      game.players[seat].moved = true;
    });
  }
  return game;
}

// Chess clock: `left` is each player's bank at the start of the current turn; the player on turn
// has been spending since `turnAt` (a time in the future means their turn hasn't started yet).
export function clockLeft(g, i, now) {
  if (!g.clock) return null;
  let t = g.clock.left[i];
  if (i === g.turn && g.winner === -1 && !g.players[i].out && now > g.clock.turnAt) t -= now - g.clock.turnAt;
  return Math.max(0, t);
}
// After a state change: charge the mover (if any) and start the next turn's clock at `startAt`.
export function retime(prev, next, mover, now, startAt) {
  if (!next.clock) return next;
  if (mover != null) next.clock.left[mover] = clockLeft(prev, mover, now) + next.clock.inc;
  if (mover != null || prev.turn !== next.turn) next.clock.turnAt = startAt;
  return next;
}

export function counts(s) {
  const c = s.players.map(() => 0);
  for (const x of s.cells) if (x.o >= 0) c[x.o]++;
  return c;
}

export function neighbors(size, i) {
  const r = Math.floor(i / size), c = i % size, out = [];
  if (r > 0) out.push(i - size);
  if (r < size - 1) out.push(i + size);
  if (c > 0) out.push(i - 1);
  if (c < size - 1) out.push(i + 1);
  return out;
}

export function canPlay(s, i) {
  if (s.winner !== -1) return false;
  const c = s.cells[i], p = s.players[s.turn];
  if (!c || !p || p.out) return false;
  return p.moved ? c.o === s.turn : c.o === -1;
}

// Knock out players who have played and own nothing; returns true once the game is decided.
export function settle(s) {
  const c = counts(s);
  s.players.forEach((p, k) => { if (!p.out && p.moved && c[k] === 0) p.out = true; });
  const alive = s.players.map((p, k) => k).filter(k => !s.players[k].out);
  if (alive.length <= 1) { s.winner = alive.length ? alive[0] : -2; return true; }
  return false;
}

// Pass the turn to the next player still in. An unmoved player with no empty square left is out.
export function advance(s) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const t = (s.turn + k) % n, p = s.players[t];
    if (p.out) continue;
    if (!p.moved && !s.cells.some(x => x.o === -1)) { p.out = true; if (settle(s)) return; continue; }
    s.turn = t;
    return;
  }
}

// Returns {state, waves} where each wave is the board after one round of bursts, or null if illegal.
export function play(s0, i) {
  if (!canPlay(s0, i)) return null;
  const s = clone(s0), seat = s.turn, p = s.players[seat], c = s.cells[i];
  if (!p.moved) { c.o = seat; c.n = s.popAt - 1; p.moved = true; } else c.n++;
  const waves = [{ cells: clone(s.cells), burst: [] }];
  for (let guard = 0; guard < 2000; guard++) {
    const full = [];
    s.cells.forEach((x, j) => { if (x.n >= s.popAt) full.push(j); });
    if (!full.length) break;
    // A burst throws `per` dots in each of 4 directions (dots aimed off the
    // board are lost) and keeps whatever is left over, so pop counts above 4
    // don't destroy dots.
    const per = Math.max(1, Math.floor(s.popAt / 4)), spent = Math.min(s.popAt, 4 * per);
    for (const j of full) {
      const x = s.cells[j];
      x.n -= spent;
      if (x.n === 0) x.o = -1;
      for (const k of neighbors(s.size, j)) { s.cells[k].n += per; s.cells[k].o = seat; }
    }
    waves.push({ cells: clone(s.cells), burst: full });
    if (settle(s)) break;
  }
  settle(s);
  s.last = i;
  s.seq++;
  if (s.winner === -1) advance(s);
  return { state: s, waves };
}

// Take a player out of a running game (left or was removed); their blobs are cleared.
export function removePlayer(s0, seat) {
  const s = clone(s0), p = s.players[seat];
  if (!p || p.out || s.winner !== -1) return s0;
  p.out = true;
  for (const x of s.cells) if (x.o === seat) { x.o = -1; x.n = 0; }
  s.seq++;
  s.last = -1;
  if (!settle(s) && s.turn === seat) advance(s);
  return s;
}
