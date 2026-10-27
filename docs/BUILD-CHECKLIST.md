# Build checklist: Twist Tennis

- [x] Design accepted: two humans, arcade scoring, forgiving slowdown.
- [x] Exact Studio starter, pinned SDK, Sports model and new app identity.
- [x] Pure scoring, moving-ball swing, tangent power and slowdown tests.
- [x] Tracking identity, duplicate glyph, gap and pause tests.
- [x] Two-player browser adapters with independent controls and explicit roster.
- [x] Two roster players can place Sports pieces and begin a serve (assembled browser).
- [x] Players can slide, twist, rally, score, and reach a shared result (input-driven integration tests).
- [x] Rematch, change setup, missing pieces, help and pause work (integration tests; setup/help/pause also checked in browser).
- [x] Court art, canonical equipment, seat-facing HUD and sound integrated.
- [x] Text and touch floors checked by source scans; browser setup, help and play visually checked.
- [x] Platform save API and resume code paths inspected; off-device behavior tested.
- [ ] Native save/restore round trip checked on Board.
- [x] Complete npm test, build:web and Board pack pass.
- [x] Assembled browser: roster, setup, serve, rally travel, point, pause, help, setup change.
- [x] Full match and shared result/rematch exercised through real main-loop input integration tests.
- [ ] Full result/rematch journey manually played in the browser by two people.
- [x] Installed and launched on KT's Board; native title screenshot and startup logs checked.
- [ ] Real Board physical piece recognition and rally feel tested.
- [ ] Uncoached human playtest (pending user play).

## Ground-bounce update

- [x] Ball rises and falls; height remains aligned with the visible strike coordinate.
- [x] First ground contact rebounds; second contact awards the hitter; walls do not count.
- [x] Returns reset the count; volleys preserve continuous flight height.
- [x] Racket contacts before and after the second-bounce deadline tested.
- [x] Previous scores/results migrate; new flight state survives save round trips in tests.
- [x] 143 tests pass; build:web and Board package pass.
- [x] Browser first bounce and second-bounce point visually verified.
- [x] Updated package installed and launched on KT's Board; stored state restored.
- [ ] Updated ground-bounce feel tested by two people with Sports pieces.
