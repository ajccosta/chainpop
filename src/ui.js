// Everything that draws to the DOM: home, lobby, game chrome, board and win overlay.
import { SETTINGS, describeSettings, counts, canPlay, clockLeft } from "./engine.js";
import { state } from "./state.js";
import { $, store } from "./utils.js";
import { broadcast, dropSeat } from "./host.js";
import { sendMove } from "./client.js";

export function myName() {
  const n = $("name").value.trim().slice(0, 16) || "Player";
  store.set("cp-name", n);
  return n;
}
export function homeError(msg) { $("home-error").textContent = msg; $("home-error").hidden = !msg; }
export function show(screen) {
  for (const id of ["home", "lobby", "game"]) $(id).hidden = id !== screen;
}

export function setNetNote(t) { $("net-note").textContent = t; }

export function render() {
  const room = state.room;
  if (!room) return;
  $("hdr-code").textContent = state.role === "host" && !state.peer ? "" : room.code;
  if (room.phase === "lobby") { renderLobby(); show("lobby"); $("win").hidden = true; }
  else if (state.view) { const view = state.view; show("game"); renderChrome(view, state.busy); drawBoard(view, view.cells, [], view.last); renderWin(); }
}

function renderLobby() {
  const room = state.room, mine = state.mine;
  const host = state.role === "host";
  $("lobby-code").textContent = room.code;
  $("share").hidden = host && !state.peer;
  $("net-note").hidden = !host;
  $("host-controls").hidden = !host;
  $("wait-note").hidden = host;
  $("seat-count").textContent = `Players (${room.seats.length})`;
  const ul = $("seats");
  ul.replaceChildren(...room.seats.map((s, i) => {
    const li = document.createElement("li");
    li.className = "seat";
    const sw = document.createElement("span"); sw.className = "swatch"; sw.style.background = s.color;
    const nm = document.createElement("span"); nm.className = "seat-name"; nm.textContent = s.name;
    const tag = document.createElement("span"); tag.className = "tag";
    const host_ = s.ctrl === "host";
    tag.textContent = !mine.includes(i) ? (host_ ? "host" : "") : s.ctrl.startsWith("local-") ? "this device" : host_ ? "you · host" : "you";
    li.append(sw, nm, tag);
    if (host && s.ctrl !== "host") {
      const b = document.createElement("button");
      b.className = "ghost small danger"; b.textContent = "Remove";
      b.addEventListener("click", () => { const c = state.conns.get(s.ctrl); if (c) { c.send({ t: "kicked" }); setTimeout(() => c.close(), 100); state.conns.delete(s.ctrl); } dropSeat(s.ctrl); });
      li.append(b);
    }
    return li;
  }));
  $("lobby-info").textContent = host ? "" : "Game: " + describeSettings(room.settings, room.seats.length);
  if (host) {
    renderSettings();
    $("start").disabled = room.seats.length < 2;
    $("start").textContent = room.seats.length < 2 ? "Need at least 2 players" : `Start game · ${room.seats.length} players`;
  }
}

// One labelled select per SETTINGS entry, built once and updated in place (so an open dropdown survives a re-render).
function renderSettings() {
  const box = $("settings"), st = state.room.settings, n = state.room.seats.length;
  for (const d of SETTINGS) {
    let field = document.getElementById("setf-" + d.key);
    if (!field) {
      field = document.createElement("div");
      field.className = "field"; field.id = "setf-" + d.key;
      const lb = document.createElement("label"); lb.htmlFor = "set-" + d.key; lb.textContent = d.label;
      const sel = document.createElement("select"); sel.id = "set-" + d.key;
      sel.addEventListener("change", () => { state.room.settings[d.key] = Number(sel.value); broadcast(); });
      field.append(lb, sel);
      box.append(field);
    }
    const sel = field.querySelector("select"), opts = d.options(n);
    const sig = opts.map(o => o.join("=")).join("|");
    if (sel.dataset.sig !== sig) {
      sel.dataset.sig = sig;
      sel.replaceChildren(...opts.map(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; return o; }));
    }
    sel.value = String(st[d.key]);
    field.hidden = !!(d.hidden && d.hidden(st));
  }
}

function fmtClock(ms) {
  if (ms < 10000) return (Math.floor(ms / 100) / 10).toFixed(1);
  const t = Math.ceil(ms / 1000);
  return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
}

// Clocks read the newest game state (not the animating one), on the host's time.
export function updateClocks() {
  const room = state.room;
  const g = room && room.phase === "game" ? room.game : null;
  if (!g || !g.clock) return;
  const now = Date.now() + state.clockOffset;
  for (const el of document.querySelectorAll("#chips .tm")) {
    const ms = clockLeft(g, Number(el.dataset.i), now);
    el.textContent = fmtClock(ms);
    el.classList.toggle("low", ms < 10000 && !g.players[el.dataset.i].out);
  }
}

function swatch(color) { const s = document.createElement("span"); s.className = "swatch"; s.style.background = color; return s; }

