// Client side: join a host's game over PeerJS (global `Peer`), send moves, and leave.
import { state } from "./state.js";
import { $, TOKEN, peerId } from "./utils.js";
import { hostMove } from "./host.js";
import { receive } from "./animation.js";
import { myName, homeError, show } from "./ui.js";

export function joinGame(code) {
  code = (code || "").toUpperCase().trim();
  if (!/^[A-Z0-9]{5}$/.test(code)) { homeError("Game codes are 5 letters or digits."); return; }
  if (typeof Peer === "undefined") { homeError("Online play is unavailable: PeerJS didn't load. Check your connection."); return; }
  homeError("");
  state.role = "client";
  state.joinCode = code;
  $("join").disabled = $("create").disabled = true;
  $("join").textContent = "Joining…";
  if (state.peer) state.peer.destroy();
  const peer = state.peer = new Peer();
  peer.on("open", () => connectToHost());
  peer.on("error", e => {
    if (e.type === "peer-unavailable") clientFail(`No game found with code ${code}. Check the code, or ask the host if their game is still open.`);
    else clientFail("Couldn't connect (" + e.type + "). Try again.");
  });
  peer.on("disconnected", () => { if (state.peer && !state.peer.destroyed) state.peer.reconnect(); });
}

export function connectToHost() {
  const hostConn = state.hostConn = state.peer.connect(peerId(state.joinCode), { reliable: true });
  hostConn.on("open", () => { state.hostConn.send({ t: "hello", name: myName(), token: TOKEN }); $("lost").hidden = true; });
  hostConn.on("data", msg => {
    if (state.role !== "client") return;
    if (msg && msg.t === "room") { if (typeof msg.now === "number") state.clockOffset = msg.now - Date.now(); receive(msg.room, msg.mine, msg.anim); }
    if (msg && msg.t === "kicked") { leave(); homeError("The host removed you from the game."); }
  });
  hostConn.on("close", () => { if (state.role === "client" && state.room) { $("lost").hidden = false; if (state.room.phase === "lobby") leave("The host closed the game."); } });
}

function clientFail(msg) {
  if (state.room) { $("lost").hidden = false; return; }
  leave();
  homeError(msg);
}

export function leave(msg) {
  if (state.role === "client" && state.hostConn && state.hostConn.open) state.hostConn.send({ t: "leave" });
  const p = state.peer;
  setTimeout(() => p && p.destroy(), 150);
  state.peer = state.hostConn = null;
  state.conns.clear();
  state.role = state.room = state.view = null;
  state.mine = [];
  state.queue.length = 0;
  $("join").disabled = $("create").disabled = false;
  $("join").textContent = "Join";
  $("win").hidden = true;
  $("lost").hidden = true;
  $("hdr-code").textContent = "";
  show("home");
  homeError(msg || "");
}

export function sendMove(cell) {
  if (state.role === "host") hostMove(cell);
  else if (state.hostConn && state.hostConn.open) state.hostConn.send({ t: "move", cell });
}
