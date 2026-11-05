# Chainpop

A chain-reaction territory game for any number of players, playable online in the browser.

**Play:** https://ajccosta.github.io/chainpop/

## How to play

- Your first move drops a 3-dot blob on any empty square.
- After that you can only tap your own blobs to add a dot.
- At 4 dots a blob bursts, sending one dot to each neighbour and taking them over. Bursts chain.
- Lose all your blobs and you're out. Last color standing wins.

The host can change the settings in the lobby:

- **Pops at**: 2 to 8 dots (default 4). Your first blob starts one dot short of popping. At 8, a burst sends two dots to each neighbour, and any extra dots stay in the blob.
- **Clock**: chess-style clocks from 30 s to 10 min per player, with an optional bonus per move. Run out of time and you're out.
- **Turn timer**: limit each turn to 10 s – 1 min (off by default). The allowance starts over every turn; if you run out, your turn is skipped, you stay in the game, and you can still lose by the Clock. Works with or without the Clock.
- **Board**: from 4×4 to 15×15, or sized automatically for the number of players.

## Playing online

One player clicks **Create game** and shares the 5-character code or invite link. Everyone else joins from their own browser. The host can also add players on their own device for pass-and-play.

Games run peer-to-peer (via [PeerJS](https://peerjs.com/)); the host's tab acts as the server, so keep it open until the game ends.
