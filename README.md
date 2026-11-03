# Chainpop

A chain-reaction territory game for any number of players, playable online in the browser.

**Play:** https://ajccosta.github.io/chainpop/

## How to play

- Your first move drops a 3-dot blob on any empty square.
- After that you can only tap your own blobs to add a dot.
- At 4 dots a blob bursts, sending one dot to each neighbour and taking them over. Bursts chain.
- Lose all your blobs and you're out. Last color standing wins.

## Playing online

One player clicks **Create game** and shares the 5-character code or invite link. Everyone else joins from their own browser. The host can also add players on their own device for pass-and-play.

Games run peer-to-peer (via [PeerJS](https://peerjs.com/)); the host's tab acts as the server, so keep it open until the game ends.
