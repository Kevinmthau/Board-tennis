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
