// Shared mutable app state. Modules import `state` and read/write its fields directly.
//
// room: {phase: "lobby" | "game", code, settings (see SETTINGS), seats: [{name, color, ctrl, online}], game}
// ctrl is who drives a seat: "host" / "local-N" on the host's device, or a remote player's token.
export const state = {
  role: null,          // "host" | "client"
  room: null,          // latest room (host: authoritative; client: as last received)
  mine: [],            // seat indexes this device controls
  view: null,          // game state currently drawn on the board (lags behind during animations)
  peer: null,
  hostConn: null,
  conns: new Map(),    // host only: token -> DataConnection
  localCounter: 0,
  joinCode: null,
  winDismissed: false,
  clockOffset: 0,      // host clock minus ours, so clients can run the host's clocks
  queue: [],           // incoming room updates waiting to be animated/drawn
  busy: false,         // true while the animation pump is running
};
