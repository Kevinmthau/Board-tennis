# Acceptance ledger: Twist Tennis

## October 27, 2026 — First web playable

- **Asked for:** A Board tennis game made with board-games-ai and the Studio starter, using Sports pieces and the line strike mechanic from Board-puttputt. Two humans, arcade scoring, forgiving receiver slowdown, the whole screen as the court, and one back-wall recovery bounce.
- **appId:** `6c06513b-cfc9-4dd1-b6b7-3683b364386e`
- **Piece set:** Sports, glyphs 1–8. One piece per player, including two of the same glyph.
- **Delivery:** `web-dist/` browser build, `twist-tennis.webapp.zip` Board package, local preview at `http://127.0.0.1:5177/`.
- **Source:** Exact Studio starter and pinned SDK beta.8. Measured finite racket line, moving-ball sweep, reflected path collision, turn ownership, wall allowance, scoring and slowdown. Roster-backed seats, pause epochs, result controls and platform state integration. Browser adapters excluded from the Board package.
- **Unit/integration:** 135 passed, 0 failed, 3 skipped. The skipped tests expect the full external piece catalog; this game's copied Sports footprint data is tested by its swing tests. Input-driven main-loop tests complete a 7–0 match, preserve a waiting result, rematch, return from help, survive repeated pause/redetection, and change setup with deliberate lifts. Rules include 7–6 continuation and an 8–6 win. No fake score or ball-state mutation is used for the match journey.
- **Build:** TypeScript, Vite, Board pack, and standalone web build pass. Dependency audit reports zero vulnerabilities.
- **Browser:** Packaged web build visually inspected in the in-app browser. Selected the second human, placed both pieces, served through keyboard rotation, observed ball travel and points, opened/resumed the platform menu, read help, returned to the same match, changed setup, and lifted/replaced both pieces. Help hides browser controller overlays. Whole-screen blue court, wall edges, line, ball, scores and teaching cues are visible. Manual full-match result/rematch with two people was NOT TESTED; that flow has input integration coverage.
- **Board:** NOT TESTED. No package was installed on hardware. Native tracking feel, seat-facing readability at physical size, performance, audio quality, and native persistence need hardware verification.
- **Human:** NOT TESTED. No uncoached two-person playtest has been performed.
- **Open:** Tune slowdown, racket reach and angular-speed power after physical play. Confirm that the one-back-wall allowance is clear to new players. Confirm hardware save/restore and tracking recovery with actual Sports pieces.

Browser checks establish simulated behavior only; they do not establish physical feel.

## October 27, 2026 — Installed for Sports-piece playtest

- **Asked for:** "Can you put it on my Board so we can try it with the Sports pieces?"
- **Build:** Same verified first-playable package and appId; source commit `4a5edca`.
- **Board:** Installed and launched successfully on KT's Board through Board Connect. A device screenshot confirms the native title screen, seat-facing text, Sports artwork, and Play/How to play controls. Platform state initialized and the audio context started. Startup logs contain only missing optional font-manifest/favicon warnings, with no game exception.
- **Evidence:** `artifacts/board-first-launch.png` (local screenshot, ignored by Git).
- **Human:** Playtest ready; no physical rally or player feedback observed yet.
- **Open:** Physical piece recognition, swing feel, pause recovery, native saves, and an uncoached two-person match remain to be checked during play.

## October 27, 2026 — Visible flight and two ground bounces

- **Asked for:** "the ball needs to look like it is arcing and bouncing. IF it bounces twice i lose the point."
- **Source:** Ball height follows a ballistic arc. The first ground contact rebounds; the second awards the hitter. Walls reflect without counting. Volleys remain allowed. Receiver slowdown applies to flight and planar travel together. Size, shadow, impact rings, squash, and audio communicate the height and landings.
- **Unit/integration:** 143 passed, 0 failed, 3 external catalog tests skipped. Checks cover first and second ground contacts, wall banks, volleys, exact strike timing around the second bounce, 30/60/120 Hz stepping, save migration, and a complete input-driven match/rematch.
- **Build:** TypeScript, Vite, standalone web build, and Board package pass.
- **Browser:** Served through the normal controls. Observed airborne size/shadow, the first-bounce cue, and a point labeled "Two ground bounces". Screenshot: `artifacts/ground-bounce-preview.png`.
- **Board:** Reinstalled and launched with the existing appId on KT's Board. Logs confirm the new asset bundle and restored platform state. Screenshot confirms the game behind the native pause menu: `artifacts/board-ground-bounce-update.png`. A person must tap Resume to play.
- **Saves:** Version 1 scores, players, longest rally, and completed results are preserved. An old active rally restarts at a serve. Version 2 preserves flight and bounce state. Unit migration checks pass; native logs confirm stored state was available on launch.
- **Human:** The bounce correction came from the person's playtest feedback. The updated physical rally feel has not yet been observed.
