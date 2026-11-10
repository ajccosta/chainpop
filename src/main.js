// Entry point: restore the saved name / invite code, then wire up the static buttons.
import { state } from "./state.js";
import { $, store } from "./utils.js";
import { createGame, startGame, backToLobby, knockOut, checkFlag, addLocalPlayer } from "./host.js";
import { joinGame, connectToHost, leave } from "./client.js";
import { render, updateClocks } from "./ui.js";

$("name").value = store.get("cp-name") || "";
const hashCode = location.hash.slice(1).toUpperCase();
if (/^[A-Z0-9]{5}$/.test(hashCode)) { $("join-code").value = hashCode; $("name").focus(); }

$("create").addEventListener("click", createGame);
$("join").addEventListener("click", () => joinGame($("join-code").value));
$("join-code").addEventListener("keydown", e => { if (e.key === "Enter") joinGame($("join-code").value); });
$("add-local").addEventListener("click", () => {
  const name = $("local-name").value;
  $("local-name").value = "";
  addLocalPlayer(name);
});
$("local-name").addEventListener("keydown", e => { if (e.key === "Enter") $("add-local").click(); });
$("start").addEventListener("click", startGame);
$("again").addEventListener("click", backToLobby);
$("close-win").addEventListener("click", () => { state.winDismissed = true; $("win").hidden = true; });
$("remove-turn").addEventListener("click", () => {
  const btn = $("remove-turn");
  if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Tap again to remove"; setTimeout(() => { btn.dataset.confirm = ""; render(); }, 3000); return; }
  btn.dataset.confirm = "";
  knockOut(state.room.game.turn);
});
setInterval(() => { updateClocks(); checkFlag(); }, 100);
for (const id of ["leave-lobby", "leave-game"]) $(id).addEventListener("click", () => {
  const btn = $(id);
  const risky = state.role === "host" && state.room && state.room.seats.length > 1;
  if (risky && btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Leaving ends it for everyone. Tap again"; setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "Leave"; }, 3000); return; }
  btn.dataset.confirm = ""; btn.textContent = "Leave";
  leave();
});
$("copy-link").addEventListener("click", async () => {
  const url = location.href.split("#")[0] + "#" + state.room.code;
  try { await navigator.clipboard.writeText(url); $("copy-link").textContent = "Link copied"; }
  catch { $("copy-link").textContent = url; }
  setTimeout(() => $("copy-link").textContent = "Copy invite link", 2500);
});
$("reconnect").addEventListener("click", () => {
  if (state.peer && !state.peer.destroyed && state.peer.open) connectToHost();
  else { const r = state.room; state.room = null; joinGame(state.joinCode); state.room = r; }
});
addEventListener("beforeunload", e => { if (state.role === "host" && state.room && state.room.seats.some(s => s.ctrl !== "host" && !s.ctrl.startsWith("local-"))) e.preventDefault(); });
