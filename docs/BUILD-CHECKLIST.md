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

## Clearer flight and impact

- [x] Ball visibly rises above its court shadow; collision and trail follow the displayed ball.
- [x] Landing uses bold rings, radial marks, a numbered badge, squash, and distinct audio.
- [x] 148 tests pass; typecheck, web build, and native package pass.
- [x] Browser arc, first landing marker, second-bounce score, and help checked.
- [x] Updated package launched on KT's Board; title screen and startup logs verified.
- [ ] Players confirm the arc and court contact are clear on the physical Board.

## Missing-piece overlay spacing

- [x] Native pause heading, equipment art, and return instruction occupy separate spaces at both ends.
- [x] Browser-rendered native left/right/both missing and returned layouts checked; text/art bounds do not overlap and meet the 48 px inset.
- [x] Browser left/right/both missing and returned layouts checked for overlaps and inset bounds.
- [x] 148 tests pass; TypeScript, web build, and Board package pass.
- [x] Updated package installed and launched on Board; startup logs and setup screen checked.
- [ ] Players confirm missing-piece prompts are clear on the physical Board.

## All-screen text audit

- [x] Title/Continue, setup, help, serve, rally, bounce, point, missing-piece, and result layouts checked in browser and native orientations.
- [x] 416 actual-font render cases have no text/art intersections, inset violations, or undersized/out-of-bounds touch targets.
- [x] Long, very long, accented, and descender-heavy names; three-digit scores; both winners; transient point pops and edge landings covered.
- [x] Text uses bounded slots and measured line spacing; bounce badges and +1 pops avoid other text.
- [x] 148 tests pass; TypeScript, web build, and Board package pass.
- [x] Updated package installed and launched on Board; startup logs and device screenshot checked.
- [ ] Players confirm the revised text and transient labels during physical play.

## Code review and publication

- [x] Physics, input/tracking, lifecycle, saves, rendering, audio, and packaging reviewed independently.
- [x] Net-crossing and rapid-return volleys have regression coverage.
- [x] Repeated menus, confirmed lifts, duplicate glyphs, and audio created during pause have regression coverage.
- [x] Restored seat binding, placement-triggered player selection, and single-loop resume have assembled-input coverage.
- [x] In-play scoring labels meet 48 px; all 416 actual-font layout cases pass.
- [x] Final combined tests: 161 pass, 3 existing catalog skips; TypeScript, web build, and Board package pass.
- [ ] Reviewed changes committed and pushed to the requested public repository.
- [ ] Updated pause/tracking/volley behavior verified with physical pieces on Board.
