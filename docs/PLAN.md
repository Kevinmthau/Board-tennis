# Twist Pickleball

## Current change — November 4, 2026

The person requested pickleball rules, use of board-game-standards and board-games-ai, and a reviewed, merged PR.
The baseline is `bd968cbd9eecd09d0b8f20301378b24bcea7d241`. The baseline tests pass: 161 passed, three external-catalog skips.
The builder owns the `codex/pickleball-rules` checkout. The existing public repository and installed app identity stay fixed.

## Summary and how to play

Two human players use the existing Sports pieces and twist controls for singles pickleball.
1. Place one Sports piece at each end. Slide beside the ball and twist the line through it.
2. Serve behind the baseline into the diagonal service box. Serve from your right on even scores, left on odd scores.
3. Let the serve bounce, then let its return bounce. Afterward, volley only while your piece stays outside the kitchen.
4. Only the server scores. Win 11 points with a two-point lead. A receiving winner earns the serve without a point.

## Rules and tabletop adaptations

- Use traditional singles side-out scoring, one serve attempt, and no sets or doubles service order.
- Mark a 44-by-20 court proportionally on the 1920-by-1080 canvas, leaving room behind each baseline for pieces.
- Mark the seven-foot kitchen on both sides. Baselines, sidelines, and service centerlines count as in.
- A serve touching the kitchen line, landing in the wrong service box, or landing out loses the serve.
- Both opening shots must bounce before a return. An early swing is a fault, rather than passing through the ball silently.
- After those bounces, volleys are legal outside the kitchen. Ground strokes are legal inside it.
- Use each piece's measured footprint as its feet, including kitchen-line and service-foot faults.
- Track volley follow-through until the piece settles for 0.2 seconds within a 16 px / 8 degree rest window (tracking-jitter tolerance). Kitchen contact during this motion is a fault, even after the ball dies.
- Delay a rally outcome while volley follow-through is unsettled. Never announce a provisional point or result.
- An out-of-bounds first landing loses for the hitter. A second landing after a legal first bounce loses for the receiver.
- Board edges never rebound. Reaching the glass edge before a legal bounce is out; after a legal bounce it is a missed return.
- A low net crossing is a fault. Automatic vertical flight, receiver slowdown, and the measured planar tangent remain.
- Twist contact with a stationary ball substitutes for a real underhand/drop serve. Arm and waist height are not observable on Board.
- A ball's court anchor is its ground-contact location. Its lifted rendering remains the racket-contact target.
- A backward shot is not corrected. It can fault at the net, ground, table edge, or the existing eight-second dead-shot limit.
- The serve ball waits for deliberate rotation. Placement, translation, menu return, and reacquisition never strike.
- Saved tennis scores, seats, and best rallies migrate. Active tennis rallies restart at a pickleball serve; completed results remain historical results.
- New saves preserve pickleball service, bounce obligations, and unfinished volley follow-through.

## Players, teaching, first minute, and result

Keep two roster-backed human seats at the left and right ends. Use `src/seats.ts` after platform readiness.
Keep the existing tracking-gap, pause-epoch, explicit reseating, and shared result/rematch behavior.
Show canonical Sports art when asking for equipment. Do not draw a proxy under a physical piece.
The title introduces the renamed game. Setup identifies each piece and player. The first serve highlights the service box and diagonal target.
Help uses separate animated pages for the twist, serve, two-bounce rule, kitchen, boundaries, and scoring.
Live prompts identify the server, required bounce, kitchen fault, and side out. Only scored points receive a +1 effect.
The result waits for Rematch or Change setup. Rematch clears all pickleball obligations and retains confirmed seats.

## Standards and decisions

