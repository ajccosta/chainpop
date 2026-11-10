// Host side: the host's tab owns the authoritative room and acts as the server for everyone else.
// PeerJS is loaded by a classic <script> tag in index.html and used here as the global `Peer`.
import { colorFor, readSettings, newGame, play, removePlayer, clockLeft, retime } from "./engine.js";
import { state } from "./state.js";
import { newCode, peerId } from "./utils.js";
import { receive, waveDelays } from "./animation.js";
import { myName, homeError, setNetNote, render } from "./ui.js";

export function hostMine(token) {
  return state.room.seats.map((s, i) => [s, i]).filter(([s]) => token ? s.ctrl === token : !state.conns.has(s.ctrl) && (s.ctrl === "host" || s.ctrl.startsWith("local-"))).map(([, i]) => i);
}
export function recolor() { state.room.seats.forEach((s, i) => s.color = colorFor(i)); }
export function broadcast(anim = null) {
  const now = Date.now();
  for (const [token, c] of state.conns) if (c.open) c.send({ t: "room", room: state.room, mine: hostMine(token), anim, now });
  receive(state.room, hostMine(null), anim);
}

export function createGame() {
  state.role = "host";
  homeError("");
  state.room = { phase: "lobby", code: newCode(), settings: readSettings(), seats: [{ name: myName(), color: colorFor(0), ctrl: "host", online: true }], game: null };
  broadcast();
  openHost();
}

function openHost() {
  if (typeof Peer === "undefined") { setNetNote("Online play is unavailable (couldn't load PeerJS). You can still play on this device."); return; }
  setNetNote("Opening the game online…");
  const peer = state.peer = new Peer(peerId(state.room.code));
  peer.on("open", () => { setNetNote("Share the code or link. Anyone can join from their own browser."); render(); });
  peer.on("error", e => {
    if (e.type === "unavailable-id") { state.peer.destroy(); state.room.code = newCode(); broadcast(); openHost(); }
    else if (e.type !== "peer-unavailable") setNetNote("Online connection problem (" + e.type + "). Local players still work.");
  });
  peer.on("disconnected", () => { if (state.peer && !state.peer.destroyed) state.peer.reconnect(); });
  peer.on("connection", conn => {
    conn.on("data", msg => onHostData(conn, msg));
    conn.on("close", () => onHostClose(conn));
  });
}

function onHostData(conn, msg) {
  const room = state.room;
  if (!msg || typeof msg !== "object") return;
  if (msg.t === "hello") {
    const token = String(msg.token || "").slice(0, 32), name = String(msg.name || "Player").slice(0, 16);
    if (!token) return;
    const old = state.conns.get(token);
    if (old && old !== conn) old.close();
    conn.token = token;
    conn.playerName = name;
    state.conns.set(token, conn);
    const seat = room.seats.find(s => s.ctrl === token);
    if (seat) { seat.online = true; if (room.phase === "lobby") seat.name = name; }
    else if (room.phase === "lobby") { room.seats.push({ name, color: "", ctrl: token, online: true }); recolor(); }
    broadcast();
  } else if (msg.t === "move" && conn.token && room.phase === "game") {
    const g = room.game, seat = room.seats[g.turn];
    if (seat && seat.ctrl === conn.token) hostMove(Number(msg.cell));
  } else if (msg.t === "leave" && conn.token) {
    dropSeat(conn.token);
    conn.close();
  }
}

function onHostClose(conn) {
  if (!conn.token || state.conns.get(conn.token) !== conn) return;
  state.conns.delete(conn.token);
  if (state.room.phase === "lobby") dropSeat(conn.token);
  else { const s = state.room.seats.find(s => s.ctrl === conn.token); if (s) s.online = false; broadcast(); }
}

export function dropSeat(ctrl) {
  const room = state.room;
  const i = room.seats.findIndex(s => s.ctrl === ctrl);
  if (i < 0) return;
  if (room.phase === "lobby") { room.seats.splice(i, 1); recolor(); }
  else { room.seats[i].online = false; knockOut(i); return; }
  broadcast();
}

// Every change to a running game goes through here, so the clocks are always charged and restarted.
function commit(next, mover, anim, delay = 0) {
  const now = Date.now();
  state.room.game = retime(state.room.game, next, mover, now, now + delay);
  broadcast(anim);
}

export function hostMove(cell) {
  const g = state.room.game;
  if (g.clock && clockLeft(g, g.turn, Date.now()) <= 0) return checkFlag();
  const r = play(g, cell);
  if (!r) return;
  commit(r.state, g.turn, cell, waveDelays(r.waves).reduce((a, b) => a + b, 0));
}

export function knockOut(seat, flagged = false) {
  const next = removePlayer(state.room.game, seat);
  if (next === state.room.game) return broadcast();
  if (flagged) { next.players[seat].flagged = true; next.clock.left[seat] = 0; }
  commit(next, null, null);
}

export function checkFlag() {
  const room = state.room;
  const g = room && room.phase === "game" ? room.game : null;
  if (state.role === "host" && g && g.clock && g.winner === -1 && clockLeft(g, g.turn, Date.now()) <= 0) knockOut(g.turn, true);
}

export function startGame() {
  const room = state.room;
  if (room.seats.length < 2) return;
  room.phase = "game";
  room.game = newGame(room.seats, room.settings);
  if (room.game.clock) room.game.clock.turnAt = Date.now();
  broadcast();
}

export function backToLobby() {
  const room = state.room;
  room.seats = room.seats.filter(s => s.online);
  // Spectators who arrived mid-game get a seat for the next one.
  for (const [token, c] of state.conns) if (c.open && !room.seats.some(s => s.ctrl === token)) room.seats.push({ name: c.playerName, color: "", ctrl: token, online: true });
  recolor();
  room.phase = "lobby";
  room.game = null;
  broadcast();
}

export function addLocalPlayer(rawName) {
  const room = state.room;
  const name = rawName.trim().slice(0, 16) || `Player ${room.seats.length + 1}`;
  room.seats.push({ name, color: "", ctrl: "local-" + (++state.localCounter), online: true });
  recolor();
  broadcast();
}
