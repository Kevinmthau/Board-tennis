# Build checklist: <game name>

Tick an item ([x]) in the step that finishes it in the code, not all at once at the end: a list ticked at the end hides the gaps. Leave what is not done open, and say what to do next. A browser, Board, or human item stays open until that check has actually been done; source and unit tests never tick it. Add the items this game needs.

## The game
- [ ] Players can: <how-to-play step 1 from docs/PLAN.md>
- [ ] Players can: <how-to-play step 2>
- [ ] Players can: <how-to-play step 3>
- [ ] Plan section in the code: <one line per rules section in docs/PLAN.md>
- [ ] Core loop plays from the title to a result without a stall

## Board
- [ ] Seats come from the SDK player selector (`src/seats.ts`) after BoardPlatform.state.ready(); no anonymous seats or name fields; the roster is re-read on players-changed and after every pick
- [ ] Selectable AI players, registered with registerAiTypes() and playing by the same rule functions (or the reason there are none is in docs/PLAN.md)
- [ ] A piece binds to a roster player as docs/PLAN.md's seating flow says; lift, re-detection after the system menu, and a piece in the wrong place are handled
- [ ] Piece-down: one splash with a sound where a piece lands, sized with the real footprint radius (`pieceFootprint().radiusPx`)
- [ ] Re-detection after the system menu or a tracking gap does not replay the arrival splash
- [ ] Nothing is drawn under or following a moving piece (checked with the real footprint radius, not a guess)
- [ ] Progress and the current run recorded with BoardPlatform.state

## What players see and hear in the first minute
- [ ] Title screen: the key art, something moving on it, the first real action starts play
- [ ] Each player's score and cues at their own edge, facing them
- [ ] Text floors: in-play text at least 48 px, other text at least 32 px, touch targets at least 120 px, everything 48 px in from the edge. A spec's smaller numbers do not lower them (record the conflict in docs/PLAN.md)
- [ ] Scoring moment: burst and score pop at the scorer's seat; a transition between rounds; a winner celebration
- [ ] The result waits for one shared decision (Rematch, Change setup); nothing restarts by itself; seats are confirmed or released explicitly
- [ ] If the game has sound: a sound for every player action, and music if the plan has it

## Done
- [ ] npm test passes, with tests for the rules (boot smoke and text-size tests included)
- [ ] npm run pack passes
- [ ] Browser: the boot check walk in build-rules section 13, done by hand under `npm run dev`
- [ ] Played on a real Board (see the studio-starter skill's deploy steps); what was and was not checked is in docs/ACCEPTANCE-LEDGER.md
- [ ] Played by a person who did not build it; what they did and said is in docs/ACCEPTANCE-LEDGER.md
