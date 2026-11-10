// Incoming room updates are queued and drawn in order; a move is replayed wave by wave.
import { play } from "./engine.js";
import { state } from "./state.js";
import { sleep, reduced } from "./utils.js";
import { render, renderChrome, drawBoard } from "./ui.js";

export function receive(r, m, anim) { state.queue.push({ r, m, anim }); pump(); }

async function pump() {
  if (state.busy) return;
  state.busy = true;
  while (state.queue.length) {
    const { r, m, anim } = state.queue.shift();
    const g = r.phase === "game" ? r.game : null;
    if (g && anim != null && state.view && g.seq === state.view.seq + 1) {
      const res = play(state.view, anim);
      if (res) {
        state.room = r; state.mine = m; renderChrome(state.view, true);
        const delays = waveDelays(res.waves);
        for (let k = 0; k < res.waves.length; k++) {
          drawBoard(state.view, res.waves[k].cells, res.waves[k].burst, anim);
          await sleep(delays[k]);
        }
      }
    }
    if (g && (!state.view || state.view.winner === -1) && g.winner !== -1) state.winDismissed = false;
    state.room = r; state.mine = m; state.view = g;
    render();
  }
  state.busy = false;
  render();
}

// How long each burst wave stays on screen. Long chains (low pop counts) speed up so a turn never
// animates for more than ~6 s. The host also uses the total to start the next player's clock after it.
export function waveDelays(waves) {
  const d = waves.map((w, k) => reduced ? 60 : !w.burst.length ? 140 : k < 10 ? 260 : k < 30 ? 120 : 50);
  const total = d.reduce((a, b) => a + b, 0), cap = 6000;
  return total > cap ? d.map(x => x * cap / total) : d;
}