Sources: local `board-game-standards` at `e42cdb4f`, and `board-games-ai` at `4a6ff44e`.
Read the improvement, Studio starter, design rules, teaching, piece/table, fonts, and simple-English skills.
Sport source: [USA Pickleball rules summary](https://usapickleball.org/rules/summary/), checked November 4, 2026.

| Decision | By | Reason |
|---|---|---|
| Pickleball replaces arcade tennis | person | This request supersedes the old wall and scoring rules |
| Singles, two humans | builder | Preserve the person's established two-human design |
| Name: Twist Pickleball | builder | Match the sport while preserving the twist mechanic |
| Insets replace full-screen wall play | builder | Service areas and out calls need court boundaries |
| Physical footprint represents feet | builder | Board reports pieces rather than human body pose |
| Stable piece ends volley momentum | builder | Measurable tabletop equivalent of regaining balance |
| Keep platform-owned menus, saves, audio, name | project instructions | PLATFORM.md supersedes older standards examples |
| Keep installed IDs, Sports model, vendored SDK, public repo | project/person instructions | Preserve installation, saves, and repository continuity |
| Keep two seat-facing views and shared result | project instructions | Simultaneous players must read their own edge |
| Vibes: sporty, sunny, arcade | builder | Retain the existing blue-court visual world |
| Russo One 400 | builder | Approved sports font; selected over Passion One and Squada One for wider, readable labels |
| Original paddle key art and title card | builder | No canonical piece renders or subtitle on the home screen; separate 1536-by-864 composition |

This is a rules conversion in an existing game. Generic mode selection, house-rule customization, AI levels, flip controls,
and a new release-publishing workflow are outside this change. Existing project-specific flow remains authoritative.
The standards' request for a private Harris-Hill repository does not override the person's existing public Kevinmthau repository.
The standards' direct save/quit APIs do not override PLATFORM.md. Text floors remain 48 px in play, 32 px elsewhere,
with 120 px targets and 48 px edge insets. Conflicting font guidance uses the standards' approved open-font requirement. Russo One is bundled under the OFL, with a renamed internal family and URL metadata removed; the source and modification are recorded in the manifest.

## Verification plan

Test scoring/service parity, both opening bounce obligations, diagonal serves and line calls, kitchen/foot faults and follow-through,
net/out/missed returns, frame-order collisions, save migration, pause recovery, and an input-driven complete match and rematch.
Run the whole test suite, TypeScript, browser build, and Board packaging. Inspect the actual browser screens and help pages.
Review the PR in a fresh agent context. Fix P0/P1 findings and repeat until clear before merging and cleaning the branch.
Keep Board and uncoached-human checks open until actual hardware and people establish those results.

---

## Historical tennis plan (superseded by the current rules above)

# Twist Tennis

## Summary
- **One line:** Slide your Sports piece, twist your racket line, and rally across a sunny tennis court.
- **Players:** Two people on the same Board, seated at its left and right ends.
- **Piece set:** Sports. Each player can use any of its eight pieces. Tennis (glyph 5) is shown first.
- **First move:** Place a Tennis or other Sports piece in your end of the court. Twist through the actual serve ball.
- **Sound:** Racket pops, point chimes, arrival sounds, and a quiet court ambience through the platform audio buses.
- **Status:** Design accepted on October 27, 2026. Two humans, simple scoring, and forgiving receiver slowdown were selected by the person.

## How to play
1. Put one Sports piece at each end of the court.
2. Slide beside the ball and twist your line through it.
3. Twist faster to hit harder. Angle the line to place your shot.
4. Win 7 points, with a lead of 2.

## Rules
- One physical piece controls one racket line. All eight Sports pieces have the same reach and power.
- The line starts at the measured front outline plus 6 px and ends 240 px from the piece center.
- Rotation strikes the ball. Placement, sliding alone, tracking recovery, and menu return never strike.
- Direction follows the line's tangent and the direction of rotation. A clockwise or counterclockwise swing can hit.
- Power follows angular speed, independent of where along the line contact occurs.
- Adapt the existing putt-putt collision to a moving ball. Sweep both the ball and line to avoid missed fast contacts.
- The receiver can return once. A return becomes available to the other side after the ball crosses the center net.
- Players stay in their half. The physical pose is never moved or clamped by game logic.
- The center net is a visual separator. This arcade prototype has no net-height faults, double faults, or sets.
- The whole 1920×1080 screen is the court. All four Board walls rebound the ball without a penalty.
- Every shot rises and falls in a ballistic arc. The ball visibly lifts above its shadow, which stays on the court.
- Racket contact and the ball trail use the same projected position as the visible ball. Players aim at the ball, not the shadow.
- The first ground landing rebounds. The second ground landing without a return loses the point for the receiver.
- Volleys are allowed. A racket return resets the ground-bounce count. Wall rebounds do not count as ground bounces.
- A backward shot can bank off the hitter's own wall before crossing the net. Flight timing targets the receiving half.
- Flight and planar motion slow together near the receiver. Ground contact adds a bold double ring, radial marks, a numbered badge, and a short squash.
- The landing badge shows 1 or 2 for 0.8 seconds. A crisp contact sound precedes the point chime.
- A shot must cross the net within 8 seconds. Otherwise, the hitter loses the point. This prevents a vertical shot bouncing forever.
- The line does not silently correct shot direction.
- After a point, the conceding player receives a stationary serve ball. Their next twist begins the rally.
- First to 7, win by 2. The final result waits for a shared Rematch or Change setup choice.
- A short tracking gap keeps ball momentum and piece identity. A deliberate lift pauses the rally until both pieces return.
- Outgoing ball speed maps 30–540 degrees/second to 480–1100 px/second. In the receiving end, travel eases toward 220 px/second.

## Players and seating
- Read the roster through `src/seats.ts` after platform state is ready.
- Two human roster players are required. The first is the signed-in profile; the second joins through the SDK selector.
- A piece in a free end binds the next unbound roster player. An unclaimed placement still receives an arrival response.
- Identity, names, and scores follow session IDs. Lifts and tracking recovery preserve ownership.
- The person explicitly chose two humans for the first playable. This overrides the skill's default selectable AI.
- Left and right are the only seats. Local cues face their own seat. Shared controls are repeated as views of one decision.
- The browser uses a simulated roster and visible virtual pieces. Its adapters are excluded from the Board package.

## Action ownership
| Action | Effect |
|---|---|
| Place | Acknowledge once; bind a player if eligible |
| Slide | Reposition the racket; never hit without rotation |
| Twist | Sweep the live line through the ball |
| Lift | Clear swing intent; pause after lift debounce |
| Touch screen | Use setup, help, or shared result controls |
| Pause/resume | Freeze the match; rebind pieces without a hit or second splash |

## Communication and teaching
| State | Next action | Signal | Ends when |
|---|---|---|---|
| Title | Place a Sports piece | Court scene, moving tennis ball, real product art | A piece lands or setup is selected |
| Setup | Join and place both pieces | Canonical art at missing ends, roster controls | Two people and two pieces are ready |
| Serve | Twist through the ball | Ball pulse and short literal sweep demonstration | A real swing hits |
| Rally | Intercept and twist | Ball trail, line, local impact burst | Point ends |
| Point | Prepare to serve | Point announcement and score pop at winner's end | Next deliberate serve |
| Missing piece | Return the piece | Canonical art at the missing player's end | Required piece returns |
| Help | Watch the gesture | Literal animated line and tangent ball motion | Back returns to the same state |
| Result | Rematch or change setup | One shared result with seat-facing views | Either shared choice is made |

On Board, the missing-piece overlay gives each seat a separate pause heading above the equipment art
and a return instruction below it. Both players see the pause heading; only missing pieces show art
and the return instruction. All text remains at least 48 px, with clear space between elements.

Player names use at most two lines in their allocated space; unusually long names end with an ellipsis.
The roster retains the full name. Line spacing accounts for accents and descenders, and the browser HUD
reserves separate space for three-digit scores. Browser serve and point headings stay on one line with
the action first, so an abbreviated name cannot obscure the instruction.
Landing rings stay at court contact; their number badge moves clear of the HUD, instructions, and point pop.
The seat-facing +1 pop occupies a separate area during points, uses the game font, and is cleared for
help, setup, or missing-piece screens. Winning points go straight to the result without a +1 overlay.

## First minute
1. A bright blue court, cream markings, and moving ball introduce the game.
2. The actual Sports art identifies the equipment. Placement earns one outward splash and sound.
3. Both roster players claim opposite ends. The serve ball waits for an intentional twist.
4. The first strike creates a sharp pop, a brief trail, and a readable ball crossing.
5. A miss resolves to a point and a new stationary serve. The next rally begins with the same gesture.

## Result and replay
The result names the winner and shows both scores and the longest rally. It stays until a shared choice.
Rematch resets scores, ball, rally count, and swing intent. It preserves seats and pieces without new arrival effects.
Change setup releases seat bindings and returns to roster setup. Lift and replace each piece to confirm the new setup. Help and the system menu preserve the match.

## Look and asset plan
Sunny arcade tennis, viewed straight down. Full-screen blue hard court, cream net and walls, lime ball, coral and cream player accents.
Use the bundled Kabel typeface through `gameFont()` and `drawTitle()`. Draw the detailed court once and cache it.
Fill the glass with a blue court and subtle material detail. The only walls are the physical Board edges. No inset court or scenery apron.
Title, setup, play, recovery, and result share the same court materials. Do not add dashboard sidebars.
Canonical Sports renders identify equipment. No proxy, ring, or sprite follows a physical piece on Board.
The requested emitted racket line is gameplay, begins outside the footprint, and remains visible.
Ball impacts use small finite bursts; points use larger court-side celebrations. Avoid world shake because geometry follows physical pieces.
All in-play text is at least 48 px. Other text is at least 32 px. Targets are at least 120 px, inset 48 px.

## Verification
Preserve starter tests. Add scoring, moving-ball sweep, tangent direction, jitter, hold, translation, duplicate-glyph, blink, pause, and rematch tests.
Check the title, setup, first serve, rally, point, missing piece, help return, result, and rematch in the browser.
Native feel and uncoached human learning remain unverified until played on actual Board hardware.

## Decisions
| Decision | Value | By | Source |
|---|---|---|---|
| Foundation | Exact board-games-ai Studio starter | person | Initial request |
| Equipment | Board Sports pieces | person | Initial request |
| Core action | Existing putt-putt line and twist mechanic | person | Initial request |
| Players | Two people on the same Board | person | Design answer |
| Rules | Arcade rallies and simple scoring | person | Design answer |
| Name | Twist Tennis | builder | Related to the established Twist Putt mechanic |
| Recipe | Paddle Arena adapted to a rotating finite line | builder | board-games-ai recipe |
| Seating | Left/right ends | builder | More travel and reaction space along the landscape court |
| Scoring | First to 7, win by 2 | builder | Short arcade match |
| Visuals | Sunny blue hard court | builder | Readable ball and familiar tennis setting |
| AI | No AI in this first version | person | Explicit two-human choice overrides skill default |
| Delivery | Playable local web version and Board-compatible package | builder | User requested a web build; no hardware installation requested |
| Rally feel | Slow near the receiver, with live movement | person | Design answer |
| Court extent | Whole screen, with Board walls | person | Follow-up design answer |
| Walls | All four walls rebound without consuming a ground bounce | builder | Preserve full-screen wall play under corrected ground-bounce rule |
| Ground bounces | First landing rebounds; second landing loses the point | person | Physical playtest correction |
| Volleys | Allowed before the first ground bounce | person | Confirmed design answer: "Allow volleys" |
| Dead shot | Point lost after 8 seconds without crossing the net | builder | Prevent a perfectly vertical shot from stalling play |

## Review hardening (October 27, 2026)
- Continue restores each player's side before binding pieces already on the glass. Saves include stable player IDs so a new session ID after relaunch cannot swap scores; older saves retain their session-ID fallback.
- A new placement at a free end opens the selector when another roster player is needed. Dismissing it does not reopen it every frame.
- A receiver can volley on the exact frame the ball crosses the net, but never before the ball enters that player's half. A rapid return rearms the other player even if it crosses back within the same frame.
- Repeated menu epochs preserve pending piece identities and already confirmed lifts. Duplicate-glyph recovery retains both identities when a valid pairing exists.
- Pause cancels the pending animation frame, and resume schedules one loop only after startup finishes. Audio initialized while paused stays suspended until resume.
- Browser in-play scoring labels also meet the 48 px floor; their cards and landing-badge exclusions reserve enough space.
