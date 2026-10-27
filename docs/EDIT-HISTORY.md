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
