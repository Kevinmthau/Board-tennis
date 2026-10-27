# Twist Tennis

A two-player Board game made from the exact board-games-ai Studio starter. Any two Board Sports pieces become rackets, using the rotating line mechanic from Board-puttputt.

## Play in a browser

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5176
```

Open http://127.0.0.1:5176. In the browser controls, choose **Add second player**, select the local player, then choose **Place piece** for each side. Both pieces start beside the serve ball. Press **E** to make the first serve.

| Player | Move | Twist | Hit harder |
|---|---|---|---|
| Left | W A S D | Q / E | Left Shift while twisting |
| Right | Arrow keys | Comma / Period | Right Shift while twisting |

Both players' controls work at the same time. Mouse and touch also work: drag a piece to move it, or drag its white rear handle to rotate it. The controls panel collapses. P or Escape opens the platform menu.

## Rules

- The whole Board screen is the court. The center net separates the players.
- Slide beside the ball, then twist the forehead line through it. Sliding or placing alone never hits.
- The ball leaves sideways from the line. Faster rotation hits harder. Both twist directions work.
- Incoming shots slow near the receiver to give time for a return.
- Top and bottom walls rebound the ball. Each incoming shot gets one back-wall recovery bounce.
- A second end-wall contact without a racket return loses the point for the receiver. A return resets the allowance.
- A backwards shot can bank off the hitter's wall before crossing the net. It does not consume the receiver's recovery bounce.
- A shot must cross the net within eight seconds. This stops a vertical shot from bouncing forever.
- The conceding player serves next. The ball waits until that player deliberately twists through it.
- First to 7, win by 2. The result waits for Rematch or Change setup.
- Lifting a required piece pauses the rally. Brief tracking gaps preserve ball momentum and piece ownership.

The default browser positions are arranged for clockwise serves: E on the left, Period on the right. After a rally, move beside the new serve ball. If you need to turn the piece before serving, move the line clear of the ball first.

## Build and checks

```sh
npm test
npm run build:web
```

`web-dist/` is the standalone browser build. Serve it with any static HTTP server:

```sh
python3 -m http.server 5177 --bind 127.0.0.1 --directory web-dist
```

`twist-tennis.webapp.zip` is the Board package. Browser proxy controls are added only to `web-dist/`, never to the native package. Native players join through Board's player selector. On Change setup, lift and replace both pieces after choosing the players.

The app identity is kept in `board.config.json`. The Sports model, measured footprints, canonical product art, and SDK beta.8 come from board-games-ai. The SDK remains vendored because the public npm release is older. Vite and its source-map dependency were patched within their existing compatible versions.

See [the design plan](docs/PLAN.md), [build checklist](docs/BUILD-CHECKLIST.md), [acceptance ledger](docs/ACCEPTANCE-LEDGER.md), and [asset sources](docs/ASSET-MANIFEST.md). Browser and unit tests do not establish real Board tracking feel or hardware performance.
