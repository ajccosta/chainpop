// Small browser helpers with no game or app state.
export const $ = id => document.getElementById(id);
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
export const rand = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(36).padStart(2, "0")).join("");
// Per tab (survives a reload, so a dropped player gets their seat back), so two tabs are two players.
export const TOKEN = (() => {
  try { return sessionStorage.getItem("cp-token") || (sessionStorage.setItem("cp-token", rand(8)), sessionStorage.getItem("cp-token")); }
  catch { return rand(8); }
})() || rand(8);
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), b => CODE_CHARS[b % CODE_CHARS.length]).join("");
export const peerId = code => "chainpop-v1-" + code.toLowerCase();
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
