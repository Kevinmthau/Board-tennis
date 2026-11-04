# Twist Pickleball

A two-player Board game using the Sports pieces and the rotating-line swing from Board-puttputt. This update replaces the original arcade tennis rules with singles pickleball.

## Play in a browser

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5176
```

Open http://127.0.0.1:5176. Choose **Add second player**, select a local player, then choose **Place piece** for each side. Press **E** for the opening serve. **How to play** teaches the swing and rules in six animated pages.

| Player | Move | Twist | Hit harder |
|---|---|---|---|
| Left | W A S D | Q / E | Left Shift while twisting |
| Right | Arrow keys | Comma / Period | Right Shift while twisting |

Both players' controls work at the same time. Drag a piece to move it, or drag its white rear handle to rotate it. The controls panel collapses. P or Escape opens the platform menu.

## Rules

- Serve once from behind the baseline into the diagonal service box, beyond the kitchen line. Your score decides the serving half: right on even scores, left on odd scores.
- Let the serve bounce before returning it, then let that return bounce on the other side. After these two opening bounces, volleys are allowed.
- A piece's measured footprint acts as its feet. A volley touching the kitchen or its line is a fault, including during follow-through after the ball dies. Ground strokes are allowed inside the kitchen.
- A first landing outside the court is out. Ordinary court lines count as in; the kitchen line is out on a serve. Net faults and a second bounce end the rally. Walls never rebound the ball.
- Only the server scores. A receiving winner earns the serve without a point (**side out**). First to 11, win by 2.
- The result waits for a shared **Rematch** or **Change setup** choice.

Slide beside the raised ball and twist the line through it. Sliding or placing alone never hits. Faster rotation hits harder; both directions work. The ball arcs automatically and slows near the receiver. These are tabletop adaptations of [USA Pickleball's rules](https://usapickleball.org/rules/summary/); the game cannot measure a human arm or waist for an underhand serve.

The highlighted area behind the baseline shows where to serve, and the opposite service box shows the target. Move to the other serving half after scoring. Move the line clear of the ball before turning it to prepare another swing. A short tracking gap preserves momentum; lifting a required piece pauses play.

## Build and checks

```sh
npm test
npm run build:web
```

`web-dist/` is the standalone browser build. Serve it with any static HTTP server:

```sh
python3 -m http.server 5177 --bind 127.0.0.1 --directory web-dist
```

`twist-pickleball.webapp.zip` is the Board package. Browser controls are included only in `web-dist/`. Native players join through Board's player selector. On Change setup, lift and replace both pieces after choosing the players.

The installed app identity remains fixed in `board.config.json`. The Sports model, measured footprints, canonical product art, and vendored SDK beta.8 are unchanged. The bundled Russo One font replaces the starter's Kabel font under the requested Board standards. The title-card export is `art/twist-pickleball-title-card.png`; its procedural source is `drawTitleCard()` in `src/view.ts`.

Tennis saves retain scores, players, and longest rallies; active rallies restart at a pickleball serve. Completed tennis results remain historical results. New saves retain service, bounce obligations, and unresolved volley follow-through.

See [the design plan](docs/PLAN.md), [build checklist](docs/BUILD-CHECKLIST.md), [acceptance ledger](docs/ACCEPTANCE-LEDGER.md), and [asset sources](docs/ASSET-MANIFEST.md). Browser and unit checks do not establish physical Board tracking or play feel.
