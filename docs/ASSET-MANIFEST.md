# Asset manifest: Twist Tennis

| File | Role | Source | Rights |
|---|---|---|---|
| `vendor/board.fun-web-sdk-1.0.0-beta.8.tgz` | Pinned Board SDK dependency | Exact board-games-ai Studio starter, catalog commit 87831b85 | Board SDK; retained for this Board game |
| `public/model.tflite` | Sports recognition model | board-games-ai Sports catalog, commit 87831b85 | Board-supplied recognition asset |
| `public/piece-footprints.json` | Measured Sports base geometry | Same Sports catalog | Canonical Board data |
| `public/fonts/itc-kabel-ultra.otf` | All game text and title | Exact Studio starter | Board-supplied font |
| `public/piece-art/1.png` | Baseball equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/2.png` | Hockey equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/3.png` | Cyclist equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/4.png` | Soccer equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/5.png` | Tennis equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/6.png` | Football equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/7.png` | Swimmer equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/8.png` | Basketball equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `src/view.ts` | Court, title composition, ball and interface artwork | Original procedural Canvas artwork for this game | Original work |
| `src/sound.ts` | Racket, point, win, placement sounds and breeze | Original WebAudio synthesis for this game | Original work |

Sports model SHA-256: `4d75343e149b72f8410cad10f518c64791634ae6e6932880088a34c164026ad9`.

The browser adapters draw virtual controller outlines only in the web build. They are excluded from the native package.

October 27, 2026 pause-overlay fix: only procedural layout in `src/view.ts` changed; no media was added or modified.
Verification screenshots and the render harness in `artifacts/` are local evidence and are not shipped.

October 27, 2026 all-screen audit: bounded text layout and badge placement remain procedural in `src/view.ts`.
Point-pop placement/lifecycle in `src/main.ts` uses the existing Kabel font and `src/fx.ts`; no media was added.

October 27, 2026 code review: runtime, tracking, seating/save flow, swing resolution, and procedural HUD layout changed.
No media assets or third-party dependencies were added or changed. New test files are verification source and are not shipped in the game packages.
