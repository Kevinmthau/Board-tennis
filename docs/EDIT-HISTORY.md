# Edit history

## October 27, 2026 — First web playable
The person requested a Board tennis game using board-games-ai, Sports pieces, and the Board-puttputt line mechanic.
They chose two human players, simple arcade scoring, and slowing the incoming ball near the receiver.
The builder selected Twist Tennis, left/right seats, first to 7 with a two-point lead, and a sunny blue court.
Started from the exact Studio starter. Reused the proven putt-putt tracking and browser host fixes.
Adapted its finite line collision for a moving ball. Added simultaneous two-player web controls and packaged Board output.
No Board installation, public source publication, or cloud hosting was requested or performed.

## October 27, 2026 — Full-screen rebound court
The person requested that the whole screen become the court and that the Board walls rebound the ball.
They chose one back-wall bounce on every incoming shot. Each racket return resets this allowance.
Top and bottom rebounds stay in play. A second end-wall contact without a return loses the point for the receiver.
A shot that never crosses the net loses after 8 seconds, preventing an endless vertical bounce.

## October 27, 2026 — Verification and setup recovery
Resolved racket collisions in travel order, including wall-reflected paths and the scoring boundary.
Added an input-driven full match, result and rematch integration check, plus menu/help and duplicate-glyph ownership checks.
Browser verification found that Change setup could mistake a menu's tracking reset for a deliberate lift.
Setup now requires observed presence followed by a real lift and replacement, with that observation reset at each pause epoch.
Browser controller overlays are hidden while help or the final result is shown.

## October 27, 2026 — Requested Board installation
The person asked to install the game on their Board for a Sports-piece playtest.
Installed and launched the verified package on KT's Board. Confirmed the native title screen and clean game startup through a device screenshot and logs.
Physical rally testing awaits the players; the app identity is now fixed for future updates and save continuity.

## October 27, 2026 — Ground-bounce correction
The person requested a ball that visibly arcs and bounces, with a lost point on its second bounce.
Ground landings now replace back-wall contacts as the scoring condition. All four walls still rebound the ball.
Each return starts a fresh arc and resets the count. The person confirmed that volleys are allowed.
Height changes the ball's apparent size and shadow. Ground contact adds a brief ring, squash, and sound.
Old saves keep scores and players, restarting an old rally at a serve. New saves include flight and bounce state.
Verified 143 passing tests and the browser's two-bounce point. Installed the update on KT's Board with the same app identity.

## October 27, 2026 — Clearer arcs and court contact
The person reported that the arc and bounces were still hard to see.
The ball now visibly rises above a shadow anchored to the court. Its trail and racket collision follow the same visible position.
The visible ball edge counts as contact, including its increased size while airborne. The court path and bounce timing stay unchanged.
Each landing produces two bold rings, radial marks, a numbered badge, and a stronger squash.
The bounce has a crisp attack and low thump. Point chimes start after the contact sound.
Verified 148 passing tests and the browser's raised ball and numbered landing. Installed and launched the update on KT's Board.

## October 27, 2026 — Missing-piece text overlap
The person supplied a Board screenshot where "Rally paused" overlapped "Return your piece" and requested a fix.
Both strings used the same seat frame with only 16 px between their centers. The native pause heading now
sits above the equipment art, with the return instruction below it. The other player still sees the pause heading.
Verified left-missing, right-missing, both-missing, and returned layouts in native orientation and browser orientation
using the actual renderer and font. All measured text/art bounds are separated and meet the 48 px inset.
All 148 tests, TypeScript, the web build, and the Board package pass.
Installed and launched the update on KT's Board; logs confirm the new bundle and a device screenshot confirms setup.

## October 27, 2026 — All-screen text audit
The person asked to check the other screens for overlapping text.
The normal static screens were clear. Stress checks found unlimited name wrapping colliding with HUD scores
and browser status instructions, accented lines touching each other, landing numbers crossing HUD/status text,
and the native +1 animation crossing point explanations (including the immediate result on a winning point).
Names now occupy at most two lines with an ellipsis when necessary; line spacing uses actual font bounds.
Browser status headings stay on one line with the action first. HUD spacing accommodates two name lines
and three-digit scores. Landing number badges avoid reserved text areas while the contact rings stay put.
The +1 animation uses the game font and a separate native position, and is omitted/cleared on result, help,
setup, and missing-piece screens. Verified 416 actual-font layout cases and 148 passing existing tests.
Installed and launched the audited package on KT's Board with the existing app identity; startup verified.

## October 27, 2026 — Code review and publication
The person requested a full code review, fixes until clear, then a commit and push. They then requested a new public repository under Kevinmthau.
Preserved the existing missing-piece and text-audit changes. Fixed restore binding order and stable player identity across launches, automatic player selection on a new unclaimed placement, and duplicate animation loops after rapid pause/resume. Setup help now retains focus when both pieces become ready in the same frame.
Fixed repeated-menu identity loss, loss of confirmed lift state, and duplicate-glyph recovery that discarded a valid identity. Audio created during a menu stays suspended.
Fixed missed net-crossing volleys and a strike lock that could survive a rapid return. Browser scoring-rule labels now meet the in-play 48 px minimum with expanded spacing.
Added regression coverage for these cases and reran the actual-font layout audit. No new media, gameplay rule changes, app identity changes, or hardware installation were requested.
