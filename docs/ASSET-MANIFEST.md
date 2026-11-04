# Asset manifest: Twist Pickleball

| File | Role | Source | Rights |
|---|---|---|---|
| `vendor/board.fun-web-sdk-1.0.0-beta.8.tgz` | Pinned Board SDK dependency | Exact board-games-ai Studio starter, catalog commit 87831b85 | Board SDK; retained for this Board game |
| `public/model.tflite` | Sports recognition model | board-games-ai Sports catalog, commit 87831b85 | Board-supplied recognition asset |
| `public/piece-footprints.json` | Measured Sports base geometry | Same Sports catalog | Canonical Board data |
| `public/fonts/game-font.woff2` | All game text and title | Russo One 400 by Jovanny Lemonad, obtained by the board-games-ai font picker from Google Fonts; family renamed to Board Game Font and URL metadata removed | SIL Open Font License 1.1 |
| `public/fonts/game-font.json` | Bundled font layout/readability configuration | board-games-ai font picker | Original configuration |
| `public/fonts/GAME-FONT-LICENSE.txt` | Font copyright, OFL and modification notice | Russo One source licence; web addresses omitted | SIL Open Font License 1.1 |
| `public/piece-art/1.png` | Baseball equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/2.png` | Hockey equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/3.png` | Cyclist equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/4.png` | Soccer equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/5.png` | Tennis equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/6.png` | Football equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/7.png` | Swimmer equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `public/piece-art/8.png` | Basketball equipment identification | Same Sports catalog; unchanged | Canonical Board product art for Board game use |
| `src/view.ts` | Court, paddles, title compositions, perforated ball and interface artwork | Original procedural Canvas artwork for this game | Original work |
| `src/sound.ts` | Racket, point, win, placement sounds and breeze | Original WebAudio synthesis for this game | Original work |
| `index.html` (packed) | Runtime entry page | Repository `index.html`, Vite and Board pack transforms | Original application page and Board packaging |
| `assets/index-*.js` (packed) | Compiled game and SDK code | `src/`, vendored Board SDK, Vite build | Original game source and Board SDK |
| `assets/index-*.css` (packed) | Full-screen canvas styling | `src/style.css`, Vite build | Original game styling |
| `board-platform.js` (packed) | Platform-owned menu, save, audio and app lifecycle | Repository `platform/board-platform.js`; only the pack-time configuration is filled in | Board platform runtime |
| `harness-config.json` (packed) | App identity and device harness configuration | Generated from `board.config.json` by Board pack | Original configuration |
| `browser-host.js`, `player-selector.js`, `pickleball-controls.js` (web only) | SDK simulation, local roster, virtual Sports controls | Repository `dev/`; adapted from board-games-ai starter and original controls | Board starter and original application code |

Sports model SHA-256: `4d75343e149b72f8410cad10f518c64791634ae6e6932880088a34c164026ad9`.

The browser adapters show upright canonical Sports renders with measured controller outlines only in the web build. They are excluded from the native package.

`art/twist-pickleball-title-card.png` is an original 1536-by-864 title-card export from `drawTitleCard()` in `src/view.ts`, using the bundled font. It is repository artwork, not a runtime download. The title reads the platform-owned name.

November 4, 2026: removed the starter Kabel font. All Sports assets, the recognition model, SDK tarball, and lockfile are unchanged. No generated or externally fetched runtime imagery is used.

October 27, 2026 pause-overlay fix: only procedural layout in `src/view.ts` changed; no media was added or modified.
Verification screenshots and the render harness in `artifacts/` are local evidence and are not shipped.

October 27, 2026 all-screen audit: bounded text layout and badge placement remain procedural in `src/view.ts`.
Point-pop placement/lifecycle in `src/main.ts` uses the existing Kabel font and `src/fx.ts`; no media was added.

October 27, 2026 code review: runtime, tracking, seating/save flow, swing resolution, and procedural HUD layout changed.
No media assets or third-party dependencies were added or changed. New test files are verification source and are not shipped in the game packages.