export function renderChrome(g, animating) {
  const room = state.room, mine = state.mine;
  const c = counts(g);
  $("chips").replaceChildren(...g.players.map((p, i) => {
    const d = document.createElement("div");
    const seat = room.seats[i];
    d.className = "chip" + (i === g.turn && g.winner === -1 ? " turn" : "") + (p.out ? " out" : "") + (p.flagged ? " flag" : "") + (seat && !seat.online && !p.out ? " off" : "");
    d.style.setProperty("--c", p.color);
    const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = p.name + (isYou(i) ? " (you)" : "");
    const ct = document.createElement("span"); ct.className = "ct"; ct.textContent = p.moved ? c[i] : "–";
    d.append(swatch(p.color), nm, ct);
    if (g.clock) { const tm = document.createElement("span"); tm.className = "tm"; tm.dataset.i = i; d.append(tm); }
    return d;
  }));
  updateClocks();
  $("info").textContent = describeSettings(room.settings, g.players.length);
  const st = $("status"), cur = g.players[g.turn];
  st.replaceChildren();
  if (g.winner >= 0) st.append(swatch(g.players[g.winner].color), `${g.players[g.winner].name} wins!`);
  else if (g.winner === -2) st.append("Nobody is left.");
  else {
    const myTurn = mine.includes(g.turn), you = isYou(g.turn);
    const what = cur.moved ? `tap one of ${you ? "your" : "their"} blobs` : "drop a blob on any empty square";
    const seat = room.seats[g.turn];
    const knockedOut = mine.length && mine.every(i => g.players[i] && g.players[i].out) ? "You're out. " : "";
    st.append(swatch(cur.color), myTurn ? `${you ? "Your" : cur.name + "'s"} turn: ${what}` : `${knockedOut}Waiting for ${cur.name}${seat && !seat.online ? " (offline)" : ""}…`);
  }
  const b = $("board");
  b.style.setProperty("--c", cur ? cur.color : "transparent");
  b.classList.toggle("mine", g.winner === -1 && mine.includes(g.turn) && !animating);
  const rt = $("remove-turn");
  rt.hidden = !(state.role === "host" && g.winner === -1 && room.seats[g.turn] && !room.seats[g.turn].online);
  rt.textContent = cur ? `Remove ${cur.name}` : "Remove player";
}

// "You" only makes sense when this device drives a single seat; with several it's pass-and-play.
function isYou(i) { return state.mine.length === 1 && state.mine[0] === i; }

export function drawBoard(g, cells, burst, last) {
  const b = $("board");
  const n = g.size;
  if (b.childElementCount !== n * n) {
    b.style.setProperty("--n", n);
    b.replaceChildren(...cells.map((_, i) => {
      const btn = document.createElement("button");
      btn.className = "cell";
      btn.addEventListener("click", () => onCell(i));
      return btn;
    }));
  }
  const interactive = !state.busy && !state.queue.length && g === state.view && state.mine.includes(g.turn);
  const burstSet = new Set(burst);
  cells.forEach((x, i) => {
    const el = b.children[i];
    const can = interactive && canPlay(g, i);
    el.classList.toggle("can", can);
    el.classList.toggle("last", i === last);
    el.setAttribute("aria-label", x.o < 0 ? "empty" : `${g.players[x.o].name}, ${x.n} dots`);
    const k = Math.min(x.n, g.popAt);
    const key = x.o < 0 ? "" : x.o + ":" + k;
    if (el.dataset.k !== key) {
      el.dataset.k = key;
      el.replaceChildren();
      if (x.o >= 0 && x.n > 0) {
        const bl = document.createElement("div");
        bl.className = "blob" + (k === g.popAt - 1 ? " ready" : "");
        bl.style.setProperty("--c", g.players[x.o].color);
        bl.style.setProperty("--d", k <= 4 ? "18%" : k <= 6 ? "15%" : "13%");
        for (const [left, top] of dotLayout(k)) {
          const dot = document.createElement("i"); dot.className = "dot";
          dot.style.left = left + "%"; dot.style.top = top + "%";
          bl.append(dot);
        }
        el.append(bl);
      }
    }
    if (burstSet.has(i)) {
      const fx = document.createElement("div");
      fx.className = "burst";
      fx.style.setProperty("--c", g.players[g.turn].color);
      fx.addEventListener("animationend", () => fx.remove());
      el.append(fx);
    }
  });
}

// Dot positions (percent of the blob) for 1–8 dots: dice faces up to 5, then a ring around a centre dot.
function dotLayout(k) {
  const fixed = { 1: [[50, 50]], 2: [[33, 50], [67, 50]], 3: [[50, 32], [32, 64], [68, 64]],
    4: [[33, 33], [67, 33], [33, 67], [67, 67]], 5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]] };
  if (fixed[k]) return fixed[k];
  const ring = Array.from({ length: k - 1 }, (_, j) => {
    const a = -Math.PI / 2 + j * 2 * Math.PI / (k - 1);
    return [50 + 27 * Math.cos(a), 50 + 27 * Math.sin(a)];
  });
  return [[50, 50], ...ring];
}

function onCell(i) {
  const g = state.view;
  if (!g || state.busy || state.queue.length || !state.mine.includes(g.turn) || !canPlay(g, i)) return;
  sendMove(i);
}

export function renderWin() {
  const g = state.view;
  const done = g.winner !== -1;
  $("win").hidden = !done || state.winDismissed;
  if (!done) return;
  const w = g.players[g.winner];
  $("win-blob").style.setProperty("--c", w ? w.color : "var(--line)");
  $("win-title").textContent = w ? (isYou(g.winner) ? "You win!" : `${w.name} wins!`) : "Nobody is left.";
  $("again").hidden = state.role !== "host";
  $("again-note").hidden = state.role === "host";
}
