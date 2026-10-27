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

## October 27, 2026 — Clearer arc and landing feedback

- **Asked for:** "make the arc and bounces more obvious so we can clearly see when the ball hits the court"
- **Source:** The ball now rises visibly above a shadow anchored to the court. Racket sweeps and the trail use the same projected position and visible radius. The underlying court path, bounce timing, volley rule, and two-bounce scoring remain unchanged. Landings show bold double rings, radial marks, a numbered badge, and a stronger squash. The contact sound is sharper; point chimes wait 120 ms.
- **Unit/integration:** 148 passed, 0 failed, 3 external catalog tests skipped. New checks cover visible-ball volleys, misses through the shadow, contact at the enlarged visible edge, projection at the walls, and a complete match with projected aiming.
- **Build:** TypeScript, Vite, standalone web build, and Board package pass.
- **Browser:** Observed the ball rise above its grounded shadow, rebound, show a numbered first landing, and award a second-bounce point. Help and its return control were checked. Screenshots: `artifacts/clear-ball-arc.png` and `artifacts/clear-court-contact.png`.
- **Board:** Installed and launched on KT's Board with the same appId. Logs confirm asset `index-CbDyqvIr.js`, restored platform state, and a running audio context. Device screenshot confirms the title screen: `artifacts/board-clear-bounce-update.png`.
- **Human:** The requested improvement came from the person's feedback. Clarity and audio quality on the updated physical Board await their next playtest.

## October 27, 2026 — Missing-piece overlay spacing

- **Asked for:** "fix this", with a native screenshot of overlapping "Rally paused" and "Return your piece" text.
- **Source:** The native pause heading now occupies a separate slot above the canonical piece art. The return instruction stays below the art. Each player retains a seat-facing pause message; only missing pieces show the return prompt. No media or game rules changed.
- **Unit/integration:** 148 passed, 0 failed, 3 external catalog tests skipped.
- **Build:** TypeScript, Vite, standalone web build, and Board package pass. Existing appId and packageId retained.
- **Browser:** Rendered the actual native and browser layouts with the bundled font for left missing, right missing, both missing, and pieces returned. Measured text/art bounds show no intersections and all remain within the 48 px inset. Native missing-piece screenshots visually checked: `artifacts/pause-overlay-native-left.png`, `artifacts/pause-overlay-native-right.png`, and `artifacts/pause-overlay-native-both.png`. This is renderer evidence using fixture state, not a physical piece test.
- **Board:** Installed and launched on KT's Board. Logs confirm new bundle `index-CfPqb2jG.js`, restored platform state, and running audio. Device screenshot confirms the setup screen: `artifacts/board-pause-overlay-update.png`.
- **Human:** Updated missing-piece prompts still await confirmation during physical play.

## October 27, 2026 — All-screen overlap audit

- **Asked for:** "check the other screens for overlapping text too"
- **Source:** Bounded text slots prevent long names from overrunning scores, labels, and result details. Measured line spacing accommodates accents/descenders. HUD columns accommodate three-digit scores. Browser action headings stay on one line. Bounce badges avoid HUD/status/point-pop areas while rings stay at the physical contact. Native +1 pops use the game font and a separate position, and cannot linger over result/help/setup/missing-piece screens.
- **Unit/integration:** 148 passed, 0 failed, 3 external catalog tests skipped. Existing full-match, rematch, pause, and setup journeys still pass.
- **Build:** TypeScript, Vite, standalone web build, and Board package pass.
- **Browser:** 416 fixture renders use the actual game renderer and font in native and browser orientations. Coverage includes title/Continue, all setup states, six help animation frames, both servers/receivers/winners, points, missing pieces, results, normal/long/extreme/accented/descender-heavy names, three-digit scores, animated point pops, and edge landing locations. No measured text/art intersections, 48 px inset violations, or touch-target size/bounds failures. Report: `artifacts/screen-audit-after.json`. Sixteen representative screenshots visually checked (including an independent native review): `artifacts/audit-*.png`. These fixtures verify rendering, not physical input or play feel.
- **Board:** Installed and launched on KT's Board using the existing appId. Logs show bundle `index-B2JfE7Tg.js`, restored platform state, and running audio. Screenshot: `artifacts/board-screen-audit-update.png`.
- **Human:** Physical confirmation of the revised labels and effects remains open.

## October 27, 2026 — Code review, fixes, and public repository

- **Asked for:** Review the whole game, fix findings, commit and push; create a public repository under Kevinmthau.
- **Source:** Independent reviews covered physics, input/tracking, lifecycle, saves, rendering, audio, and packaging. All confirmed findings were fixed: Continue side binding and stable player identity, placement-triggered roster selection, duplicate animation loops, repeated-menu identity loss, confirmed-lift preservation, complete duplicate-glyph recovery, lazy audio pause handling, net-crossing volleys, rapid-return strike locks, and undersized in-play HUD labels. Existing layout edits were preserved. A follow-up review found no remaining confirmed code findings.
- **Unit/integration:** 161 passed, 0 failed, 3 existing external-catalog skips. Regression tests include changed session IDs after restore, pieces already present when Continue is selected, late roster joins, selector dismissal, quick pause/resume, repeated menus, lifted pieces, duplicate recovery, paused audio startup, both net-crossing directions, consecutive volleys, and rendered text floors. The full input-driven match, result, and rematch still pass.
- **Build:** TypeScript, Vite, standalone web build, Board package, and diff whitespace checks pass. Package retains the installed appId and packageId; final asset bundle is `index-DTrOZPvr.js`.
- **Browser:** All 416 actual-font layout fixtures pass with no text intersections, inset violations, or undersized/out-of-bounds targets. Updated HUD screenshot: `artifacts/review-hud.png`. The final standalone package boots to its title screen with no captured console errors or warnings.
- **Board/human:** No new hardware installation or physical playtest performed for this review. Native save round-trip, tracking feel, audio timing, and two-person volley behavior remain pending physical verification; browser and automated checks do not establish those results.
- **Publication:** Created public [Kevinmthau/Board-tennis](https://github.com/Kevinmthau/Board-tennis), configured `origin`, and pushed reviewed code commit `7683b73` to `main`. GitHub visibility and default branch verified.
